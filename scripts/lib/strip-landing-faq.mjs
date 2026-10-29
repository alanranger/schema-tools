/** FAQ-omit step used by the landing generator when scrape finds no visible Q&As. */

function nodeTypes(node) {
  const t = node && node['@type'];
  if (Array.isArray(t)) return t;
  return t ? [t] : [];
}

export function isFaqNode(node) {
  return nodeTypes(node).indexOf('FAQPage') !== -1;
}

export function faqQuestionCount(schema) {
  const nodes = Array.isArray(schema?.['@graph']) ? schema['@graph'] : (schema ? [schema] : []);
  let n = 0;
  nodes.forEach((node) => {
    if (!isFaqNode(node)) return;
    const me = Array.isArray(node.mainEntity) ? node.mainEntity : (node.mainEntity ? [node.mainEntity] : []);
    n += me.length;
  });
  return n;
}

function isFaqIdRef(value) {
  if (typeof value === 'string') return /#faq$/i.test(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return /#faq$/i.test(String(value['@id'] || '')) && !isFaqNode(value);
  }
  return false;
}

function stripFaqRefsFromNode(node) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return;
  ['hasPart', 'mainEntity', 'subjectOf', 'about'].forEach((key) => {
    const val = node[key];
    if (val == null) return;
    if (Array.isArray(val)) {
      const next = val.filter((item) => !isFaqIdRef(item));
      if (next.length) node[key] = next;
      else delete node[key];
    } else if (isFaqIdRef(val)) {
      delete node[key];
    }
  });
}

export function stripLandingFaqOmit(schema) {
  const copy = JSON.parse(JSON.stringify(schema || {}));
  const graph = Array.isArray(copy['@graph']) ? copy['@graph'] : (copy['@type'] ? [copy] : []);
  const kept = graph.filter((node) => !isFaqNode(node));
  kept.forEach((node) => stripFaqRefsFromNode(node));
  return { '@context': copy['@context'] || 'https://schema.org', '@graph': kept };
}

export function graphWithoutFaq(schema) {
  const graph = Array.isArray(schema?.['@graph']) ? schema['@graph'] : (schema ? [schema] : []);
  return graph.filter((node) => !isFaqNode(node));
}
