// Kaagaz FX: gradient mesh, cursor spotlight, 3D tilt, scroll progress, hero particle network.
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const embed = document.documentElement.classList.contains("embed");

  function init() {
    const mesh = document.createElement("div"); mesh.className = "mesh"; mesh.innerHTML = "<i></i><i></i><i></i>";
    document.body.prepend(mesh);
    if (embed) return;

    const bar = document.createElement("div"); bar.className = "progress"; document.body.append(bar);
    const onScroll = () => { const h = document.documentElement; bar.style.setProperty("--sp", h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)); };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();

    // Spotlight + tilt are delegated, so cards rendered later (live data) get them too.
    const SPOT = ".glass, .feat, .stat, .world, .fcard, .row, .pcard";
    const TILT = ".feat, .stat, .kpi, .pcard";
    document.addEventListener("pointermove", (e) => {
      const el = e.target.closest?.(SPOT); if (!el) return;
      el.classList.add("spot");
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", e.clientX - r.left + "px"); el.style.setProperty("--my", e.clientY - r.top + "px");
      if (!reduce && el.matches(TILT)) {
        el.classList.add("tilt");
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg) translateY(-3px)`;
      }
    }, { passive: true });
    document.addEventListener("pointerout", (e) => {
      const el = e.target.closest?.(TILT);
      if (el && !el.contains(e.relatedTarget)) el.style.transform = "";
    });

    // Magnetic primary buttons.
    if (!reduce) document.addEventListener("pointermove", (e) => {
      document.querySelectorAll(".btn.primary").forEach((b) => {
        const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.hypot(dx, dy);
        b.style.translate = d < 110 ? `${dx * .12}px ${dy * .18}px` : "";
      });
    }, { passive: true });

    const hero = document.querySelector(".l-hero");
    if (hero && !reduce) particles(hero);
  }

  // A drifting network of dots: paper fragments becoming connected data.
  function particles(host) {
    const c = document.createElement("canvas"); c.className = "particles"; host.prepend(c);
    const ctx = c.getContext("2d"); let W, H, pts, mouse = { x: -999, y: -999 };
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1); W = host.clientWidth; H = host.clientHeight;
      c.width = W * dpr; c.height = H * dpr; c.style.width = W + "px"; c.style.height = H + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(90, Math.round(W * H / 16000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: Math.random() * 1.8 + .8 }));
    };
    size(); addEventListener("resize", size);
    host.addEventListener("pointermove", (e) => { const r = host.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    host.addEventListener("pointerleave", () => (mouse = { x: -999, y: -999 }));
    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(host);
    (function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1;
        const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (dm < 140) { p.x += (p.x - mouse.x) / dm * .6; p.y += (p.y - mouse.y) / dm * .6; }
      }
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 120) { ctx.strokeStyle = `rgba(26,115,232,${(1 - d / 120) * .22})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      for (const p of pts) { ctx.fillStyle = "rgba(123,63,228,.45)"; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
    })();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
