// Shared live data for Kaagaz pages: one SSE connection, patients grouped across visits, due dates.
window.K = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const post = (u, b) => fetch(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
  const initials = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const CAT = { pregnancy: "Pregnancy", vaccination: "Vaccination", fever: "Fever", nutrition: "Nutrition", other: "Routine" };
  const CAT_COLOR = { pregnancy: "#7b3fe4", vaccination: "#1a73e8", fever: "#d93025", nutrition: "#e37400", other: "#188038" };
  const RANK = { high: 2, medium: 1, low: 0 };
  const key = (e) => `${(e.name || "").toLowerCase().replace(/[^a-z]/g, "")}|${(e.village || "").toLowerCase()}`;
  const DAY = 864e5;
  const state = { entries: [], alerts: [], live: false };
  const subs = new Set();
  const emit = (why, data) => subs.forEach((f) => f(why, data));

  // One patient per name+village; visits newest first (server sends entries newest first).
  function patients() {
    const m = new Map();
    for (const e of state.entries) {
      const k = key(e);
      if (!m.has(k)) m.set(k, { key: k, visits: [] });
      m.get(k).visits.push(e);
    }
    return [...m.values()].map((p) => {
      const l = p.visits[0];
      return { ...p, latest: l, name: l.name, age: l.age, gender: l.gender, village: l.village, category: l.category, risk: l.risk,
        escalated: !!l.escalated, worker: l.worker, due: nextDue(l) };
    }).sort((a, b) => RANK[b.risk] - RANK[a.risk] || b.escalated - a.escalated || a.due.at - b.due.at);
  }

  // Next follow-up, following common NHM visit rhythms (ANC monthly, weekly SAM weigh-in, Thursday immunisation day).
  function nextDue(e) {
    const base = e.at || Date.now(), urgent = e.risk === "high";
    const thursday = () => { const d = new Date(base); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7)); return +d; };
    const R = {
      pregnancy: [urgent ? base : base + 30 * DAY, urgent ? "PHC check today (BP)" : "Next ANC check-up", "अगली ANC जाँच"],
      vaccination: [thursday(), "Vaccination session (Thursday)", "टीकाकरण सत्र (गुरुवार)"],
      fever: [urgent ? base : base + 2 * DAY, urgent ? "Refer to PHC today" : "Fever follow-up visit", "बुखार की दोबारा जाँच"],
      nutrition: [base + 7 * DAY, "Weekly weight + MUAC", "हर हफ़्ते वज़न और MUAC"],
      other: [base + 30 * DAY, "Routine home visit", "नियमित घर भेंट"],
    }[e.category] || [base + 30 * DAY, "Routine home visit", "नियमित घर भेंट"];
    return { at: R[0], what: R[1], hi: R[2] };
  }
  const dueLabel = (at) => {
    const d = Math.round((new Date(at).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
    return d <= 0 ? "Today" : d === 1 ? "Tomorrow" : d < 7 ? `In ${d} days` : new Date(at).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  function connect() {
    const es = new EventSource("/api/stream");
    es.addEventListener("init", (m) => { const d = JSON.parse(m.data); state.entries = d.entries; state.alerts = d.alerts; state.live = d.live; emit("init"); });
    es.addEventListener("entries", (m) => { const { added } = JSON.parse(m.data); state.entries = [...added, ...state.entries]; emit("entries", added); });
    es.addEventListener("update", (m) => { const e = JSON.parse(m.data); state.entries = state.entries.map((x) => (x.id === e.id ? e : x)); emit("update", e); });
    es.addEventListener("alert", (m) => { state.alerts.unshift(JSON.parse(m.data)); emit("alert"); });
    es.addEventListener("ack", (m) => { const a = JSON.parse(m.data); state.alerts = state.alerts.map((x) => (x.id === a.id ? a : x)); emit("ack", a); });
    es.addEventListener("reset", () => location.reload());
  }

  // Animated number for stat tiles.
  function tween(el, to, fmt = (v) => Math.round(v)) {
    const from = +el.dataset.v || 0; el.dataset.v = to; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 800); el.textContent = fmt(from + (to - from) * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  return { esc, post, initials, CAT, CAT_COLOR, RANK, key, state, patients, nextDue, dueLabel, connect, tween, on: (f) => subs.add(f) };
})();
