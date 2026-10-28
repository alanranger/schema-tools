import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "alanranger-schema");

function hasType(node, label) {
  const t = node && node["@type"];
  if (Array.isArray(t)) return t.includes(label);
  return t === label;
}

function filled(val) {
  if (val == null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val).length > 0;
  return true;
}

function getPath(obj, p) {
  let cur = obj;
  for (const key of p.split(".")) {
    if (cur == null) return undefined;
    cur = cur[key];
  }
  return cur;
}

const events = [];
for (const name of fs.readdirSync(dir)) {
  if (!name.endsWith("_event_schema.json")) continue;
  const json = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  const nodes = Array.isArray(json["@graph"]) ? json["@graph"] : [json];
  for (const n of nodes) {
    if (hasType(n, "Event")) events.push(n);
  }
}

const total = events.length;
const count = (p) => events.filter((e) => filled(getPath(e, p))).length;
const row = (label, p) => {
  const n = count(p);
  const status = total && n === total ? "✅" : "⚽";
  console.log(`${status}  ${label}: ${n} / ${total}`);
};

console.log(`events: ${total}`);
row("organizer.@type", "organizer.@type");
row("organizer.name", "organizer.name");
row("organizer.logo", "organizer.logo");
row("organizer.sameAs", "organizer.sameAs");
row("organizer.@id", "organizer.@id");
row("provider", "provider");
row("location.@type", "location.@type");
row("address.addressCountry", "location.address.addressCountry");
row("offers.@type", "offers.@type");
row("offers.price", "offers.price");
row("offers.priceCurrency", "offers.priceCurrency");
row("offers.seller.name", "offers.seller.name");
row("offers.seller.@id", "offers.seller.@id");
row("Event.@id", "@id");
