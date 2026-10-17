// Captures real product screenshots for the pitch video (public/pitch/*.png). Server must be running.
// node tools/shots.js
const { spawn } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const BASE = process.env.KAAGAZ_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "public", "pitch");
const BR = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((b) => b && fs.existsSync(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (u, b) => fetch(BASE + u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
const state = async () => JSON.parse((await fetch(BASE + "/api/stream", { signal: AbortSignal.timeout(1500) }).then((r) => r.body.getReader().read()).then((x) => new TextDecoder().decode(x.value))).split("data: ")[1]);

async function tab(port) {
  const t = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d.result); wait.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (e) => (await cdp("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value;
  const until = async (e, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await js(e)) return true; await sleep(200); } return false; };
  await cdp("Page.enable");
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "window.speechSynthesis&&(speechSynthesis.speak=(u)=>setTimeout(()=>u.onend&&u.onend(),50));" });
  const go = async (url, w, h) => { await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: w < 600 }); await cdp("Page.navigate", { url: BASE + url }); await until(`document.readyState==="complete"`); await sleep(1200); };
  // Screenshot one element (padding in CSS px) or the viewport.
  const shot = async (name, sel, pad = 8) => {
    let clip;
    if (sel) { const r = await js(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:"center"});const b=e.getBoundingClientRect();return {x:b.x+scrollX,y:b.y+scrollY,w:b.width,h:b.height}})()`);
      if (!r) return console.log("  (missing " + sel + ")"); await sleep(500); clip = { x: r.x - pad, y: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2, scale: 1 }; }
    const res = await cdp("Page.captureScreenshot", clip ? { clip, captureBeyondViewport: true } : {});
    fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from(res.data, "base64")); console.log("  ✓ " + name);
  };
  return { js, until, go, shot, close: () => ws.close() };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const port = 9300 + Math.floor(Math.random() * 500), prof = fs.mkdtempSync(path.join(os.tmpdir(), "kaagaz-shots-"));
  const br = spawn(BR, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await sleep(250); try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch {} }
  await post("/api/reset", {}); await sleep(400);

  const bridge = await tab(port); await bridge.go("/bridge.html", 1600, 900);
  const phone = await tab(port); await phone.go("/field.html", 412, 900);
  await phone.js(`document.querySelector("#demo").click()`);
  await phone.until(`document.querySelectorAll("#paper .box").length===5`); await sleep(2600);
  await phone.shot("xray", "#paper", 2);
  await phone.shot("ask", "#askBox");
  await bridge.shot("bridge-live");

  const s = await state(), sunita = s.entries.find((e) => e.name === "Sunita Devi");
  const doc = await tab(port); await doc.go("/doctor.html", 1440, 1000);
  await doc.shot("doctor");
  await doc.js(`document.querySelector('.row[data-id="${sunita.id}"]').click()`); await sleep(1500);
  await doc.shot("doctor-modal", ".modal .sheet", 0);

  await phone.js(`[...document.querySelectorAll(".ask-q button")].find(b=>b.textContent==="हाँ").click()`); await sleep(800);
  await post("/api/alert", { name: sunita.name, village: sunita.village, worker: sunita.worker, risk: "high", entryId: sunita.id,
    hi: "सुनीता जी को आज ही PHC ले जाएँ। BP और सूजन की जाँच ज़रूरी है।", ink: "आज ही PHC · BP ✓ — डॉ." });
  await sleep(4000);
  await phone.shot("ink", "#paper", 2);
  await phone.shot("inbox", "#inbox .alert");
  await phone.js(`[...document.querySelectorAll("#inbox .quick button")][0].click()`); await sleep(3200);
  await bridge.shot("finale");

  await phone.js(`document.querySelector("#basic").click()`);
  await post("/api/alert", { name: "Aarav Kumar", village: "Rampur", worker: "ASHA Meena", risk: "high", hi: "आरव का DPT-2 टीका छूट गया है। इस गुरुवार के सत्र में लाएँ।" });
  await sleep(1500); await phone.shot("sms", "#inbox .sms");
  await phone.js(`document.querySelector("#voice").click();document.querySelector("#voiceDemo").click();document.querySelector("#voiceSend").click()`); await sleep(1500);
  await phone.shot("voice", "#voiceBox");
  await phone.shot("stamp", "#stamp");
  await doc.go("/doctor.html", 1440, 1000); await doc.shot("map", ".map", 6);
  await post("/api/reset", {});
  br.kill(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
