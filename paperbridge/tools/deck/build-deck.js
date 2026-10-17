// Builds Kaagaz-Pitch.pptx (in paperbridge/) from the real app screenshots in public/pitch/.
// cd tools/deck && npm install && node build-deck.js
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js"); // writes the Kaagaz colors into the deck theme

const ROOT = path.join(__dirname, "..", "..");
const IMG = (f) => path.join(ROOT, "public", f);
const OUT = path.join(ROOT, "Kaagaz-Pitch.pptx");

// Kaagaz brand: ink on register paper, turmeric highlighter, margin red.
const THEME = {
  name: "Kaagaz",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "1B1A2E", lt1: "FFFAF0", dk2: "12111F", lt2: "F3EAD6",
    accent1: "FFC93C", accent2: "C8321E", accent3: "2F7A3B", accent4: "2B3A8F", accent5: "C26A00", accent6: "6E6650",
    hlink: "2B3A8F", folHlink: "6E6650",
  },
};
const HEX = THEME.colors;
const HAND = "Ink Free";        // ships with Windows 10/11: the "handwritten" accent
const HINDI = "Nirmala UI";     // ships with Windows: Devanagari

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";    // 13.333 x 7.5 in
pres.title = "Kaagaz: Paper that talks back";
pres.subject = "Devlympics Shunya 2026 · Bridge the Gap";
pres.author = "Team Kaagaz";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333;

