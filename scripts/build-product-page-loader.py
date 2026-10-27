"""Build schema.alanranger.com/loaders/product-page-loader.js from live header extracts."""
from __future__ import annotations

import re
from pathlib import Path

OUT = Path(
    r"G:\Dropbox\alan ranger photography\Website Code\Schema Tools\alanranger-schema\loaders"
)
SRC = Path(
    r"G:\Dropbox\alan ranger photography\Website Code\alan-shared-resources\outputs\schema"
)

CORE = r"""
  /* ---------- Core Schema Suppressor v2.2 (one visible FAQPage) ---------- */
  function installCoreSuppressorV21() {
    if (window.__AR_CORE_SUPPRESSOR_V21__) return;
    window.__AR_CORE_SUPPRESSOR_V21__ = true;
    var CORE_TYPES = new Set(['Product','Organization','LocalBusiness','WebSite','WebPage','BreadcrumbList','SearchAction','Place','Service']);
    var CANONICAL_ID_SUFFIXES = ['#org','#website','#webpage','#breadcrumbs','#service','#person','#primaryimage','#product','#faq'];
    function getTypes(node) {
      if (!node) return [];
      return Array.isArray(node['@type']) ? node['@type'] : [node['@type']].filter(Boolean);
    }
    function isCanonical(node) {
      var id = String((node && node['@id']) || '');
      if (CANONICAL_ID_SUFFIXES.some(function (suffix) { return id.indexOf(suffix) !== -1; })) return true;
      if (node && Array.isArray(node['@graph'])) return true;
      return false;
    }
    function shouldSuppressNode(node) {
      var nodeTypes = getTypes(node);
      if (!nodeTypes.some(function (t) { return CORE_TYPES.has(t); })) return false;
      if (isCanonical(node)) return false;
      return true;
    }
    function isFaq(n) {
      return getTypes(n).indexOf('FAQPage') !== -1;
    }
    function visText() {
      var body = document.body;
      if (!body) return '';
      var clone = body.cloneNode(true);
      clone.querySelectorAll('script,style,noscript').forEach(function (el) { el.remove(); });
      return String(clone.textContent || '').replace(/['’]/g, "'").toLowerCase();
    }
    function qVisible(q, text) {
      var name = String((q && q.name) || '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
      return name.length > 8 && text.indexOf(name) !== -1;
    }
    function keepFaqNode(n, text, drop) {
      if (!isFaq(n)) return n;
      if (drop) return null;
      var me = n.mainEntity;
      var qs = Array.isArray(me) ? me : (me ? [me] : []);
      var vis = qs.filter(function (q) { return qVisible(q, text); });
      if (!vis.length) return null;
      n.mainEntity = vis;
      return n;
    }
    function rewriteJsonLd(el, json, kept) {
      if (!kept.length) { el.remove(); return; }
      var next = Array.isArray(json['@graph']) ? Object.assign({}, json, { '@graph': kept }) : kept[0];
      var out = JSON.stringify(next);
      if (out === (el.textContent || '').trim()) return;
      el.textContent = out;
    }
    function enforceVisibleFaq() {
      var text = visText();
      var crit = document.getElementById('arp-critical-schema') || document.getElementById('ar-github-product-schema');
      var critHasFaq = false;
      if (crit) {
        try {
          var cjson = JSON.parse((crit.textContent || '').trim());
          var cnodes = Array.isArray(cjson['@graph']) ? cjson['@graph'] : [cjson];
          var ckept = cnodes.map(function (n) { return keepFaqNode(n, text, false); }).filter(Boolean);
          rewriteJsonLd(crit, cjson, ckept);
          critHasFaq = ckept.some(isFaq);
        } catch (e) {}
      }
      document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(function (el) {
        if (el.id === 'arp-critical-schema' || el.id === 'ar-github-product-schema') return;
        var txt = (el.textContent || '').trim();
        if (!txt) return;
        try {
          var json = JSON.parse(txt);
          var nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
          if (!nodes.some(isFaq)) return;
          rewriteJsonLd(el, json, nodes.map(function (n) { return keepFaqNode(n, text, critHasFaq); }).filter(Boolean));
        } catch (e) {}
      });
    }
    function suppressSquarespaceCore() {
      document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(function (el) {
        if (el.id === 'arp-critical-schema' || el.id === 'ar-github-product-schema') return;
        var txt = (el.textContent || '').trim();
        if (!txt) return;
        try {
          var json = JSON.parse(txt);
          var nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
          var kept = nodes.filter(function (node) { return !shouldSuppressNode(node || {}); });
          if (kept.length === nodes.length) return;
          if (kept.length === 0) { el.remove(); return; }
          var nextJson = Array.isArray(json['@graph']) ? Object.assign({}, json, { '@graph': kept }) : kept[0];
          el.textContent = JSON.stringify(nextJson);
        } catch (e) {}
      });
      enforceVisibleFaq();
    }
    suppressSquarespaceCore();
    document.addEventListener('DOMContentLoaded', suppressSquarespaceCore);
    window.addEventListener('load', function () { setTimeout(suppressSquarespaceCore, 1000); });
    try {
      var obs = new MutationObserver(suppressSquarespaceCore);
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }
"""

