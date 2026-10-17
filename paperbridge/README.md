# Kaagaz: paper that talks back

Devlympics Shunya 2026 · PS: **Bridge the Gap**

**Two sides:** a million ASHA health workers who record rural India's health on paper, and the district doctors who see that data ~21 days later, if ever. Nothing flows back.
**Between them:** Kaagaz. One photo of the register they already keep → Gemini reads the Hindi handwriting → the doctor sees who is in danger → one tap sends a Hindi voice instruction → the worker replies by speaking.
**The one number:** the Live Bridge times the full loop on stage. **21 days, one way → under a minute, both ways.**

## Competitors and the gap they leave
| Who | What they do | Where it breaks in the field |
|---|---|---|
| **ANMOL / RCH portal** (MoHFW) | Tablet app for ANMs, syncs when online | 75.6% of surveyed staff rated ANMOL *very difficult* to use (Chandigarh study, 2022) |
| **SAMASTA** (Karnataka, 2025) | Digital ASHA diary: 485 manual fields → 134 | Still typing. Karnataka's earlier digitisation failed: no internet, no training, paper never phased out |
| **Khushi Baby** | Offline app + NFC necklace | ASHA still enters fields by hand; another app to carry |
| **Dimagi CommCare** | Offline forms + case management, 700k+ workers | Turns the health worker into a form filler; data flows one way |
| **Wadhwani AI** (HealthVaani, Shishu Maapan) | AI assistants for single tasks | Point tools, each a separate app; registers untouched |
| **Doxper** | Digital pen on encoded paper | Special pen and paper; built for clinics |
| **Ninx** (Gemini competition, Uganda) | Gemini reads medical documents for patients | One way, no triage, no worker loop, no standard export |
| **WhatsApp groups** (informal) | What workers actually use today | Duplicate reporting, privacy risk, "triple burden" (PMC study) |

**The five loopholes they share**
1. **More typing, not less.** Paper is never phased out, so workers do everything twice (Ideas for India; New Lines: 200 TB patients took two days to enter).
2. **One way.** Data goes up; nothing useful comes back to the village.
3. **Silos.** Every app is its own database.
4. **Needs signal and smartphone skill.**
5. **Black-box AI.** A doctor can't see why a patient was flagged.

**What Kaagaz does differently:** zero new typing (the paper *is* the input) · two-way (advice back by Hindi voice, ink on the page) · **HL7 FHIR R4 export shaped to ABDM / NRCeS**, so it feeds the national system instead of becoming another silo · SMS and offline fallback · the evidence glows on the handwriting itself.

**Positioning:** everyone else builds a *new app* for health. Kaagaz is the opposite: **no new app for the worker, no new database for the government.** It is the bridge between two things that already exist: the paper register and India's digital health stack.