// ---------- layouts ----------
pres.defineSlideMaster({
  title: "Kaagaz Content",
  background: { color: C.background2 },
  objects: [
    { text: { text: "Kaagaz · कागज़", options: { x: 0.6, y: 6.95, w: 4, h: 0.35, fontSize: 11, color: C.accent6, fontFace: THEME.bodyFontFace, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.6, h: 0.35, fontSize: 11, color: C.accent6, align: "right" },

});
pres.defineSlideMaster({
  title: "Kaagaz Dark",
  background: { color: C.text2 },
  objects: [
    { text: { text: "Kaagaz · कागज़", options: { x: 0.6, y: 6.95, w: 4, h: 0.35, fontSize: 11, color: "9B93B8", fontFace: THEME.bodyFontFace, margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 6.95, w: 0.6, h: 0.35, fontSize: 11, color: "9B93B8", align: "right" },

});

// ---------- helpers (fresh option objects every call: pptxgenjs mutates them) ----------
const inkShadow = (o = 0.06) => ({ type: "outer", color: HEX.dk1, opacity: 1, blur: 0, offset: o * 72 / 1, angle: 45 });
function card(s, x, y, w, h, fill = C.background1, name = "card") {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: C.text1, width: 1.5 },
    shadow: { type: "outer", color: HEX.dk1, opacity: 1, blur: 0, offset: 4, angle: 45 }, objectName: name });
}
function text(s, t, o) { s.addText(t, { isTextBox: true, margin: 0, fontFace: THEME.bodyFontFace, color: C.text1, valign: "top", ...o }); }
function pill(s, t, x, y, w, fill, color, name = "pill") {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 0.42, rectRadius: 0.21, fill: { color: fill }, line: { color: C.text1, width: 1.25 }, objectName: name });
  text(s, t, { x, y, w, h: 0.42, fontSize: 14, bold: true, color, align: "center", valign: "middle" });
}
// Fit an image inside a box, keeping its aspect ratio; framed like a pasted-in photo.
const SIZES = { "pitch/ask.png": [792, 500], "pitch/doctor-modal.png": [1240, 1840], "pitch/inbox.png": [700, 418], "pitch/ink.png": [676, 842], "pitch/map.png": [1048, 504],
  "pitch/sms.png": [700, 418], "pitch/stamp.png": [704, 338], "pitch/voice.png": [792, 456], "pitch/xray.png": [676, 842], "sample1.png": [800, 1000], "pitch/finale.png": [3200, 1800] };
function photo(s, f, x, y, maxW, maxH, { align = "center", rotate = 0, name = "screenshot", alt = "" } = {}) {
  const [iw, ih] = SIZES[f]; const k = Math.min(maxW / iw, maxH / ih); const w = iw * k, h = ih * k;
  const px = align === "left" ? x : align === "right" ? x + maxW - w : x + (maxW - w) / 2, py = y + (maxH - h) / 2;
  s.addImage({ path: IMG(f), x: px, y: py, w, h, rotate, altText: alt, objectName: name,
    shadow: { type: "outer", color: HEX.dk1, opacity: 1, blur: 0, offset: 5, angle: 45 } });
  return { x: px, y: py, w, h };
}
const slide = (master, section) => { const sl = pres.addSlide({ masterName: master, sectionTitle: section }); sl._dark = master === "Kaagaz Dark"; return sl; };
// Kicker (handwritten, margin red) + title, at the same place on every slide.
function heading(s, kicker, title) {
  text(s, kicker, { x: 0.6, y: 0.4, w: 12.1, h: 0.45, fontFace: HAND, fontSize: s._dark ? 20 : 18, color: s._dark ? "FF8A70" : C.accent2 });
  if (title) s.addText(title, { isTextBox: true, margin: 0, x: 0.6, y: 0.85, w: 12.1, h: 0.95, valign: "top", fontFace: THEME.headFontFace, fontSize: s._dark ? 40 : 36, bold: true, color: s._dark ? C.background2 : C.text1, objectName: "title" });
}

// =====================================================================
pres.addSection({ title: "The problem" });

// 1 · Cover
{
  const s = slide("Kaagaz Dark", "The problem");
  heading(s, "Bridge the Gap · Devlympics Shunya 2026");
  text(s, "Kaagaz", { x: 0.6, y: 1.55, w: 7, h: 1.4, fontFace: THEME.headFontFace, fontSize: 88, bold: true, color: C.background2 });
  text(s, "Paper that talks back", { x: 0.6, y: 2.95, w: 7.2, h: 0.9, fontFace: THEME.headFontFace, fontSize: 40, bold: true, color: C.accent1 });
  text(s, "One photo of the register a village health worker already keeps becomes live, triaged health data, and the doctor’s advice comes back to her in Hindi, by voice.",
    { x: 0.6, y: 4.0, w: 6.6, h: 1.4, fontSize: 18, color: "CFC6B0", lineSpacingMultiple: 1.15 });
  text(s, "[Team name] · [Member names]", { x: 0.6, y: 6.2, w: 6.6, h: 0.4, fontSize: 14, color: "9B93B8" });
  photo(s, "sample1.png", 8.3, 0.7, 4.2, 5.9, { rotate: 3, alt: "Photo of a handwritten ASHA register page" });
  s.addNotes("Kaagaz means paper. We built a bridge between India’s village health workers and their doctors, made of the paper they already use. (Fill in team name and members before presenting.)");
}

// 2 · The gap in numbers
{
  const s = slide("Kaagaz Content", "The problem");
  heading(s, "The gap", "Village health lives on paper");
  const stats = [
    ["1M+", "ASHA workers record rural India’s health", "National Health Mission"],
    ["11", "paper registers one ASHA may keep", "KhushiHealth · MIT Solve"],
    ["2 days", "for one ASHA to enter 200 TB patients into an app", "New Lines Magazine"],
  ];
  stats.forEach(([n, l, src], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 2.15, 3.8, 3.4, i === 2 ? C.accent1 : C.background1, "stat-" + i);
    text(s, n, { x: x + 0.3, y: 2.45, w: 3.2, h: 1.2, fontFace: THEME.headFontFace, fontSize: 60, bold: true, color: i === 2 ? C.text1 : C.accent2 });
    text(s, l, { x: x + 0.3, y: 3.75, w: 3.2, h: 1.0, fontSize: 18, color: C.text1 });
    text(s, src, { x: x + 0.3, y: 4.9, w: 3.2, h: 0.4, fontSize: 12, color: C.accent6, italic: true });
  });
  text(s, "Digitisation so far has added work: paper is never phased out, so workers do everything twice.", { x: 0.6, y: 5.85, w: 12.1, h: 0.6, fontSize: 18, color: C.accent6 });
  s.addNotes("A million ASHA workers write village health on paper. They may keep up to eleven registers. Every app added so far has meant more typing, not less; one worker told New Lines that entering 200 TB patients took almost two days. And the doctor sees the data weeks later; nothing goes back to the village.");
}

