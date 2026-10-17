// Renders public/pitch.html into a 1080p MP4, frame by frame (smooth, no screen-recording jitter).
// Needs: server running, Edge/Chrome, ffmpeg (FFMPEG=path, or `pip install imageio-ffmpeg`).
// node tools/video.js  ->  kaagaz-pitch.mp4
const { spawn, execFileSync } = require("child_process");
const fs = require("fs"), os = require("os"), path = require("path");
const BASE = process.env.KAAGAZ_URL || "http://localhost:3000";
const FPS = +process.env.FPS || 24;
const OUT = path.join(__dirname, "..", "kaagaz-pitch.mp4");
const BR = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((b) => b && fs.existsSync(b));
const FF = process.env.FFMPEG || (() => { try { return execFileSync("python", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); } catch { return "ffmpeg"; } })();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const port = 9300 + Math.floor(Math.random() * 500), prof = fs.mkdtempSync(path.join(os.tmpdir(), "kaagaz-vid-"));
  const br = spawn(BR, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, "about:blank"], { stdio: "ignore" });
  let t; for (let i = 0; i < 40 && !t; i++) { await sleep(250); try { t = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((x) => x.type === "page"); } catch {} }
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
  let id = 0; const wait = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && wait.has(d.id)) { wait.get(d.id)(d.result); wait.delete(d.id); } };
  const cdp = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (e) => (await cdp("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }))?.result?.value;

  await cdp("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp("Page.navigate", { url: BASE + "/pitch.html?render" });
  for (let i = 0; i < 60 && !(await js("typeof renderAt==='function' && document.fonts.status==='loaded'")); i++) await sleep(250);
  await sleep(1500); // let images decode
  const total = await js("TOTAL");
  // Record in real time with the DevTools screencast: every painted frame arrives with its timestamp.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kaagaz-frames-")), frames = [];
  ws.addEventListener("message", (m) => { const d = JSON.parse(m.data); if (d.method !== "Page.screencastFrame") return;
    const f = path.join(dir, String(frames.length).padStart(6, "0") + ".jpg"); fs.writeFileSync(f, Buffer.from(d.params.data, "base64"));
    frames.push({ f, ts: d.params.metadata.timestamp }); cdp("Page.screencastFrameAck", { sessionId: d.params.sessionId }); });
  await cdp("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  // Play from 0 at real speed (render mode is paused; drive the clock ourselves so timing is exact).
  await js(`(()=>{const t0=performance.now();const step=()=>{const t=(performance.now()-t0)/1000;renderAt(t);if(t<TOTAL)requestAnimationFrame(step)};requestAnimationFrame(step)})()`);
  for (let s = 0; s <= total; s++) { process.stdout.write(`  recording ${s}s / ${total}s  (${frames.length} frames)`); await sleep(1000); }
  await sleep(800); await cdp("Page.stopScreencast");
  // Each frame lasts until the next one: exact timing even when the browser paints unevenly.
  const fwd = (f) => f.split(path.sep).join("/");
  const list = frames.map((x, i) => `file '${fwd(x.f)}'\nduration ${Math.max(0.001, (frames[i + 1]?.ts ?? x.ts + 0.5) - x.ts).toFixed(4)}`).join("\n") + `\nfile '${fwd(frames.at(-1).f)}'`;
  fs.writeFileSync(path.join(dir, "list.txt"), list);
  execFileSync(FF, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", `fps=${FPS},scale=1920:1080:flags=lanczos,format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", OUT], { stdio: "inherit" });
  fs.rmSync(dir, { recursive: true, force: true });
  const t0 = Date.now() - total * 1000;
  ws.close(); br.kill();
  console.log(`\n  ✓ ${OUT}  (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${total}s, rendered in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  process.exit(0);
})().catch((e) => { console.error("Video failed:", e.message); process.exit(1); });
