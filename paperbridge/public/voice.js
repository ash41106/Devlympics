// Reliable Hindi speech: picks a real Hindi voice once voices load, works around Chrome's long-utterance cut-off,
// and tells the user (instead of failing silently) when the device has no Hindi voice installed.
window.say = (() => {
  let voice = null, ready = false;
  const pick = () => {
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /^hi(-|_|$)/i.test(v.lang) && /google/i.test(v.name)) || vs.find((v) => /^hi(-|_|$)/i.test(v.lang)) || null;
    ready = vs.length > 0;
  };
  if ("speechSynthesis" in window) { pick(); speechSynthesis.onvoiceschanged = pick; }

  function warn() {
    if (document.getElementById("noHindi")) return;
    const d = document.createElement("div"); d.id = "noHindi"; d.className = "no-hindi";
    d.innerHTML = `🔇 No Hindi voice on this device. <b>Windows:</b> Settings › Time &amp; language › Speech › Add voices › Hindi. <b>Android:</b> Settings › Text-to-speech › Google › install Hindi. <button aria-label="Close">✕</button>`;
    d.querySelector("button").onclick = () => d.remove();
    document.body.append(d);
  }

  return function say(text, onend) {
    if (!("speechSynthesis" in window)) { warn(); onend?.(); return; }
    if (!ready) pick();
    if (ready && !voice) warn();
    speechSynthesis.cancel();
    // Chrome stops speaking after ~15s of one utterance: speak sentence by sentence.
    const parts = String(text).split(/(?<=[।.!?])\s+/).filter(Boolean);
    parts.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = "hi-IN"; u.rate = 0.95; if (voice) u.voice = voice;
      if (i === parts.length - 1 && onend) { u.onend = onend; u.onerror = onend; }
      speechSynthesis.speak(u);
    });
  };
})();