HELPERS = r"""
  function arNormPath(p) {
    p = String(p || '');
    try { p = decodeURIComponent(p); } catch (e) {}
    p = p.toLowerCase().replace(/\/+$/, '');
    return p || '/';
  }
  function arIsProductType(t) {
    if (!t) return false;
    if (Array.isArray(t)) return t.indexOf('Product') !== -1;
    return t === 'Product';
  }
  function arInjectGithubSchema(schema) {
    if (!schema) return;
    var existing = document.getElementById('ar-github-product-schema');
    if (existing) existing.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = 'ar-github-product-schema';
    s.textContent = JSON.stringify(schema);
    document.head.appendChild(s);
  }
  function arRemoveLegacyDuplicateProducts() {
    document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(function (el) {
      if (el.id === 'ar-github-product-schema' || el.id === 'arp-critical-schema') return;
      var txt = (el.textContent || '').trim();
      if (!txt || txt.indexOf('Product') === -1) return;
      try {
        var json = JSON.parse(txt);
        if (Array.isArray(json['@graph'])) {
          var kept = json['@graph'].filter(function (n) { return !arIsProductType(n && n['@type']); });
          if (kept.length === json['@graph'].length) return;
          if (kept.length === 0) { el.remove(); return; }
          json['@graph'] = kept;
          el.textContent = JSON.stringify(json);
          return;
        }
        if (arIsProductType(json['@type'])) el.remove();
      } catch (e) {}
    });
  }
  function arFindProductNode(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i] && arIsProductType(nodes[i]['@type'])) return nodes[i];
    }
    return null;
  }
"""


def strip_iife(src: str) -> str:
    src = src.strip()
    src = re.sub(r"^\(function\s*\(\s*\)\s*\{\s*", "", src)
    src = re.sub(r"\}\s*\)\s*\(\s*\)\s*;?\s*$", "", src)
    return src


def patch_body(src: str, is_services: bool) -> str:
    body = strip_iife(src)
    old_entry = (
        "var entry = (manifest.entries || []).find(function (e) { "
        "return e.pathKey === location.pathname; });"
    )
    new_entry = (
        "var entry = (manifest.entries || []).find(function (e) { "
        "return arNormPath(e.pathKey) === arNormPath(location.pathname); });"
    )
    if old_entry not in body:
        raise SystemExit("pathKey find pattern missing")
    body = body.replace(old_entry, new_entry)

    old_find = "product = nodes.find(function (n) { return n && n['@type'] === 'Product'; }) || null;"
    new_find = (
        "product = arFindProductNode(nodes);\n"
        "        arInjectGithubSchema(schema);\n"
        "        arRemoveLegacyDuplicateProducts();"
    )
    if old_find not in body:
        raise SystemExit("product find pattern missing")
    body = body.replace(old_find, new_find)

    if is_services:
        body2, n = re.subn(
            r"var AR_NO_REVIEWS = \[[^\]]*?\];",
            "var AR_NO_REVIEWS = []; /* emptied 2026-10-07: badge when rated reviewCount >= 1 */",
            body,
            count=1,
            flags=re.S,
        )
        if n != 1:
            raise SystemExit("AR_NO_REVIEWS replace failed")
        body = body2
    else:
        if "AR_NO_REVIEWS" not in body:
            body = body.replace(
                "SCHEMA_HOST: 'https://schema.alanranger.com/'\n  };",
                "SCHEMA_HOST: 'https://schema.alanranger.com/'\n  };\n\n  var AR_NO_REVIEWS = [];",
            )
    return body


def indent(block: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(pad + line if line else line for line in block.splitlines())


def main() -> None:
    workshops = (SRC / "extract-header-workshops-2026-10-07.js").read_text(encoding="utf-8")
    services = (SRC / "extract-header-services-2026-10-07.js").read_text(encoding="utf-8")
    w_body = patch_body(workshops, False)
    s_body = patch_body(services, True)
    OUT.mkdir(parents=True, exist_ok=True)

    loader = f"""/**
 * product-page-loader.js — https://schema.alanranger.com/loaders/product-page-loader.js
 * Option B (2026-10-07): one-line Squarespace store header injection for
 *   /photo-workshops-uk and /photography-services-near-me product pages.
 * Reproduces prior ar-pb ProductItem UI + durable schema/badge fixes.
 * Source of truth: alanranger-schema. Do not hand-edit on Squarespace.
 */
(function () {{
  'use strict';

  function inEditor() {{
    try {{
      return window.self !== window.top ||
        /[?&](config|edit|fullSiteEdit)=/.test(location.search) ||
        document.body.classList.contains('sqs-edit-mode') ||
        document.body.classList.contains('sqs-edit-mode-active');
    }} catch (e) {{ return true; }}
  }}
  if (inEditor()) return;

{CORE}
{HELPERS}
  installCoreSuppressorV21();

  var path = arNormPath(location.pathname);
  var isWorkshops = path === '/photo-workshops-uk' || path.indexOf('/photo-workshops-uk/') === 0;
  var isServices = path === '/photography-services-near-me' || path.indexOf('/photography-services-near-me/') === 0;
  if (!isWorkshops && !isServices) return;

  if (isWorkshops) {{
    (function arWorkshopsProductPage() {{
{indent(w_body, 6)}
    }})();
  }} else {{
    (function arServicesProductPage() {{
{indent(s_body, 6)}
    }})();
  }}
}})();
"""
    out = OUT / "product-page-loader.js"
    out.write_text(loader, encoding="utf-8")
    text = out.read_text(encoding="utf-8")
    checks = [
        "arNormPath",
        "AR_NO_REVIEWS = []",
        "arInjectGithubSchema",
        "#product",
        "arRemoveLegacyDuplicateProducts",
        "fix18",
        "AR_TILE_MAP",
        "installCoreSuppressorV21",
    ]
    print("wrote", out, "bytes", out.stat().st_size)
    for c in checks:
        print(c, c in text)


if __name__ == "__main__":
    main()
