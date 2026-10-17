// Paper page -> HL7 FHIR R4 document Bundle, shaped after India's ABDM / NRCeS implementation guide
// (DocumentBundle + WellnessRecord-style Composition). Every value keeps a link back to the original paper photo.
const crypto = require("crypto");

const NRCES = "https://nrces.in/ndhm/fhir/r4/StructureDefinition/";
const uuid = () => crypto.randomUUID();
const LOINC = "http://loinc.org", SNOMED = "http://snomed.info/sct";

// Pull measurable vitals out of the free-text note (what the ASHA actually wrote).
function vitals(e) {
  const t = `${e.note || ""} ${e.spoken || ""}`;
  const out = [];
  const bp = t.match(/BP\s*(\d{2,3})\s*\/\s*(\d{2,3})/i);
  if (bp) out.push({ code: [LOINC, "85354-9", "Blood pressure panel"], components: [[LOINC, "8480-6", "Systolic blood pressure", +bp[1]], [LOINC, "8462-4", "Diastolic blood pressure", +bp[2]]], unit: "mm[Hg]" });
  const wt = t.match(/(\d{1,3}(?:\.\d)?)\s*kg/i);
  if (wt) out.push({ code: [LOINC, "29463-7", "Body weight"], value: +wt[1], unit: "kg" });
  const muac = t.match(/MUAC\s*(red|laal|लाल|yellow|peela|पीला|green|hara|हरा)/i);
  if (muac) { const c = /red|laal|लाल/i.test(muac[1]) ? "red (<11.5 cm)" : /yellow|peela|पीला/i.test(muac[1]) ? "yellow (11.5–12.5 cm)" : "green (>12.5 cm)";
    out.push({ code: [LOINC, "56072-2", "Circumference Mid upper arm - left"], text: `MUAC tape ${c}` }); }
  const fever = e.feverDays ?? +((t.match(/(\d+)\s*(?:day|din|दिन)/i) || [])[1] || 0);
  if (e.category === "fever" && fever) out.push({ code: [SNOMED, "386661006", "Fever"], value: fever, unit: "d", text: `Fever for ${fever} days` });
  return out;
}

const RISK_CODE = { high: ["H", "High"], medium: ["M", "Medium"], low: ["L", "Low"] };