Sources: [WhatsApp triple burden (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12428105/) · [New Lines](https://newlinesmag.com/reportage/indias-digital-health-push-is-overworking-its-front-line-women/) · [Ideas for India](https://www.ideasforindia.in/topics/productivity-innovation/is-digitalisation-a-double-edged-sword-for-workers-in-indias-public-healthcare-system) · [SAMASTA (GKToday)](https://www.gktoday.in/karnataka-approves-samasta-for-health-record-digitisation/) · [Karnataka earlier failure (Think Global Health)](https://www.thinkglobalhealth.org/article/how-india-can-achieve-universal-health-coverage) · [ANMOL usability (PMC table)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12377784/table/T5) · [Khushi Baby (MIT Solve)](https://solve.mit.edu/solutions/28855) · [CommCare](https://commcare.dimagi.com/platform/) · [Wadhwani AI (YourStory)](https://cwv.yourstory.com/herstory/2025/03/ai-tool-asha-workers-monitor-newborn-health) · [Doxper / AI pen (IndiaAI)](https://indiaai.gov.in/article/how-an-ai-powered-pen-helps-health-workers-to-digitise-patient-records) · [Ninx](https://ai.google.dev/competition/projects/ninx) · [ABDM FHIR IG (NRCeS)](https://www.nrces.in/ndhm/fhir/r4/profiles.html)

## Standards: FHIR R4 (ABDM)
Every page exports as HL7 FHIR R4: one `DocumentBundle` per patient with a `WellnessRecord` Composition (NRCeS profile URLs), `Patient`, `Practitioner` (the ASHA), `Encounter` (home visit), LOINC-coded `Observation`s parsed from the handwriting (BP panel, weight, MUAC), a `RiskAssessment` (triage is decision support, *preliminary* until a doctor confirms), `Provenance` (ASHA wrote it → AI read it → doctor verified it), a `DocumentReference` to the **original paper photo**, and the doctor's message as a `Communication`, deliberately **not** a `MedicationRequest`: a remote doctor who hasn't examined the patient gives advice or referral, not a prescription.
- `GET /api/fhir?scan=<page>` · `GET /api/fhir?entry=<patient>` · buttons in the doctor popup and on the QR page record
- `python tools/fhir_validate.py` validates against the **official HL7 FHIR R4 JSON schema** (passes; a deliberately broken field is caught). Example: [`fhir-example.json`](fhir-example.json)
- Honest scope: shaped to the NRCeS profiles and schema-valid; not yet certified through the ABDM sandbox.

## Pages
| Page | What it does |
|---|---|
| `/` Home | The gap and the bridge, in 60 seconds of scrolling |
| `/bridge.html` Live Bridge | **Projector page.** Phone + doctor screen, packets crossing, loop clock, finale |
| `/field.html` ASHA App | Snap paper, offline queue, Hindi voice inbox + voice reply |
| `/page.html?scan=…` Page record | Opened by scanning the QR stamp stuck on the paper page |
| `/doctor.html` Doctor | Triage, human check of unsure rows, outbreak alarm, one-tap Hindi voice instruction |

## Run
Double-click **`run.bat`** (or `node server.js`). No npm install, Node 18+ only.
- Laptop / projector: `http://localhost:3000/bridge.html`
- ASHA phone (same Wi-Fi or hotspot): the **`https://<laptop-ip>:3443/field.html`** URL printed in the console. Tap *Advanced → Proceed* once (self-signed certificate). HTTPS is what lets the phone use the **mic, offline install and vibration**.
- On the phone, tap **📲 Install Kaagaz**: it then opens from the home screen, even with zero signal.
- Data survives restarts (`data/`). *Start over* on the doctor page clears it.
- Live mode: put a Gemini key in `key.txt` (git-ignored). Without one, demo mode uses two photo-realistic sample pages whose boxes were measured, not guessed.

## Verify before going on stage
```
node tools/e2e.js     # real headless browser runs the whole loop: 14 checks + screenshots in e2e-shots/
node tools/eval.js    # (live mode) Gemini accuracy on your own handwritten pages in testpages/
```
If the laptop says no Hindi voice, the app shows exactly where to install one (Windows: Settings › Time & language › Speech).

## 90-second demo script
1. **Gap (15s):** "ASHA workers keep up to 11 paper registers. Doctors see it about 21 days later. Nothing ever comes back." Open the Live Bridge.
2. **Paper → doctor (25s):** On the phone, snap a real Hindi register page (or tap *Sample page 1*). The loop clock starts. Names stream across the bridge, and Sunita shows up red: *pre-eclampsia risk*.
   **X-ray:** the exact words that triggered each flag ("BP 150/100", "sujan", "MUAC laal") glow red *on the handwriting*.
   **AI asks back:** the phone asks aloud "रमेश जी को उल्टी या कहीं से खून आ रहा है क्या?". The ASHA says "हाँ", and Ramesh jumps to urgent on the doctor's screen.
3. **Doctor → village (20s):** Tap *Send* on Sunita. The phone vibrates and speaks the Hindi instruction, and **the doctor's reply writes itself in ink into the margin of the ASHA's own paper** (Ink Replay).
4. **Village → doctor (15s):** The ASHA taps 🎙: "हाँ, अभी PHC ले जा रही हूँ". The clock stops and the finale appears: **21 days → 0:4x**.
5. **Close (15s):** "Same paper, same worker, no typing. Now the paper talks back." (If asked: offline mode, AI confidence + human check, and fever-cluster alarm are all live.)

**Backup moments (if judges ask):**
- *"What if there's no internet?"* → toggle **📟 Basic phone mode**: the instruction arrives as an SMS (KGZ code) and the ASHA replies with one key (1/2/3).
- *"What if they can't write?"* → **🎙 बोलकर लिखें**: speak the visit in Hindi and it becomes a triaged row.
- *"How does paper stay linked?"* → the **QR page stamp** under the scanned page opens its digital record.
- **🔊 आज का सारांश** reads out the end-of-shift summary in Hindi.

Toggle **🛡 Privacy** before projecting.

## Pitch video and slides
- **`kaagaz-pitch.mp4`**: 95-second 1080p explainer with on-screen captions (works with no sound). Play it on the projector before the live demo, or send it to judges.
- **`/pitch.html`**: the same presentation, live in the browser. Auto-plays; **Space** pauses, **← →** changes slides, **F** goes fullscreen, click to skip ahead.
- Rebuild after changes: `node tools/shots.js` (real screenshots from the running app), then `node tools/video.js` (needs `pip install imageio-ffmpeg`).

### What to say over it (one speaker, ~95s)
1. **Title:** "Kaagaz means paper. We built a bridge between India's village health workers and their doctors, made of the paper they already use."
2. **The gap:** "A million ASHA workers write village health on paper. Doctors see it about three weeks later. And nothing ever goes back."
3. **The bridge:** "One photo goes up. Help comes back down, in Hindi, by voice."
4. **X-ray:** "Gemini reads the handwriting and shows *why* someone is urgent: BP 150 over 100 and swollen feet, glowing right on the page."
5. **Asks back:** "If a detail is missing, the phone asks her out loud. She says yes, and the patient becomes urgent."
6. **Doctor:** "A human always checks the AI against the original handwriting before acting."
7. **Talks back:** "Her phone speaks the instruction, and the doctor's reply appears in ink on her own page."
8. **Real villages:** "No data? It works by SMS. Can't write? She speaks. Offline? It syncs later."
9. **The number:** "Twenty-one days, one way. Twenty-one seconds, both ways."
10. **Close:** "Same paper. Same worker. Now the paper talks back."
