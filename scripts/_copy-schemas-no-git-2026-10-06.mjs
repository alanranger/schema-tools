/**
 * Copy product schemas to alanranger-schema, update manifest with exclusions,
 * write mentoring manual-paste Service node.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const CSV_PATH =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed/04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv";
const SCHEMA_DIR =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/outputs/schema/products";
const REPO_PATH =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema";
const SHARED =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources";

/** Keep schema files + 02 rows, but never auto-load via site-wide products-manifest. */
let MANIFEST_EXCLUDE_PATH_KEYS = new Set([
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
}

const MENTORING_SCHEMA = "photography-mentor-online-monthly-mentoring_schema.json";
const MENTORING_FLAG = path.join(SHARED, "outputs/manual-paste/mentoring-paste-flag.json");
const MENTORING_NODE = path.join(SHARED, "outputs/manual-paste/mentoring-service-node.json");
const MENTORING_HASH = path.join(SHARED, "outputs/manual-paste/mentoring-reviews.sha256");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      if (field !== "" || row.length) {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      }
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function normalizeCanonicalUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const cleanPath = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.origin}${cleanPath}`.toLowerCase();
  } catch {
    return value.toLowerCase().replace(/[?#].*$/, "").replace(/\/+$/, "");
  }
}

function derivePathKey(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    return (new URL(value).pathname || "/").replace(/\/+$/, "").toLowerCase() || "/";
  } catch {
    const stripped = value.replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/[?#].*$/, "");
    return (stripped || "/").replace(/\/+$/, "").toLowerCase() || "/";
  }
}

function isLikelyProductSchemaJson(filePath) {
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const graph = Array.isArray(data?.["@graph"]) ? data["@graph"] : [];
    return graph.some((node) => {
      const types = Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]];
      return types.includes("Product") && !!node?.offers;
    });
  } catch {
    return false;
  }
}

function writeMentoringManualPaste() {
  const src = path.join(SCHEMA_DIR, MENTORING_SCHEMA);
  if (!fs.existsSync(src)) {
    console.warn("Mentoring schema missing; skip manual paste write");
    return { changed: false };
  }
  const data = JSON.parse(fs.readFileSync(src, "utf8"));
  const graph = Array.isArray(data["@graph"]) ? data["@graph"] : [data];
  const product = graph.find((n) => {
    const types = Array.isArray(n?.["@type"]) ? n["@type"] : [n?.["@type"]];
    return types.includes("Product");
  });
  if (!product) throw new Error("No Product node in mentoring schema");

  const serviceUrl = "https://www.alanranger.com/photography-mentoring-online-assignments";
  const reviews = Array.isArray(product.review) ? product.review : [];
  const serviceNode = {
    "@type": ["Service", "Product"],
    "@id": `${serviceUrl}#service`,
    name: product.name || "Photography Mentor Online — Monthly Mentoring",
    url: serviceUrl,
    description: product.description || "",
    brand: { "@id": "https://www.alanranger.com/#org" },
    aggregateRating: product.aggregateRating || {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: reviews.length,
    },
    review: reviews,
  };

  fs.mkdirSync(path.dirname(MENTORING_NODE), { recursive: true });
  const payload = JSON.stringify(serviceNode, null, 2);
  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  let prevHash = "";
  let prevCount = null;
  if (fs.existsSync(MENTORING_HASH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(MENTORING_HASH, "utf8"));
      prevHash = prev.hash || "";
      prevCount = prev.reviewCount ?? null;
    } catch {
      prevHash = fs.readFileSync(MENTORING_HASH, "utf8").trim();
    }
  }
  const changed = prevHash !== hash;
  fs.writeFileSync(MENTORING_NODE, payload, "utf8");
  fs.writeFileSync(
    MENTORING_HASH,
    JSON.stringify({ hash, reviewCount: reviews.length, updatedAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
  const flag = {
    needsRepaste: changed,
    reason: changed
      ? `Mentoring page schema needs re-paste — reviews changed (${prevCount ?? "?"} → ${reviews.length})`
      : "unchanged",
    reviewCount: reviews.length,
    previousReviewCount: prevCount,
    updatedAt: new Date().toISOString(),
    pasteFile: MENTORING_NODE,
  };
  fs.writeFileSync(MENTORING_FLAG, JSON.stringify(flag, null, 2), "utf8");
  console.log("mentoring manual-paste", flag.reason);
  return flag;
}

const csvText = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const rows = parseCsv(csvText);
const headers = rows[0].map((h) => h.trim());
const jsonIdx = headers.findIndex((h) => h === "json_file_name");
const urlIdx = headers.findIndex((h) => h === "url");
if (jsonIdx < 0) throw new Error("json_file_name column not found");

const keepNames = new Set([
  "products-manifest.json",
  "organization-homepage-reviews.json",
  "organization-about-reviews.json",
]);
const manifestEntries = [];
let copied = 0;

for (let i = 1; i < rows.length; i++) {
  const jsonFile = (rows[i][jsonIdx] || "").trim();
  const url = urlIdx >= 0 ? (rows[i][urlIdx] || "").trim() : "";
  if (!jsonFile.endsWith("_schema.json")) continue;

  const src = path.join(SCHEMA_DIR, jsonFile);
  const dest = path.join(REPO_PATH, jsonFile);
  if (!fs.existsSync(src)) {
    console.warn(`Skip missing: ${jsonFile}`);
    continue;
  }
  fs.copyFileSync(src, dest);
  keepNames.add(jsonFile);
  copied++;

  let faqFileName = "";
  const faqSrc = path.join(SCHEMA_DIR, jsonFile.replace("_schema.json", "_faq.json"));
  if (fs.existsSync(faqSrc)) {
    faqFileName = path.basename(faqSrc);
    fs.copyFileSync(faqSrc, path.join(REPO_PATH, faqFileName));
    keepNames.add(faqFileName);
  }

  const canonicalUrl = normalizeCanonicalUrl(url);
  const pathKey = derivePathKey(url);
  if (canonicalUrl && pathKey && !MANIFEST_EXCLUDE_PATH_KEYS.has(pathKey)) {
    manifestEntries.push({ url: canonicalUrl, pathKey, schemaFileName: jsonFile, faqFileName });
  } else if (pathKey && MANIFEST_EXCLUDE_PATH_KEYS.has(pathKey)) {
    console.log("manifest exclude", pathKey);
  }
}

const dedup = new Map();
for (const entry of manifestEntries) {
  if (!dedup.has(entry.pathKey) || (!dedup.get(entry.pathKey).faqFileName && entry.faqFileName)) {
    dedup.set(entry.pathKey, entry);
  }
}
const entries = [...dedup.values()];
const manifest = {
  generatedAt: new Date().toISOString(),
  totalProducts: entries.length,
  entries,
};
fs.writeFileSync(path.join(REPO_PATH, "products-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

let removed = 0;
for (const name of fs.readdirSync(REPO_PATH)) {
  if (!name.endsWith("_schema.json") || name.endsWith("_event_schema.json") || keepNames.has(name)) continue;
  const candidate = path.join(REPO_PATH, name);
  if (isLikelyProductSchemaJson(candidate)) {
    // Keep 2hr + mentoring schema files even if somehow unmatched
    if (
      name === "1-x-2hr-private-photography-classes-face-to-face-coventry_schema.json" ||
      name === MENTORING_SCHEMA
    ) {
      continue;
    }
    fs.unlinkSync(candidate);
    removed++;
    console.log(`Removed stale: ${name}`);
  }
}

const mentoringFlag = writeMentoringManualPaste();
console.log(`Copied ${copied}; manifest ${entries.length}; removed ${removed}; mentoringNeedsRepaste=${mentoringFlag.needsRepaste}`);
