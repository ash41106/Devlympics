// End-to-end check in a real headless browser (Edge/Chrome over the DevTools protocol, no npm installs).
// Runs the full loop on the ASHA app: sample page -> X-ray -> AI asks back -> doctor reply -> Ink Replay -> SMS mode.
// Usage: node server.js   (in another terminal)   then   node tools/e2e.js
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = process.env.KAAGAZ_URL || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "e2e-shots");
const BROWSERS = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter((b) => b && fs.existsSync(b));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = (u, b) => fetch(BASE + u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());

async function main() {
  if (!BROWSERS.length) throw new Error("No Edge/Chrome found; set BROWSER=path");
  fs.mkdirSync(OUT, { recursive: true });
  const port = 9300 + Math.floor(Math.random() * 500);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), "kaagaz-e2e-"));
  const br = spawn(BROWSERS[0], ["--headless=new", "--disable-gpu", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "--window-size=430,1600", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 40 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page"); } catch {} }
  if (!target) throw new Error("Browser did not start");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const wait = new Map(), errors = [];
  ws.onmessage = (m) => { const d = JSON.parse(m.data);
    if (d.id && wait.has(d.id)) { wait.get(d.id)(d); wait.delete(d.id); }
    if (d.method === "Runtime.exceptionThrown") errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") errors.push(d.params.args.map((a) => a.value ?? a.description).join(" ")); };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expr) => (await cdp("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
  const shot = async (name) => fs.writeFileSync(path.join(OUT, name + ".png"), Buffer.from((await cdp("Page.captureScreenshot", { captureBeyondViewport: true })).result.data, "base64"));
  const until = async (expr, ms = 15000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(200); } return false; };
  const results = [];
  const check = (name, ok, extra = "") => { results.push(ok); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  · " + extra : ""}`); };

  await cdp("Runtime.enable"); await cdp("Page.enable");
  // Silence speech in headless runs; record what would have been spoken.
  await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "window.__spoken=[];window.speechSynthesis&&(speechSynthesis.speak=(u)=>{__spoken.push(u.text);setTimeout(()=>u.onend&&u.onend(),50)});" });

  await post("/api/reset", {}); await sleep(300);
  const t0 = Date.now(); await cdp("Page.navigate", { url: BASE + "/field.html" });
  const loaded = await until(`document.readyState!=="loading" && !!document.querySelector("#demo")`);
  check("ASHA app loads", loaded, `${Date.now() - t0} ms`); await sleep(800);

  await js(`document.querySelector("#demo").click()`); await until(`document.querySelectorAll("#paper .box").length===5`); await sleep(2500);
  const ev = await js(`document.querySelectorAll("#paper .ev").length`);
  check("Paper read, rows boxed", (await js(`document.querySelectorAll("#paper .box").length`)) === 5);
  check("Danger-sign X-ray highlights", ev >= 4, `${ev} evidence marks`);
  check("QR page stamp", await js(`!!document.querySelector("#qr img, #qr canvas")`));
  check("AI asks back (Hindi question shown + spoken)", await js(`document.querySelector("#askBox").style.display==="block" && __spoken.some(t=>t.includes("रमेश"))`));
  await shot("1-paper-xray-ask");

  await js(`[...document.querySelectorAll(".ask-q button")].find(b=>b.dataset.v&&b.textContent==="हाँ").click()`); await sleep(1200);
  const st = await (await fetch(BASE + "/api/stream", { signal: AbortSignal.timeout(1500) }).then((r) => r.body.getReader().read()).then((x) => new TextDecoder().decode(x.value))).toString();
  const ramesh = JSON.parse(st.split("data: ")[1]).entries.find((e) => e.name === "Ramesh Yadav");
  check("Worker's answer re-triages patient", ramesh?.risk === "high" && ramesh?.escalated, `Ramesh → ${ramesh?.risk}`);

  const sunita = JSON.parse(st.split("data: ")[1]).entries.find((e) => e.name === "Sunita Devi");
  await post("/api/alert", { name: sunita.name, village: sunita.village, worker: sunita.worker, risk: "high", entryId: sunita.id,
    hi: "सुनीता जी को आज ही PHC ले जाएँ। BP की जाँच ज़रूरी है।", ink: "आज ही PHC · BP ✓ — डॉ." });
  await sleep(3800);
  check("Doctor message arrives + spoken", await js(`document.querySelectorAll("#inbox .alert").length===1 && __spoken.some(t=>t.includes("सुनीता"))`));
  check("Ink Replay drawn on the paper", await js(`!!document.querySelector("#ink .inkline text")`));
  await shot("2-ink-replay");

  await js(`[...document.querySelectorAll("#inbox .quick button")][0].click()`); await sleep(800);
  const acked = JSON.parse((await fetch(BASE + "/api/stream", { signal: AbortSignal.timeout(1500) }).then((r) => r.body.getReader().read()).then((x) => new TextDecoder().decode(x.value))).split("data: ")[1]).alerts[0];
  check("Voice-reply loop closes (acknowledged)", acked.status === "acknowledged", acked.reply);

  await js(`document.querySelector("#basic").click()`);
  await post("/api/alert", { name: "Aarav Kumar", village: "Rampur", worker: "ASHA Meena", risk: "high", hi: "आरव का टीका छूट गया है। गुरुवार को लाएँ।" });
  await sleep(1500);
  check("Basic phone mode shows SMS with code", await js(`/KGZ\\d{4}/.test(document.querySelector("#inbox .sms")?.textContent||"")`));
  await js(`document.querySelector(".keypad [data-k='1']").click()`); await sleep(600);
  check("SMS keypad reply sent", await js(`document.querySelector(".sms .reply")?.textContent.includes("1")`));

  await js(`document.querySelector("#voice").click(); document.querySelector("#voiceDemo").click(); document.querySelector("#voiceSend").click()`); await sleep(1500);
  check("Spoken visit becomes a triaged row", await js(`/मोहन|Mohan/.test(document.querySelector("#voiceLive").textContent) && /high/.test(document.querySelector("#voiceLive").textContent)`));
  await js(`document.querySelector("#summary").click()`); await sleep(300);
  check("Shift summary spoken", await js(`__spoken.some(t=>t.startsWith("आज आपने"))`));
  await shot("3-sms-voice-summary");

  check("No JavaScript errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  ws.close(); br.kill();
  const pass = results.filter(Boolean).length;
  console.log(`\n${pass}/${results.length} passed · screenshots in ${OUT}`);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => { console.error("E2E failed:", e.message); process.exit(1); });
