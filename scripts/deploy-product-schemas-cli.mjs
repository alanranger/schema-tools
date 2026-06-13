#!/usr/bin/env node
/**
 * CLI equivalent of Electron Step 5: sync product *_schema.json (+ optional *_faq.json)
 * to alanranger-schema, update products-manifest.json, commit and push.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";

const CSV_PATH =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/csv processed/04 – alanranger_product_schema_FINAL_WITH_REVIEW_RATINGS.csv";
const SCHEMA_DIR =
  "G:/Dropbox/alan ranger photography/Website Code/alan-shared-resources/outputs/schema/products";
const REPO_PATH =
  "G:/Dropbox/alan ranger photography/Website Code/Schema Tools/alanranger-schema";

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

function git(args, desc) {
  const res = spawnSync("git", args, { cwd: REPO_PATH, encoding: "utf8", shell: false });
  if (res.status !== 0) {
    const msg = (res.stderr || res.stdout || "").trim();
    throw new Error(`Git ${desc} failed: ${msg}`);
  }
  return (res.stdout || "").trim();
}

const csvText = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
const rows = parseCsv(csvText);
const headers = rows[0].map((h) => h.trim());
const jsonIdx = headers.findIndex((h) => h === "json_file_name");
const urlIdx = headers.findIndex((h) => h === "url");
if (jsonIdx < 0) throw new Error("json_file_name column not found");

const keepNames = new Set();
const manifestEntries = [];

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

  let faqFileName = "";
  const faqSrc = path.join(SCHEMA_DIR, jsonFile.replace("_schema.json", "_faq.json"));
  if (fs.existsSync(faqSrc)) {
    faqFileName = path.basename(faqSrc);
    fs.copyFileSync(faqSrc, path.join(REPO_PATH, faqFileName));
    keepNames.add(faqFileName);
  }

  const canonicalUrl = normalizeCanonicalUrl(url);
  const pathKey = derivePathKey(url);
  if (canonicalUrl && pathKey) {
    manifestEntries.push({ url: canonicalUrl, pathKey, schemaFileName: jsonFile, faqFileName });
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
keepNames.add("products-manifest.json");

let removed = 0;
for (const name of fs.readdirSync(REPO_PATH)) {
  if (!name.endsWith("_schema.json") || name.endsWith("_event_schema.json") || keepNames.has(name)) continue;
  const candidate = path.join(REPO_PATH, name);
  if (isLikelyProductSchemaJson(candidate)) {
    fs.unlinkSync(candidate);
    removed++;
    console.log(`Removed stale: ${name}`);
  }
}

git(["checkout", "main"], "checkout main");
const lock = path.join(REPO_PATH, ".git/index.lock");
if (fs.existsSync(lock)) fs.unlinkSync(lock);

git(["add", "-A"], "add");
const status = git(["status", "--porcelain"], "status");
if (!status) {
  console.log("No changes to commit.");
  process.exit(0);
}

const msg = `Sync ${keepNames.size - 1} product schema files (fresh Google reviews ${new Date().toISOString().slice(0, 10)})`;
git(["commit", "-m", msg], "commit");
git(["push"], "push");

console.log(`Deployed ${keepNames.size - 1} files + manifest; removed ${removed} stale; pushed to origin/main`);