// 3 · Two sides
{
  const s = slide("Kaagaz Content", "The problem");
  heading(s, "Two sides", "They should talk every day. Today, they can’t");
  const side = (x, fill, head, sub, items, name) => {
    card(s, x, 2.1, 5.0, 3.5, fill, name);
    text(s, head, { x: x + 0.35, y: 2.35, w: 4.3, h: 0.6, fontFace: THEME.headFontFace, fontSize: 26, bold: true });
    text(s, sub, { x: x + 0.35, y: 2.95, w: 4.3, h: 0.4, fontSize: 14, color: C.accent6 });
    text(s, items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })), { x: x + 0.35, y: 3.5, w: 4.3, h: 2.6, fontSize: 17, paraSpaceAfter: 8 });
  };
  side(0.6, "FFF3CF", "ASHA worker", "village · paper · Hindi · low signal", ["Writes everything on paper", "Sees danger signs first", "No doctor to ask", "Often no data connection"], "side-asha");
  side(7.7, C.background1, "District doctor", "town · dashboards · English", ["Gets data weeks late", "Can’t see who needs help today", "Spots outbreaks too late", "No way to reply to the village"], "side-doctor");
  s.addShape(pres.shapes.LINE, { x: 5.75, y: 3.9, w: 1.8, h: 0, line: { color: C.accent2, width: 3, dashType: "dash" }, objectName: "broken-bridge" });
  text(s, "~3 weeks\none way", { x: 5.65, y: 4.15, w: 2.0, h: 0.9, fontSize: 18, bold: true, color: C.accent2, align: "center" });
  s.addNotes("One side holds the information, the other holds the expertise. Between them: paper, a monthly reporting cycle, and roughly three weeks of delay. Nothing crosses back.");
}

// =====================================================================
pres.addSection({ title: "Why it isn’t solved" });

// 4 · Competitors
{
  const s = slide("Kaagaz Content", "Why it isn’t solved");
  heading(s, "What exists today", "Every tool so far adds an app");
  const H = (t) => ({ text: t, options: { bold: true, color: C.background1, fill: { color: C.text1 }, fontSize: 15 } });
  const R = (a, b, c, us) => [a, b, c].map((t, i) => ({ text: t, options: { fontSize: 14, bold: us || i === 0, color: C.text1, fill: { color: us ? C.accent1 : C.background1 } } }));
  s.addTable([
    [H("Who"), H("What they do"), H("Where it breaks")],
    R("ANMOL · RCH portal (MoHFW)", "Tablet app for ANMs", "75.6% of surveyed staff rated it very difficult to use"),
    R("SAMASTA (Karnataka)", "Digital ASHA diary, 485 → 134 fields (reported)", "Still typing; earlier rollout failed on signal and training"),
    R("Khushi Baby · CommCare", "Offline forms, NFC records", "Worker becomes a form filler; data flows one way"),
    R("Wadhwani AI", "Single-task AI assistants", "A separate app per task; registers untouched"),
    R("Doxper · Ninx", "Digital pen; Gemini reads documents", "Special hardware, or one-way with no worker loop"),
    R("WhatsApp groups", "What workers actually use", "Duplicate reporting, privacy risk"),
    R("Kaagaz", "Reads the paper she already keeps", "0 new typing · two-way · FHIR into ABDM", true),
  ], { x: 0.6, y: 2.0, w: 12.1, colW: [3.4, 3.9, 4.8], border: { type: "solid", color: HEX.dk1, pt: 1 }, rowH: 0.52, valign: "middle", margin: 0.08, fontFace: THEME.bodyFontFace });
  s.addNotes("We studied every tool in this space. Government apps, NGO platforms and AI tools all share one move: they add an app. Sources are in our README: the ANMOL usability study, SAMASTA coverage, Khushi Baby and CommCare documentation, Wadhwani AI, Doxper, and Ninx from the Gemini competition.");
}

