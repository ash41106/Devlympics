// Kaagaz accuracy + calibration check.
// 1. Start the server with a Gemini key:  node server.js
// 2. Put register photos in testpages/ (jpg/png). Optional answer key next to each: page1.jpg -> page1.json
//    {"rows":[{"name":"Sunita Devi","risk":"high"},{"name":"Aarav","risk":"high"}, ...]}
// 3. node tools/eval.js        -> prints the score and writes eval-report.html (boxes + X-ray drawn on each photo)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIR = path.join(ROOT, "testpages");
const SERVER = process.env.KAAGAZ_URL || "http://localhost:3000";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zऀ-ॿ]/g, "");

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// A name counts as read correctly if it is within ~20% edits of the truth (handles "Sunita Devi" vs "Sunita Devii").
const sameName = (a, b) => { const x = norm(a), y = norm(b); return x && y && (x === y || x.includes(y) || y.includes(x) || lev(x, y) <= Math.max(1, Math.round(y.length * 0.2))); };

async function main() {
  if (!fs.existsSync(DIR)) fs.mkdirSync(DIR);
  const files = fs.readdirSync(DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  if (!files.length) { console.log(`No photos in ${DIR}. Add register photos (jpg/png) and run again.`); return; }

  const tot = { rows: 0, found: 0, risk: 0, truthRows: 0, unsure: 0, wrongButFlagged: 0, ms: 0, pages: 0 };
  const cards = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(DIR, f));
    const mime = /png$/i.test(f) ? "image/png" : /webp$/i.test(f) ? "image/webp" : "image/jpeg";
    const t0 = Date.now();
    const r = await fetch(SERVER + "/api/extract", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: buf.toString("base64"), mime, worker: "eval", scanId: "eval-" + f.replace(/\W/g, "") }) }).then((x) => x.json());
    const ms = Date.now() - t0;
    if (r.source !== "gemini") { console.log(`✗ ${f}: server answered with "${r.source}". Is GEMINI_API_KEY set and the photo readable?`); continue; }
    tot.pages++; tot.ms += ms; tot.rows += r.added.length;
    tot.unsure += r.added.filter((e) => !e.verified).length;

    const keyFile = path.join(DIR, f.replace(/\.\w+$/, ".json"));
    const truth = fs.existsSync(keyFile) ? JSON.parse(fs.readFileSync(keyFile, "utf8")).rows || [] : null;
    const verdict = new Map();
    if (truth) {
      tot.truthRows += truth.length;
      for (const t of truth) {
        const hit = r.added.find((e) => sameName(e.name, t.name));
        if (hit) { tot.found++; verdict.set(hit.id, "ok"); if (!t.risk || t.risk === hit.risk) tot.risk++; else verdict.set(hit.id, "risk"); }
      }
      // Misreads the AI itself marked as unsure still get a human check, so they are not silent errors.
      r.added.forEach((e) => { if (!verdict.has(e.id) && !e.verified) tot.wrongButFlagged++; });
    }

    const img = `data:${mime};base64,${buf.toString("base64")}`;
    const box = ([y1, x1, y2, x2], cls, label = "") =>
      `<div class="b ${cls}" style="top:${y1 / 10}%;left:${x1 / 10}%;width:${(x2 - x1) / 10}%;height:${(y2 - y1) / 10}%">${label ? `<span>${esc(label)}</span>` : ""}</div>`;
    const overlays = r.added.map((e) => (Array.isArray(e.box) ? box(e.box, e.risk + (e.verified ? "" : " unsure"), e.name) : "") +
      (e.evidence || []).filter((v) => Array.isArray(v.box)).map((v) => box(v.box, "ev")).join("")).join("");
    const rows = r.added.map((e) => `<tr class="${verdict.get(e.id) || (truth ? "miss" : "")}"><td>${esc(e.name)}</td><td>${esc(e.village)}</td><td>${e.risk}</td>
      <td>${Math.round(e.confidence * 100)}%</td><td>${esc((e.evidence || []).map((v) => v.text).join(", "))}</td><td>${esc(e.ask || "")}</td></tr>`).join("");
    cards.push(`<section><h2>${esc(f)} <small>${(ms / 1000).toFixed(1)}s · ${r.added.length} rows${truth ? ` · answer key: ${truth.length}` : ""}</small></h2>
      <div class="grid"><div class="pg"><img src="${img}">${overlays}</div>
      <table><tr><th>Name</th><th>Village</th><th>Risk</th><th>Conf.</th><th>X-ray evidence</th><th>Asks back</th></tr>${rows}</table></div></section>`);
    console.log(`✓ ${f}: ${r.added.length} rows in ${(ms / 1000).toFixed(1)}s`);
  }
  if (!tot.pages) return;

  const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "n/a");
  const summary = [
    ["Pages", tot.pages], ["Rows read", tot.rows], ["Avg time per page", (tot.ms / tot.pages / 1000).toFixed(1) + "s"],
    ["Names read correctly", tot.truthRows ? `${tot.found}/${tot.truthRows} (${pct(tot.found, tot.truthRows)})` : "add .json answer keys"],
    ["Risk level matches", tot.truthRows ? `${tot.risk}/${tot.found} (${pct(tot.risk, tot.found)})` : "n/a"],
    ["Rows sent to a human check", `${tot.unsure} (${pct(tot.unsure, tot.rows)})`],
    ["Wrong rows the AI flagged itself", tot.truthRows ? String(tot.wrongButFlagged) : "n/a"],
  ];
  console.log("\n" + summary.map(([k, v]) => `  ${k.padEnd(34)} ${v}`).join("\n"));
  if (tot.truthRows) console.log(`\n  Pitch line: "Gemini read ${tot.found} of ${tot.truthRows} handwritten rows correctly; uncertain rows are flagged for a human."`);

  const out = path.join(ROOT, "eval-report.html");
  fs.writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Kaagaz eval</title>