function patientBundle(entries, alerts, origin) {
  const now = new Date().toISOString();
  const res = [], ref = (r) => `urn:uuid:${r.id}`;
  const add = (r) => (res.push(r), r);
  const first = entries[0];
  const org = add({ resourceType: "Organization", id: uuid(), meta: { profile: [NRCES + "Organization"] }, name: "Sonpur Block PHC (Kaagaz pilot)" });
  const asha = add({ resourceType: "Practitioner", id: uuid(), meta: { profile: [NRCES + "Practitioner"] },
    name: [{ text: String(first.worker || "ASHA").split("·")[0].trim() }], qualification: [{ code: { text: "Accredited Social Health Activist (ASHA)" } }] });
  // The original paper is part of the record: a scanned page is the source of truth a doctor can always go back to.
  const paper = first.src ? add({ resourceType: "DocumentReference", id: uuid(), meta: { profile: [NRCES + "DocumentReference"] }, status: "current",
    type: { text: "Handwritten ASHA register page (photo)" }, date: new Date(first.at).toISOString(), author: [{ reference: ref(asha) }],
    content: [{ attachment: { contentType: first.src.endsWith(".png") ? "image/png" : "image/jpeg", url: origin + first.src, title: "Original paper page" } }] }) : null;

  const sections = [];
  for (const e of entries) {
    const pat = add({ resourceType: "Patient", id: uuid(), meta: { profile: [NRCES + "Patient"] }, name: [{ text: e.name }],
      gender: e.gender === "F" ? "female" : e.gender === "M" ? "male" : "unknown", address: [{ text: e.village, district: "Sonpur" }],
      ...(e.age != null ? { extension: [{ url: "http://hl7.org/fhir/StructureDefinition/patient-age", valueAge: { value: e.age, unit: "a", system: "http://unitsofmeasure.org", code: "a" } }] } : {}) });
    const enc = add({ resourceType: "Encounter", id: uuid(), meta: { profile: [NRCES + "Encounter"] }, status: "finished",
      class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "HH", display: "home health" },
      subject: { reference: ref(pat) }, participant: [{ individual: { reference: ref(asha) } }], period: { start: new Date(e.at).toISOString() },
      reasonCode: [{ text: e.category }] });
    const obs = vitals(e).map((v) => add({ resourceType: "Observation", id: uuid(), meta: { profile: [NRCES + "Observation"] }, status: e.verified && e.verifiedAt ? "final" : "preliminary",
      code: { coding: [{ system: v.code[0], code: v.code[1], display: v.code[2] }], text: v.code[2] }, subject: { reference: ref(pat) }, encounter: { reference: ref(enc) },
      effectiveDateTime: new Date(e.at).toISOString(), performer: [{ reference: ref(asha) }],
      ...(v.value != null ? { valueQuantity: { value: v.value, unit: v.unit, system: "http://unitsofmeasure.org", code: v.unit } } : {}),
      ...(v.text && v.value == null ? { valueString: v.text } : {}),
      ...(v.components ? { component: v.components.map(([s, c, d, val]) => ({ code: { coding: [{ system: s, code: c, display: d }] }, valueQuantity: { value: val, unit: v.unit, system: "http://unitsofmeasure.org", code: v.unit } })) } : {}),
      ...(paper ? { derivedFrom: [{ reference: ref(paper) }] } : {}) }));
    // Triage is a decision-support flag, not a diagnosis: RiskAssessment, preliminary until a doctor confirms it.
    const risk = add({ resourceType: "RiskAssessment", id: uuid(), status: e.verifiedAt ? "final" : "preliminary", subject: { reference: ref(pat) }, encounter: { reference: ref(enc) },
      occurrenceDateTime: new Date(e.at).toISOString(), basis: obs.map((o) => ({ reference: ref(o) })),
      prediction: [{ outcome: { text: e.reason }, qualitativeRisk: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/risk-probability", code: { high: "high", medium: "moderate", low: "low" }[e.risk] || "low" }], text: RISK_CODE[e.risk]?.[1] } }],
      note: [{ text: `Evidence on paper: ${(e.evidence || []).map((v) => `"${v.text}"`).join(", ") || "none"} · AI confidence ${Math.round((e.confidence ?? 1) * 100)}%` }] });
    // Provenance: who wrote it (ASHA, on paper), what read it (AI), who checked it (doctor).
    add({ resourceType: "Provenance", id: uuid(), target: [...obs, risk].map((r) => ({ reference: ref(r) })), recorded: now,
      agent: [
        { type: { text: "author" }, who: { reference: ref(asha) } },
        { type: { text: "assembler" }, who: { display: "Kaagaz · Gemini Vision handwriting extraction" } },
        ...(e.verifiedAt ? [{ type: { text: "verifier" }, who: { display: "District doctor" } }] : []),
      ], ...(paper ? { entity: [{ role: "source", what: { reference: ref(paper) } }] } : {}) });
    // The doctor's message is advice / referral sent to the ASHA, deliberately NOT a MedicationRequest:
    // a remote doctor who has not examined the patient should not prescribe through a worker.
    const msgs = alerts.filter((a) => a.entryId === e.id).map((a) => add({ resourceType: "Communication", id: uuid(), status: "completed",
      category: [{ text: "Advice / referral to frontline worker (not a prescription)" }], subject: { reference: ref(pat) }, encounter: { reference: ref(enc) },
      sent: new Date(a.at).toISOString(), recipient: [{ reference: ref(asha) }], payload: [{ contentString: a.hi }, ...(a.reply ? [{ contentString: `ASHA reply: ${a.reply}` }] : [])] }));
    sections.push({ title: `${e.name} · ${e.village}`, entry: [enc, ...obs, risk, ...msgs].map((r) => ({ reference: ref(r) })) });
  }

  const comp = { resourceType: "Composition", id: uuid(), meta: { profile: [NRCES + "WellnessRecord"] }, status: entries.every((e) => e.verifiedAt) ? "final" : "preliminary",
    type: { text: "Wellness Record" }, subject: { reference: ref(res.find((r) => r.resourceType === "Patient")) }, date: now,
    author: [{ reference: ref(asha) }, { reference: ref(org) }], title: "ASHA home-visit register page (digitised from paper)", custodian: { reference: ref(org) },
    section: sections };
  return { resourceType: "Bundle", id: uuid(), meta: { profile: [NRCES + "DocumentBundle"], lastUpdated: now }, identifier: { system: "https://kaagaz.local/page", value: first.scanId },
    type: "document", timestamp: now, entry: [comp, ...res].map((r) => ({ fullUrl: ref(r), resource: r })) };
}

// Structural self-check: every reference resolves inside the bundle, every entry has a type and id.
function check(bundle) {
  const urls = new Set(bundle.entry.map((x) => x.fullUrl)), problems = [];
  const walk = (o, at) => { if (!o || typeof o !== "object") return; for (const [k, v] of Object.entries(o)) {
    if (k === "reference" && typeof v === "string" && v.startsWith("urn:uuid:") && !urls.has(v)) problems.push(`${at}: dangling ${v}`); else walk(v, at); } };
  bundle.entry.forEach((x) => { if (!x.resource.resourceType || !x.resource.id) problems.push("entry without type/id"); walk(x.resource, x.resource.resourceType); });
  if (bundle.entry[0].resource.resourceType !== "Composition") problems.push("document Bundle must start with a Composition");
  return problems;
}

module.exports = { patientBundle, check };