// 5 · Loopholes → our answer
{
  const s = slide("Kaagaz Content", "Why it isn’t solved");
  heading(s, "The loopholes they share", "Five gaps, five answers");
  const rows = [
    ["More typing, not less", "The paper is the input: zero new typing"],
    ["Data flows one way", "Advice comes back as a Hindi voice note"],
    ["Every app is a silo", "Standard FHIR R4 records for ABDM"],
    ["Needs signal and skill", "SMS replies, offline queue, speak instead of write"],
    ["Black-box AI", "The evidence glows on the handwriting"],
  ];
  rows.forEach(([gap, ans], i) => {
    const y = 2.05 + i * 0.92;
    card(s, 0.6, y, 5.4, 0.72, C.background1, "gap-" + i);
    text(s, `${i + 1}`, { x: 0.8, y: y + 0.12, w: 0.5, h: 0.5, fontFace: THEME.headFontFace, fontSize: 24, bold: true, color: C.accent2 });
    text(s, gap, { x: 1.35, y: y + 0.18, w: 4.5, h: 0.45, fontSize: 18, bold: true });
    s.addShape(pres.shapes.RIGHT_ARROW, { x: 6.2, y: y + 0.2, w: 0.6, h: 0.34, fill: { color: C.text1 }, line: { color: C.text1 }, objectName: "arrow-" + i });
    card(s, 7.0, y, 5.7, 0.72, C.accent1, "answer-" + i);
    text(s, ans, { x: 7.25, y: y + 0.18, w: 5.3, h: 0.45, fontSize: 18 });
  });
  s.addNotes("Five loopholes, and Kaagaz answers each one. No new typing; help comes back; standard records instead of a silo; it works on SMS and offline; and the AI shows its evidence.");
}

// =====================================================================
pres.addSection({ title: "How Kaagaz works" });

// 6 · The bridge
{
  const s = slide("Kaagaz Content", "How Kaagaz works");
  heading(s, "The bridge", "Keep the paper. Lose the delay");
  const steps = [
    ["1", "Snap", "The ASHA photographs today’s register page. No typing, no forms.", C.background1],
    ["2", "AI reads", "Gemini reads Hindi and English handwriting and flags danger signs.", C.background1],
    ["3", "Doctor acts", "Urgent patients first. Advice or referral in one tap.", C.background1],
    ["4", "Voice back", "A Hindi voice note on her phone. She replies by speaking.", "E1EFD9"],
  ];
  steps.forEach(([n, h, d, fill], i) => {
    const x = 0.6 + i * 3.1;
    card(s, x, 2.25, 2.75, 2.9, fill, "step-" + n);
    pill(s, n, x + 0.25, 2.0, 0.6, C.accent1, C.text1, "step-num-" + n);
    text(s, h, { x: x + 0.25, y: 2.7, w: 2.3, h: 0.6, fontFace: THEME.headFontFace, fontSize: 24, bold: true });
    text(s, d, { x: x + 0.25, y: 3.4, w: 2.3, h: 2.2, fontSize: 16, color: C.accent6 });
    if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.78, y: 3.85, w: 0.3, h: 0.3, fill: { color: C.text1 }, line: { color: C.text1 }, objectName: "flow-arrow-" + n });
  });
  text(s, "Up as a photo, back down as a voice: the bridge works both ways.", { x: 0.6, y: 5.6, w: 12.1, h: 0.5, fontSize: 20, bold: true });
  s.addNotes("One photo goes up. Help comes back down, in Hindi, by voice.");
}

