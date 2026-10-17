// Shared site navigation + FX loader. Pages opened with ?embed (inside the Live Bridge) stay chrome-free.
(function () {
  const embed = new URLSearchParams(location.search).has("embed");
  if (embed) document.documentElement.classList.add("embed");
  // Fonts load in the background (never block the first paint on a slow village connection); the service worker caches them.
  const F = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,800;9..144,900&family=Kalam:wght@400;700&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@500;600&display=swap";
  document.write(`<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="${F}" media="print" onload="this.media='all'" />`);
  document.write('<link rel="stylesheet" href="fx.css" /><link rel="stylesheet" href="theme.css" /><script src="fx.js" defer><\/script>');
  if (embed) return;
  const here = location.pathname.replace(/\/$/, "/index.html").split("/").pop() || "index.html";
  const links = [
    ["index.html", "Home"],
    ["bridge.html", "Live Bridge"],
    ["doctor.html", "Doctor"],
    ["field.html", "ASHA App"],
  ];
  const nav = document.createElement("nav");
  nav.className = "site-nav";
  nav.innerHTML = `
    <a class="site-logo" href="/"><img src="logo.svg" alt="" /><span>Kaagaz</span><em>कागज़</em></a>
    <div class="site-links">${links.map(([h, t]) =>
      `<a href="${h === "index.html" ? "/" : h}" class="${h === here ? "on" : ""}">${t}${h === "bridge.html" ? '<i class="live-dot"></i>' : ""}</a>`).join("")}</div>`;
  document.addEventListener("DOMContentLoaded", () => { document.body.prepend(nav); document.body.classList.add("has-nav"); });
})();