<style>body{font:14px Inter,system-ui,sans-serif;background:#f3ead6;color:#1b1a2e;margin:0;padding:24px}h1{font-family:Georgia,serif}
.sum{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}.sum div{background:#fffaf0;border:1.5px solid #1b1a2e;border-radius:10px;padding:10px 14px}.sum b{display:block;font-size:20px}
section{background:#fffaf0;border:1.5px solid #1b1a2e;border-radius:12px;padding:16px;margin-bottom:20px}h2 small{font-weight:400;color:#6e6650;font-size:13px}
.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:16px;align-items:start}.pg{position:relative}.pg img{width:100%;display:block}
.b{position:absolute;border:2px solid #2f7a3b;border-radius:4px}.b span{position:absolute;top:-18px;left:0;background:#1b1a2e;color:#fff;font-size:11px;padding:1px 5px;white-space:nowrap}
.b.high{border-color:#c8321e}.b.medium{border-color:#c26a00}.b.unsure{border-style:dashed}.b.ev{border:0;background:rgba(255,90,60,.35);box-shadow:0 0 0 2px #c8321e}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e2d5b8;padding:6px;text-align:left;vertical-align:top}tr.ok td:first-child{color:#2f7a3b;font-weight:700}tr.risk td:nth-child(3){color:#c26a00;font-weight:700}tr.miss td:first-child{color:#c8321e}
@media(max-width:800px){.grid{grid-template-columns:1fr}}</style>
<h1>Kaagaz: accuracy &amp; calibration</h1><div class="sum">${summary.map(([k, v]) => `<div>${k}<b>${esc(v)}</b></div>`).join("")}</div>
<p>Green name = matches answer key · red name = not in key · orange risk = disagrees with key · dashed box = AI unsure · red fill = X-ray evidence. If boxes sit off the handwriting, retake the photo flatter and closer.</p>
${cards.join("")}`);
  console.log(`\n  Report: ${out}`);
}
main().catch((e) => { console.error("Eval failed:", e.message, `\n(Is the server running at ${SERVER}?)`); process.exit(1); });