// 7 · X-ray
{
  const s = slide("Kaagaz Content", "How Kaagaz works");
  heading(s, "Step 1 · Paper to AI", "The AI shows why a patient is urgent");
  photo(s, "pitch/xray.png", 7.6, 1.95, 5.1, 4.75, { alt: "Register photo with danger words highlighted in red" });
  const pts = [
    ["Reads every row", "Hindi, English and Hinglish handwriting, with a confidence score per row."],
    ["Highlights the evidence", "“BP 150/100” and “pair me sujan” (swollen feet) glow red: possible pre-eclampsia."],
    ["Flags what it isn’t sure of", "Low-confidence rows go to a human, shown beside the original handwriting."],
  ];
  pts.forEach(([h, d], i) => {
    const y = 2.1 + i * 1.5;
    text(s, h, { x: 0.6, y, w: 6.5, h: 0.5, fontFace: THEME.headFontFace, fontSize: 22, bold: true, color: i === 1 ? C.accent2 : C.text1 });
    text(s, d, { x: 0.6, y: y + 0.5, w: 6.5, h: 0.85, fontSize: 17, color: C.text1 });
  });
  s.addNotes("Gemini reads the handwriting and shows why someone is urgent: BP 150 over 100 and swollen feet, glowing right on the page. No black box.");
}

// 8 · Asks back + doctor checks
{
  const s = slide("Kaagaz Content", "How Kaagaz works");
  heading(s, "Steps 2 and 3", "AI asks, a human checks");
  photo(s, "pitch/ask.png", 0.6, 2.0, 5.6, 3.3, { alt: "Phone asking a follow-up question in Hindi" });
  text(s, "Something missing? The phone asks the ASHA out loud in Hindi. She says “हाँ” and Ramesh becomes urgent on the doctor’s screen.",
    { x: 0.6, y: 5.5, w: 5.6, h: 1.1, fontSize: 16 });
  photo(s, "pitch/doctor-modal.png", 7.0, 1.95, 3.2, 4.75, { alt: "Doctor comparing the AI reading with the handwriting" });
  text(s, "The doctor sees the AI’s reading next to the real handwriting, corrects it, then sends advice.", { x: 10.45, y: 2.3, w: 2.3, h: 2.6, fontSize: 16 });
  text(s, "AI suggests. The doctor decides.", { x: 10.45, y: 5.0, w: 2.3, h: 1.0, fontSize: 18, bold: true, color: C.accent2 });
  s.addNotes("If a detail would change the decision, the phone asks the worker out loud. Then a doctor always checks the AI against the original handwriting before acting.");
}

// 9 · Talks back
{
  const s = slide("Kaagaz Content", "How Kaagaz works");
  heading(s, "Step 4 · Back to the village", "The paper talks back");
  photo(s, "pitch/ink.png", 0.6, 1.95, 4.0, 4.75, { alt: "Doctor’s reply handwritten in the margin of the register photo" });
  photo(s, "pitch/inbox.png", 5.0, 2.1, 4.0, 2.4, { alt: "Hindi voice note on the ASHA’s phone" });
  text(s, [{ text: "“सुनीता जी को आज ही PHC ले जाएँ।”", options: { fontFace: HINDI, breakLine: true } }, { text: "Arrives as a Hindi voice note, and the doctor’s reply is written in ink into the margin of her own page.", options: {} }],
    { x: 5.0, y: 4.8, w: 4.0, h: 1.8, fontSize: 16 });
  card(s, 9.4, 2.1, 3.3, 3.2, "E1EFD9", "reply-card");
  text(s, "She replies by voice", { x: 9.65, y: 2.35, w: 2.8, h: 0.5, fontFace: THEME.headFontFace, fontSize: 20, bold: true });
  text(s, "“हाँ, अभी जा रही हूँ”", { x: 9.65, y: 2.95, w: 2.8, h: 0.6, fontFace: HINDI, fontSize: 20, color: C.accent3, bold: true });
  text(s, "The doctor sees: Sent → Heard → Replied. The loop is closed.", { x: 9.65, y: 3.7, w: 2.8, h: 1.4, fontSize: 15 });
  s.addNotes("Her phone speaks the instruction, and the doctor’s reply appears in ink on her own page. She answers by voice, and the doctor sees it.");
}

// =====================================================================
pres.addSection({ title: "Real world" });

