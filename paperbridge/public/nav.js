// Shared site navigation + FX loader. Pages opened with ?embed (inside the Live Bridge) stay chrome-free.
(function () {
  const embed = new URLSearchParams(location.search).has("embed");
  if (embed) document.documentElement.classList.add("embed");
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
