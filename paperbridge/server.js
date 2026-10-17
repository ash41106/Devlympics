// Kaagaz — zero-dependency server: static files, SSE live sync, streaming Gemini Vision proxy.
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = process.env.PORT || 3000;
const KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const PUB = path.join(__dirname, "public");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

const state = { entries: [], alerts: [] };
const scans = new Map(); // scanId -> { buf, mime }  (original photos, so every record links back to its paper)
const clients = new Set();
const broadcast = (type, data) => {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach((res) => res.write(msg));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PROMPT = `You are digitising a handwritten Indian community health worker (ASHA) register page.
Text may be Hindi, English or Hinglish. Extract every patient row, in top-to-bottom order. Return JSON only:
{"entries":[{"name":string,"village":string,"age":number|null,"gender":"F"|"M"|null,"category":"pregnancy"|"vaccination"|"fever"|"nutrition"|"other","note":string,"risk":"high"|"medium"|"low","reason":string,"feverDays":number|null,"confidence":number,"box":[ymin,xmin,ymax,xmax],"evidence":[{"text":string,"box":[ymin,xmin,ymax,xmax]}],"ask":string|null}]}
Put "name" and "village" first in each object. Transliterate names to English; "note" is a short English summary of what is written.
"risk" is clinical triage: high = danger signs (fever >3 days with vomiting/bleeding, missed vaccine dose, severe malnutrition, pregnancy with high BP/swelling).
"reason" is one short English line. "box" is the bounding box of that row's handwriting, normalised 0-1000.
"confidence" (0-1) is how sure you are you read that row's handwriting correctly; be honest and go below 0.75 for smudged, ambiguous or partly illegible rows.
"evidence" lists the exact handwritten words that made you choose that risk (e.g. "BP 150/100", "sujan", "MUAC laal"), each with its own tight box, normalised 0-1000. Empty for low risk.
"ask" is ONE short follow-up question in simple Hindi (Devanagari) for the health worker when a danger sign is unknown and would change triage (e.g. fever but no mention of vomiting/bleeding; pregnancy but no BP). Otherwise null.`;

function readBody(req) {
  return new Promise((ok, bad) => {
    let b = "";
    req.on("data", (c) => { b += c; if (b.length > 15e6) req.destroy(); });
    req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { bad(e); } });
  });
}

// Streams Gemini output and emits each patient name the moment the model has read it.
async function geminiExtract(imageB64, mime, onFound) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:streamGenerateContent?alt=sse&key=${KEY}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: mime, data: imageB64 } }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const dec = new TextDecoder();
  let buf = "", text = "", seen = 0;
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      try { text += JSON.parse(line.slice(5)).candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || ""; } catch {}
      const found = [...text.matchAll(/"name"\s*:\s*"([^"]*)"\s*,\s*"village"\s*:\s*"([^"]*)"/g)];
      while (seen < found.length) { onFound({ name: found[seen][1], village: found[seen][2] }); seen++; }
    }
  }
  return JSON.parse(text).entries || [];
}

