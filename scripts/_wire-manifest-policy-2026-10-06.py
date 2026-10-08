"""Wire 02 exclude/manual flags into generator + deploy (manifest-policy.json)."""
from pathlib import Path
import re

gen = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\scripts\generate-product-schema.py")
t = gen.read_text(encoding="utf-8")

fn = r'''
def write_manifest_policy(df_products, outputs_dir):
    """Durable product flags from 02 → JSON consumed by deploy (no Alan action)."""
    import json as _json
    from urllib.parse import urlparse
    excludes = []
    manuals = []
    if "url" not in df_products.columns:
        return
    has_ex = "exclude_from_manifest" in df_products.columns
    has_man = "manual_paste_page" in df_products.columns
    for _, row in df_products.iterrows():
        url = str(row.get("url") or "").strip()
        if not url:
            continue
        try:
            path_key = (urlparse(url).pathname or "/").rstrip("/").lower() or "/"
        except Exception:
            continue
        ex = False
        man = False
        if has_ex:
            v = row.get("exclude_from_manifest")
            ex = bool(v) and str(v).strip().lower() not in {"", "0", "false", "nan", "none"}
        if has_man:
            v = row.get("manual_paste_page")
            man = bool(v) and str(v).strip().lower() not in {"", "0", "false", "nan", "none"}
        if ex:
            excludes.append(path_key)
        if man:
            manuals.append({"pathKey": path_key, "url": url})
    payload = {
        "excludePathKeys": sorted(set(excludes)),
        "manualPastePages": manuals,
        "note": "Generated from 02 exclude_from_manifest / manual_paste_page — do not hand-edit",
    }
    out = Path(outputs_dir) / "manifest-policy.json"
    out.write_text(_json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote manifest-policy.json excludes={len(payload['excludePathKeys'])} manual={len(manuals)}")

'''

if "def write_manifest_policy" not in t:
    t = t.replace("def write_mentoring_manual_paste", fn + "def write_mentoring_manual_paste", 1)

# Call before mentoring paste
if "write_manifest_policy(df_products, outputs_dir)" not in t:
    needle = "write_mentoring_manual_paste(outputs_dir)"
    if needle not in t:
        raise SystemExit("mentoring call missing")
    t = t.replace(
        needle,
        "write_manifest_policy(df_products, outputs_dir)\n    " + needle,
        1,
    )

gen.write_text(t, encoding="utf-8")
print("generator patched for manifest-policy")

# Patch deploy CLI to read manifest-policy.json
deploy = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\scripts\deploy-product-schemas-cli.mjs")
d = deploy.read_text(encoding="utf-8")
if "manifest-policy.json" not in d:
    old = """const MANIFEST_EXCLUDE_PATH_KEYS = new Set([
  "/photography-services-near-me/2hr-private-photography-classes-2hr",
  "/photography-mentoring-online-assignments",
]);
const manifestEntries = [];"""
    new = """const POLICY_PATH = path.join(SCHEMA_DIR, "manifest-policy.json");
let MANIFEST_EXCLUDE_PATH_KEYS = new Set([
  "/photography-services-near-me/2hr-private-photography-classes-2hr",
  "/photography-mentoring-online-assignments",
]);
if (fs.existsSync(POLICY_PATH)) {
  try {
    const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
    if (Array.isArray(policy.excludePathKeys) && policy.excludePathKeys.length) {
      MANIFEST_EXCLUDE_PATH_KEYS = new Set(policy.excludePathKeys.map((k) => String(k).toLowerCase()));
    }
  } catch (e) {
    console.warn("manifest-policy.json unreadable; using defaults", e.message || e);
  }
}
const manifestEntries = [];"""
    if old not in d:
        raise SystemExit("deploy exclude block missing")
    d = d.replace(old, new, 1)
    deploy.write_text(d, encoding="utf-8")
    print("deploy CLI reads manifest-policy.json")
else:
    print("deploy already policy-aware")

# Same for copy script
copy = Path(r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\scripts\_copy-schemas-no-git-2026-10-06.mjs")
if copy.exists():
    c = copy.read_text(encoding="utf-8")
    if "manifest-policy.json" not in c:
        old = """const MANIFEST_EXCLUDE_PATH_KEYS = new Set([
  "/photography-services-near-me/2hr-private-photography-classes-2hr",
  "/photography-mentoring-online-assignments",
]);"""
        new = """let MANIFEST_EXCLUDE_PATH_KEYS = new Set([
  "/photography-services-near-me/2hr-private-photography-classes-2hr",
  "/photography-mentoring-online-assignments",
]);
const POLICY_PATH = path.join(SCHEMA_DIR, "manifest-policy.json");
if (fs.existsSync(POLICY_PATH)) {
  try {
    const policy = JSON.parse(fs.readFileSync(POLICY_PATH, "utf8"));
    if (Array.isArray(policy.excludePathKeys) && policy.excludePathKeys.length) {
      MANIFEST_EXCLUDE_PATH_KEYS = new Set(policy.excludePathKeys.map((k) => String(k).toLowerCase()));
    }
  } catch (e) {
    console.warn("manifest-policy.json unreadable; using defaults", e.message || e);
  }
}"""
        if old in c:
            copy.write_text(c.replace(old, new, 1), encoding="utf-8")
            print("copy script policy-aware")
        else:
            print("copy script block not found")
    else:
        print("copy already policy-aware")