// 10 · Built for villages
{
  const s = slide("Kaagaz Content", "Real world");
  heading(s, "Built for real villages", "Works where the network doesn’t");
  const feats = [
    ["pitch/sms.png", "SMS-only phones", "Advice arrives as an SMS; reply with one key: 1, 2 or 3."],
    ["pitch/voice.png", "Speak, don’t write", "Say the visit in Hindi; it becomes a triaged record."],
    ["pitch/stamp.png", "QR page stamp", "A sticker on the paper opens its digital record."],
    ["pitch/map.png", "Outbreak alarm", "3 fever cases in one village raise an alarm early."],
  ];
  feats.forEach(([f, h, d], i) => {
    const x = 0.6 + i * 3.1;
    card(s, x, 2.0, 2.8, 3.7, C.background1, "feat-" + i);
    photo(s, f, x + 0.2, 2.2, 2.4, 1.6, { alt: h });
    text(s, h, { x: x + 0.2, y: 4.05, w: 2.4, h: 0.5, fontFace: THEME.headFontFace, fontSize: 19, bold: true });
    text(s, d, { x: x + 0.2, y: 4.6, w: 2.4, h: 1.7, fontSize: 15, color: C.accent6 });
  });
  s.addNotes("No data? It works by SMS. Can’t write? She speaks. Offline? Pages queue on the phone and sync later. The app installs on the phone and opens with zero signal.");
}

// 11 · Standards and trust
{
  const s = slide("Kaagaz Content", "Real world");
  heading(s, "Standards and safety", "Feeds the national system, not another silo");
  card(s, 0.6, 2.0, 6.0, 4.6, C.background1, "fhir-card");
  text(s, "HL7 FHIR R4, shaped to ABDM", { x: 0.9, y: 2.25, w: 5.4, h: 0.5, fontFace: THEME.headFontFace, fontSize: 22, bold: true });
  text(s, "One document per patient, built on NRCeS profiles:", { x: 0.9, y: 2.8, w: 5.4, h: 0.4, fontSize: 15, color: C.accent6 });
  const res = ["Patient", "Encounter", "Observation (LOINC)", "RiskAssessment", "Provenance", "DocumentReference", "Communication"];
  res.forEach((r, i) => pill(s, r, 0.9 + (i % 2) * 2.75, 3.35 + Math.floor(i / 2) * 0.55, 2.55, "FFF3CF", C.text1, "res-" + i));
  text(s, "Validated against the official HL7 FHIR R4 schema. Not yet certified in the ABDM sandbox.", { x: 0.9, y: 5.65, w: 5.4, h: 0.8, fontSize: 14, italic: true, color: C.accent6 });
  const trust = [
    ["AI suggests, the doctor decides", "Triage stays preliminary until a doctor confirms it."],
    ["Advice, never a prescription", "A remote doctor who hasn’t examined the patient gives advice or referral only."],
    ["Every value traces to paper", "Provenance: ASHA wrote it, AI read it, doctor verified it."],
    ["Privacy on the projector", "One tap hides every patient name."],
  ];
  trust.forEach(([h, d], i) => {
    const y = 2.05 + i * 1.15;
    text(s, h, { x: 7.0, y, w: 5.7, h: 0.45, fontSize: 19, bold: true, color: i === 1 ? C.accent2 : C.text1 });
    text(s, d, { x: 7.0, y: y + 0.45, w: 5.7, h: 0.6, fontSize: 15, color: C.accent6 });
  });
  s.addNotes("Every page exports as standard FHIR R4 records shaped to India’s ABDM profiles, validated against the official HL7 schema. The doctor’s message is advice or referral, never a prescription, and every value traces back to the original paper.");
}

// =====================================================================
pres.addSection({ title: "Impact" });