async function geminiText(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`;
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: PROMPT.replace("digitising a handwritten", "turning a SPOKEN (transcribed)") + "\nIgnore all box fields (use []). Spoken text: " + text }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } } }) });
  if (!r.ok) throw new Error(`Gemini voice ${r.status}`);
  const j = await r.json();
  return JSON.parse(j.candidates[0].content.parts.map((p) => p.text).join("")).entries || [];
}
// Offline fallback for voice rows: keyword triage, good enough to keep the demo alive.
function voiceGuess(t) {
  const l = t.toLowerCase();
  const cat = /garbh|गर्भ|pregnan/.test(l) ? "pregnancy" : /tika|टीका|vaccin/.test(l) ? "vaccination" : /bukhar|बुखार|fever/.test(l) ? "fever" : /vajan|वज़न|वजन|muac|kuposh|कुपोषण/.test(l) ? "nutrition" : "other";
  const danger = /ulti|उल्टी|khoon|खून|bp|सूजन|sujan|behosh|बेहोश|laal|लाल/.test(l);
  const name = (t.match(/^\s*([^\s,।]+(?:\s+(?:devi|देवी|kumar|कुमार|bai|बाई|lal|लाल))?)/i) || [, "Unknown"])[1];
  const village = (t.match(/([^\s,।]+)\s+(?:gaon|गाँव|गांव|से|village)/i) || [, "Sonpur"])[1];
  return { name, village, age: +((t.match(/(\d+)\s*(?:saal|साल|year)/i) || [])[1]) || null, category: cat, note: t.slice(0, 90),
    risk: danger ? "high" : cat === "other" ? "low" : "medium", reason: danger ? "Danger sign mentioned in spoken report" : "Spoken visit report", confidence: 0.8, evidence: [], ask: null };
}

// Two scripted sample pages so the demo survives dead venue WiFi. Page 2 completes a fever cluster in Sonpur.
const row = (i) => [150 + i * 120, 50, 260 + i * 120, 950];
const DEMO = {
  1: [
    { name: "Sunita Devi", age: 24, gender: "F", village: "Rampur", category: "pregnancy", note: "7th month, feet swelling, BP 150/100", risk: "high", reason: "Possible pre-eclampsia: high BP with swelling" },
    { name: "Aarav Kumar", age: 1, gender: "M", village: "Rampur", category: "vaccination", note: "DPT-2 due, not given", risk: "high", reason: "Missed DPT-2 dose" },
    { name: "Ramesh Yadav", age: 52, gender: "M", village: "Sonpur", category: "fever", note: "Fever 4 days, body pain", risk: "medium", reason: "Fever >3 days: test for malaria/dengue" },
    { name: "Pooja", age: 3, gender: "F", village: "Kheda", category: "nutrition", note: "Weight 9.1kg, MUAC red", confidence: 0.64, risk: "high", reason: "Severe acute malnutrition (MUAC red)" },
    { name: "Kamla Bai", age: 31, gender: "F", village: "Sonpur", category: "other", note: "Routine visit, all fine", risk: "low", reason: "No danger signs" },
  ],
  2: [
    { name: "Geeta", age: 34, gender: "F", village: "Sonpur", category: "fever", note: "Fever 3 days, shivering", risk: "medium", reason: "Fever with chills: malaria test" },
    { name: "Mohan Lal", age: 60, gender: "M", village: "Sonpur", category: "fever", note: "High fever 5 days, vomiting", risk: "high", reason: "Prolonged fever with vomiting: dengue warning sign" },
    { name: "Rinku", age: 8, gender: "M", village: "Sonpur", category: "fever", note: "Fever with rash", confidence: 0.71, risk: "medium", reason: "Fever with rash: dengue/measles check" },
    { name: "Ramesh Yadav", age: 52, gender: "M", village: "Sonpur", category: "fever", note: "Fever 7 days, now vomiting, weak", risk: "high", reason: "Fever now 7 days with vomiting: refer to PHC today" },
    { name: "Savitri", age: 27, gender: "F", village: "Kheda", category: "pregnancy", note: "4th month, routine checkup OK", risk: "low", reason: "Normal antenatal visit" },
  ],
};
// Evidence boxes for the sample pages: [noteLine row, start char, end char] on the 800x1000 SVG (≈11px per char at x=110).
const ev = (i, a, b, text) => ({ text, box: [150 + i * 120 + 56, Math.round((110 + a * 11) * 1.25), 150 + i * 120 + 94, Math.round((110 + b * 11) * 1.25)] });
const EVIDENCE = {
  1: [[ev(0, 15, 28, "pair me sujan"), ev(0, 30, 44, "BP 150/100 !!")], [ev(1, 0, 15, "DPT-2 tika baki")], [ev(2, 0, 12, "bukhar 4 din")], [ev(3, 15, 24, "MUAC laal")], []],
  2: [[ev(0, 0, 12, "bukhar 3 din")], [ev(1, 0, 17, "tez bukhar 5 din"), ev(1, 18, 22, "ulti")], [ev(2, 9, 24, "sharir pe daane")], [ev(3, 0, 12, "bukhar 7 din"), ev(3, 14, 21, "ab ulti")], []],
};
const ASK = { "1-2": "रमेश जी को उल्टी या कहीं से खून आ रहा है क्या?", "2-2": "रिंकू को बुखार कितने दिन से है?" };
Object.entries(DEMO).forEach(([p, rows]) => rows.forEach((e, i) => { e.box = row(i); e.confidence ??= 0.93; e.evidence = EVIDENCE[p][i]; e.ask = ASK[`${p}-${i}`] || null; }));

// IDSP/IHIP S-form syndromic category, so district data can flow into national surveillance.
function syndrome(e) {
  if (e.category !== "fever") return null;
  const t = (e.note || "").toLowerCase();
  const days = e.feverDays ?? +((t.match(/(\d+)\s*(day|din|दिन)/) || [])[1] || 0);
  if (/rash|daane|दाने/.test(t)) return "Fever with rash";
  if (/bleed|khoon|खून/.test(t)) return "Fever with bleeding";
  if (/unconscious|confus|behosh|बेहोश/.test(t)) return "Fever with altered sensorium";
  return days >= 7 ? "Fever ≥7 days" : "Fever <7 days";
}
const key = (e) => `${(e.name || "").toLowerCase().replace(/[^a-z]/g, "")}|${(e.village || "").toLowerCase()}`;

// Patient memory: a returning patient is linked to earlier visits, and an escalation in risk is flagged.
function enrich(e) {
  const prior = state.entries.filter((p) => key(p) === key(e));
  const rank = { low: 0, medium: 1, high: 2 };
  const prev = prior[0];
  return { ...e, syndrome: syndrome(e), visit: prior.length + 1, prevRisk: prev?.risk || null,
    escalated: !!prev && rank[e.risk] > rank[prev.risk], verified: (e.confidence ?? 1) >= 0.75, confidence: e.confidence ?? 1 };
}


const json = (res, obj, code = 200) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname === "/api/stream") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write(`event: init\ndata: ${JSON.stringify({ ...state, live: !!KEY })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 20000);
      req.on("close", () => { clients.delete(res); clearInterval(ping); });
      return;
    }
    if (url.pathname.startsWith("/api/scan/")) {
      const s = scans.get(url.pathname.slice(10));
      if (!s) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "Content-Type": s.mime }); return res.end(s.buf);
    }
    if (url.pathname === "/api/extract" && req.method === "POST") {
      const { image, mime = "image/jpeg", worker = "ASHA Meena", demoPage, scanId = Date.now().toString(36) } = await readBody(req);
      broadcast("scanning", { scanId, worker });
      const found = (f) => broadcast("found", { scanId, ...f });
      let rows, source = "gemini", src;
      if (KEY && image && !demoPage) {
        scans.set(scanId, { buf: Buffer.from(image, "base64"), mime });
        src = `/api/scan/${scanId}`;
        try { rows = await geminiExtract(image, mime, found); }
        catch (e) { console.error(e.message); rows = DEMO[1]; source = "offline-fallback"; src = "/sample1.svg"; }
      } else {
        const p = DEMO[demoPage] ? demoPage : 1;
        rows = DEMO[p]; source = "demo"; src = `/sample${p}.svg`;
        await sleep(700);
        for (const e of rows) { found({ name: e.name, village: e.village }); await sleep(550); }
      }
      if (source === "offline-fallback") for (const e of rows) found({ name: e.name, village: e.village });
      const now = Date.now();
      const added = rows.map((e, i) => enrich({ ...e, id: `${scanId}-${i}`, scanId, src, worker, at: now }));
      state.entries.unshift(...added);
      broadcast("entries", { scanId, added, source });
      return json(res, { added, source });
    }
    // Speak instead of write: a spoken visit becomes a register row.
    if (url.pathname === "/api/voice" && req.method === "POST") {
      const { text = "", worker = "ASHA Meena", scanId = "v" + Date.now().toString(36) } = await readBody(req);
      if (!text.trim()) return json(res, { error: "empty" }, 400);
      broadcast("scanning", { scanId, worker, voice: true });
      let rows = null, source = "voice";
      if (KEY) {
        try { rows = await geminiText(text); source = "voice-gemini"; } catch (e) { console.error(e.message); }
      }
      if (!rows || !rows.length) rows = [voiceGuess(text)];
      const now = Date.now();
      const added = rows.map((e, i) => enrich({ ...e, id: `${scanId}-${i}`, scanId, worker, at: now, spoken: text }));
      added.forEach((e) => broadcast("found", { scanId, name: e.name, village: e.village }));
      state.entries.unshift(...added);
      broadcast("entries", { scanId, added, source });
      return json(res, { added, source });
    }
    if (url.pathname === "/api/alert" && req.method === "POST") {
      const a = { ...(await readBody(req)), code: "KGZ" + Math.floor(1000 + Math.random() * 9000), id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: Date.now(), status: "sent" };
      state.alerts.unshift(a);
      broadcast("alert", a);
      return json(res, a);
    }
    if (url.pathname === "/api/ack" && req.method === "POST") {
      const { id, status, reply } = await readBody(req);
      const a = state.alerts.find((x) => x.id === id);
      if (!a) return json(res, { error: "no alert" }, 404);
      const order = ["sent", "heard", "acknowledged"];
      if (order.indexOf(status) > order.indexOf(a.status)) a.status = status;
      if (reply) a.reply = reply;
      a.ackAt = Date.now();
      broadcast("ack", a);
      return json(res, a);
    }
    if (url.pathname === "/api/verify" && req.method === "POST") {
      const { id, patch = {} } = await readBody(req);
      const i = state.entries.findIndex((x) => x.id === id);
      if (i < 0) return json(res, { error: "no entry" }, 404);
      const allowed = ["name", "age", "village", "note", "risk", "category"];
      const e = { ...state.entries[i] };
      allowed.forEach((k) => patch[k] !== undefined && patch[k] !== "" && (e[k] = k === "age" ? +patch[k] : patch[k]));
      e.syndrome = syndrome(e); e.verified = true; e.verifiedAt = Date.now(); e.edited = Object.keys(patch).length > 0;
      state.entries[i] = e;
      broadcast("update", e);
      return json(res, e);
    }
    // "AI asks back": the worker's spoken answer fills the gap and can re-triage the patient.
    if (url.pathname === "/api/answer" && req.method === "POST") {
      const { id, answer = "" } = await readBody(req);
      const i = state.entries.findIndex((x) => x.id === id);
      if (i < 0) return json(res, { error: "no entry" }, 404);
      const e = { ...state.entries[i] }, t = answer.toLowerCase();
      const yes = /हाँ|हां|haan|han|yes|उल्टी|ulti|खून|khoon|बेहोश/.test(t) && !/नहीं|nahi|no/.test(t);
      e.note = `${e.note} · ASHA: "${answer}"`; e.answered = answer; e.ask = null;
      if (yes && e.risk !== "high") { e.prevRisk = e.risk; e.risk = "high"; e.escalated = true; e.reason = `Worker confirmed danger sign ("${answer}"): refer today`; }
      e.syndrome = syndrome(e);
      state.entries[i] = e;
      broadcast("update", e); broadcast("answer", { id, name: e.name, answer, risk: e.risk });
      return json(res, e);
    }
    if (url.pathname === "/api/page") {
      const id = url.searchParams.get("scan");
      return json(res, { entries: state.entries.filter((e) => e.scanId === id), alerts: state.alerts });
    }
    if (url.pathname === "/api/reset" && req.method === "POST") {
      state.entries = []; state.alerts = []; scans.clear();
      broadcast("reset", {});
      return json(res, {});
    }
    const file = path.normalize(path.join(PUB, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname)));
    if (!file.startsWith(PUB) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    json(res, { error: e.message }, 500);
  }
});

server.listen(PORT, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === "IPv4" && !i.internal).map((i) => i.address);
  console.log(`\n  Kaagaz running  ${KEY ? "(Gemini LIVE: " + MODEL + ")" : "(DEMO mode: set GEMINI_API_KEY for live)"}`);
  console.log(`  Website:         http://localhost:${PORT}`);
  console.log(`  Live Bridge:     http://localhost:${PORT}/bridge.html   <- use this on the projector`);
  console.log(`  Doctor:          http://localhost:${PORT}/doctor.html`);
  ips.forEach((ip) => console.log(`  ASHA phone app:  http://${ip}:${PORT}/field.html`));
  console.log("");
});
