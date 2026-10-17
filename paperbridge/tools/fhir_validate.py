"""Validate Kaagaz FHIR output against the official HL7 FHIR R4 JSON schema.
Usage:  python tools/fhir_validate.py [server_url]      (pip install jsonschema; schema in tools/fhir-schema/)
Creates demo data on the server, exports FHIR, validates every resource, prints a summary."""
import json, sys, urllib.request
from pathlib import Path
from jsonschema import Draft6Validator

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
schema = json.loads((Path(__file__).parent / "fhir-schema" / "fhir.schema.json").read_text(encoding="utf-8"))

def call(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"}, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

call("/api/reset", {})
page = call("/api/extract", {"demoPage": 1, "scanId": "fhirtest"})["added"]
sunita = next(e for e in page if e["name"] == "Sunita Devi")
call("/api/verify", {"id": sunita["id"], "patch": {}})                       # doctor confirms the AI reading
alert = call("/api/alert", {"name": sunita["name"], "village": sunita["village"], "worker": sunita["worker"], "risk": "high",
                            "entryId": sunita["id"], "hi": "सुनीता जी को आज ही PHC ले जाएँ। BP की जाँच ज़रूरी है।"})
call("/api/ack", {"id": alert["id"], "status": "acknowledged", "reply": "हाँ, अभी जा रही हूँ"})

bundle = call("/api/fhir?scan=fhirtest")
Path(__file__).parent.parent.joinpath("fhir-example.json").write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")

v = Draft6Validator(schema)
errors = sorted(v.iter_errors(bundle), key=lambda e: list(e.path))
counts = {}
for doc in bundle["entry"]:
    for x in doc["resource"]["entry"]:
        t = x["resource"]["resourceType"]; counts[t] = counts.get(t, 0) + 1

print(f"Bundle: collection of {bundle['total']} patient documents")
print("Resources:", ", ".join(f"{k} ×{n}" for k, n in sorted(counts.items())))
if errors:
    print(f"\n✗ {len(errors)} schema errors")
    for e in errors[:15]:
        print("  -", "/".join(map(str, e.path)), ":", e.message[:160])
    sys.exit(1)
print("\n✓ Valid against the official HL7 FHIR R4 JSON schema (fhir.schema.json)")
print("  Saved example: fhir-example.json")