// 12 · The number
{
  const s = slide("Kaagaz Dark", "Impact");
  heading(s, "The one number", "Paper → doctor → voice → reply");
  text(s, "~3 weeks", { x: 0.6, y: 2.6, w: 5.4, h: 1.6, fontFace: HAND, fontSize: 72, color: "F28B82", align: "center", strike: "sngStrike" });
  text(s, "today · one way", { x: 0.6, y: 4.3, w: 5.4, h: 0.5, fontSize: 18, color: "CFC6B0", align: "center" });
  s.addShape(pres.shapes.RIGHT_ARROW, { x: 6.2, y: 3.15, w: 0.9, h: 0.5, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: "number-arrow" });
  text(s, "0:21", { x: 7.3, y: 2.3, w: 5.4, h: 2.0, fontFace: THEME.headFontFace, fontSize: 120, bold: true, color: C.accent1, align: "center" });
  text(s, "with Kaagaz · both ways · measured in our live demo", { x: 7.3, y: 4.3, w: 5.4, h: 0.5, fontSize: 18, color: "CFC6B0", align: "center" });
  text(s, "From weeks to seconds, and for the first time, the village hears back.", { x: 0.6, y: 5.6, w: 12.1, h: 0.6, fontSize: 22, bold: true, color: C.background2, align: "center" });
  s.addNotes("Three weeks, one way. Twenty-one seconds, both ways: that is the full loop from paper to doctor to voice to reply, timed live in our demo.");
}

// 13 · Path to scale
{
  const s = slide("Kaagaz Content", "Impact");
  heading(s, "What’s next", "From one PHC to any paper register");
  const cols = [
    ["Pilot", "[1 PHC · __ ASHAs · __ months]", "Measure: read accuracy on real pages, time to doctor, replies closed."],
    ["Integrate", "ABDM sandbox certification", "Push FHIR records into state HMIS / ABHA-linked records."],
    ["Extend", "Any paper register", "Anganwadi, school attendance, ration shops: same bridge, new form."],
  ];
  cols.forEach(([h, sub, d], i) => {
    const x = 0.6 + i * 4.1;
    card(s, x, 2.0, 3.8, 2.9, i === 0 ? C.accent1 : C.background1, "next-" + i);
    text(s, h, { x: x + 0.3, y: 2.25, w: 3.2, h: 0.6, fontFace: THEME.headFontFace, fontSize: 26, bold: true });
    text(s, sub, { x: x + 0.3, y: 2.9, w: 3.2, h: 0.8, fontSize: 16, bold: true, color: i === 0 ? C.text1 : C.accent2 });
    text(s, d, { x: x + 0.3, y: 3.75, w: 3.2, h: 1.5, fontSize: 16 });
  });
  card(s, 0.6, 5.25, 12.1, 0.8, C.background1, "cost-card");
  text(s, [{ text: "No new hardware, no new habits. ", options: { bold: true } }, { text: "Runs on the phones ASHAs already carry. Cost per page: [₹__ on Gemini Flash].", options: {} }],
    { x: 0.9, y: 5.43, w: 11.6, h: 0.5, fontSize: 17 });
  s.addNotes("Next: a pilot at one PHC, then ABDM sandbox certification, then any paper register: anganwadi, school, ration. Fill in the pilot size and the per-page cost before presenting.");
}

// 14 · Close
{
  const s = slide("Kaagaz Dark", "Impact");
  heading(s, "Kaagaz · कागज़");
  text(s, "Same paper. Same worker.", { x: 0.6, y: 1.9, w: 12.1, h: 1.1, fontFace: THEME.headFontFace, fontSize: 54, bold: true, color: C.background2 });
  text(s, "Now the paper talks back", { x: 0.6, y: 3.0, w: 12.1, h: 1.1, fontFace: THEME.headFontFace, fontSize: 54, bold: true, color: C.accent1 });
  const chips = ["Gemini 2.5 Flash Vision", "HL7 FHIR R4 · ABDM", "Web Speech · Hindi", "Offline PWA", "Open source"];
  let x = 0.6; chips.forEach((c, i) => { const w = 0.3 + c.length * 0.115; pill(s, c, x, 4.6, w, C.background1, C.text1, "chip-" + i); x += w + 0.2; });
  text(s, "github.com/ash41106/Devlympics · [Team name]", { x: 0.6, y: 5.6, w: 12.1, h: 0.5, fontSize: 18, color: "CFC6B0" });
  s.addNotes("Same paper. Same worker. Now the paper talks back. Then switch to the live demo on the Live Bridge.");
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("✓ " + OUT);
})();
