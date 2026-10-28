export function classifySchemaFile(name) {
  const n = String(name || "");
  if (/_event_(schema|faq)\.json$/i.test(n)) return "event";
  if (/blog-schema\.json$/i.test(n) || /_(blogposting|breadcrumb|howto)\.json$/i.test(n)) return "blog";
  if (/_schema\.json$/i.test(n) || /products-manifest\.json$/i.test(n) || /_(faq|image)\.json$/i.test(n)) {
    return "product";
  }
  return "other";
}

function deployLabel(kinds) {
  const core = ["product", "event", "blog"].filter((k) => kinds.has(k));
  if (!core.length && kinds.has("other")) return "schema";
  return core.join("/") || "schema";
}

export function deployCommitMessage(fileNames, deletedFileNames, options = {}) {
  const written = Array.isArray(fileNames) ? fileNames : [];
  const deleted = Array.isArray(deletedFileNames) ? deletedFileNames : [];
  const kinds = new Set();
  written.forEach((f) => kinds.add(classifySchemaFile(f)));
  deleted.forEach((f) => kinds.add(classifySchemaFile(f)));
  if (options.cleanupEventSchemas) kinds.add("event");
  if (options.cleanupProductSchemas) kinds.add("product");
  const label = deployLabel(kinds);
  if (!deleted.length) return `Update ${written.length} ${label} schema files`;
  const delCounts = {};
  deleted.forEach((f) => {
    const k = classifySchemaFile(f);
    delCounts[k] = (delCounts[k] || 0) + 1;
  });
  const delPart = Object.entries(delCounts).map(([k, n]) => `${n} ${k}`).join(", ");
  return `Sync ${written.length} ${label} schema files (remove ${delPart})`;
}
