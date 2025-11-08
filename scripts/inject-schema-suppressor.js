// scripts/inject-schema-suppressor.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = process.argv[2] || "dist";
const MARKER = "Squarespace Product Schema Suppressor v1.3";
const BLOCK = fs.readFileSync(
  path.resolve(__dirname, "../partials/schema-suppressor-v1.3.html"),
  "utf8"
);

// Recursively collect .html files
function walk(dir) {
  const out = [];
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const s = fs.statSync(p);
      if (s.isDirectory()) {
        out.push(...walk(p));
      } else if (p.toLowerCase().endsWith(".html")) {
        out.push(p);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
  }
  return out;
}

function inject(file) {
  try {
    const html = fs.readFileSync(file, "utf8");
    if (html.includes(MARKER)) return false; // already injected

    const headMatch = /<head[^>]*>/i.exec(html);
    let next;
    if (headMatch) {
      const idx = headMatch.index + headMatch[0].length;
      next = html.slice(0, idx) + "\n" + BLOCK + "\n" + html.slice(idx);
    } else {
      next = BLOCK + "\n" + html;
    }

    fs.writeFileSync(file, next, "utf8");
    return true;
  } catch (err) {
    console.error(`Error processing ${file}:`, err.message);
    return false;
  }
}

const files = walk(ROOT);
let changed = 0;
for (const f of files) {
  if (inject(f)) changed++;
}

console.log(
  `Schema suppressor injection complete: ${changed} modified, ${files.length - changed} skipped (already present).`
);



