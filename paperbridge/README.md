# Kaagaz: paper that talks back

Devlympics Shunya 2026 · PS: **Bridge the Gap**

**Two sides:** a million ASHA health workers who record rural India's health on paper, and the district doctors who see that data ~21 days later, if ever. Nothing flows back.
**Between them:** Kaagaz. One photo of the register they already keep → Gemini reads the Hindi handwriting → the doctor sees who is in danger → one tap sends a Hindi voice instruction → the worker replies by speaking.
**The one number:** the Live Bridge times the full loop on stage. **21 days, one way → under a minute, both ways.**

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
