/**
 * product-page-loader.js — https://schema.alanranger.com/loaders/product-page-loader.js
 * Option B (2026-10-07): one-line Squarespace store header injection for
 *   /photo-workshops-uk and /photography-services-near-me product pages.
 * Reproduces prior ar-pb ProductItem UI + durable schema/badge fixes.
 * Source of truth: alanranger-schema. Do not hand-edit on Squarespace.
 */
(function () {
  'use strict';

  function inEditor() {
    try {
      return window.self !== window.top ||
        /[?&](config|edit|fullSiteEdit)=/.test(location.search) ||
        document.body.classList.contains('sqs-edit-mode') ||
        document.body.classList.contains('sqs-edit-mode-active');
    } catch (e) { return true; }
  }
  if (inEditor()) return;


  /* ---------- Core Schema Suppressor v2.1 (#product whitelisted) ---------- */
  function installCoreSuppressorV21() {
    if (window.__AR_CORE_SUPPRESSOR_V21__) return;
    window.__AR_CORE_SUPPRESSOR_V21__ = true;
    var CORE_TYPES = new Set(['Product','Organization','LocalBusiness','WebSite','WebPage','BreadcrumbList','SearchAction','Place','Service','FAQPage']);
    var CANONICAL_ID_SUFFIXES = ['#org','#website','#webpage','#breadcrumbs','#service','#person','#primaryimage','#product'];
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
    }
    suppressSquarespaceCore();
    document.addEventListener('DOMContentLoaded', suppressSquarespaceCore);
    window.addEventListener('load', function () { setTimeout(suppressSquarespaceCore, 1000); });
    try {
      var obs = new MutationObserver(suppressSquarespaceCore);
      obs.observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) {}
  }


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

  installCoreSuppressorV21();

  var path = arNormPath(location.pathname);
  var isWorkshops = path === '/photo-workshops-uk' || path.indexOf('/photo-workshops-uk/') === 0;
  var isServices = path === '/photography-services-near-me' || path.indexOf('/photography-services-near-me/') === 0;
  if (!isWorkshops && !isServices) return;

  if (isWorkshops) {
    (function arWorkshopsProductPage() {
      'use strict';

        /* ---------- CONFIG (safe to tweak) ---------- */
        var CFG = {
          VISIBLE_CARDS: 6,        /* cards shown before "Show all N dates" */
          EXPAND_THRESHOLD: 8,     /* expander appears when variants > this */
          REVIEWS_VISIBLE: 4,      /* review cards shown before "Show all" */
          REVIEW_CHARS: 300,       /* (fix12: full body rendered; clamp is visual) */
          TOAST_MS: 9000,          /* add-to-cart toast duration */
          SCHEMA_HOST: 'https://schema.alanranger.com/'
        };

        var AR_NO_REVIEWS = [];

        /* ---------- ar-fp-edit-mode guard (mandatory) ---------- */
        function inEditor() {
          try {
            return window.self !== window.top ||
              document.body.classList.contains('sqs-edit-mode') ||
              document.body.classList.contains('sqs-edit-mode-active');
          } catch (e) { return true; }
        }

        /* ---------- helpers ---------- */
        function vis(el) { return !!(el && el.offsetParent !== null); }
        function money(v) {
          var p = (v.onSale && v.salePrice != null && Number(v.salePrice) > 0) ? v.salePrice : v.price;
          if (p && typeof p === 'object' && p.value != null) { p = parseFloat(p.value); }
          else { p = Number(p) / 100; }
          return '\u00a3' + p.toLocaleString('en-GB');
        }
        function esc(s) {
          return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
        }
        function plural(n, w) { return n + ' ' + w + (Number(n) === 1 ? '' : 's'); }

        /* ---------- fix18: normalise SQUARESPACE_CONTEXT money fields to match ?format=json ----------
           money() treats price and salePrice DIFFERENTLY:
             - it guards on Number(v.salePrice) > 0, so salePrice must be a plain
               NUMBER; it then does Number(p)/100, so that number must be PENCE.
             - price falls through to the object branch parseFloat(p.value), so price
               must be an OBJECT whose .value is POUNDS.
           CONTEXT gives both as objects with .value in PENCE and .decimalValue in
           POUNDS, so we convert each to the shape money() expects:
             arPricePounds(price)  -> { value: <pounds> }   (object, pounds)
             arSalePence(salePrice) -> <pence Number>        (plain number, pence) */
        function arPricePounds(m) {
          if (m == null) return null;
          if (typeof m === 'object') {
            if (m.decimalValue != null) return { value: parseFloat(m.decimalValue) };
            if (m.value != null) return { value: Number(m.value) / 100 };
            return null;
          }
          return { value: Number(m) / 100 };
        }
        function arSalePence(m) {
          if (m == null) return null;
          if (typeof m === 'object') {
            if (m.value != null) return Number(m.value);                       /* .value is pence */
            if (m.decimalValue != null) return Math.round(parseFloat(m.decimalValue) * 100);
            return null;
          }
          return Number(m);                                                    /* already a pence number */
        }

        /* ---------- styles ---------- */
        var CSS = ''
          + 'body:not(.ar-fp-edit-mode) .ar-rating{display:flex;align-items:center;gap:8px;font:13.5px "Segoe UI",sans-serif;color:#555;margin:8px 0 4px}'
          + 'body:not(.ar-fp-edit-mode) .ar-stars{color:#f5a623;font-size:16px;letter-spacing:2px}'
          + 'body:not(.ar-fp-edit-mode) .ar-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 10px;max-width:480px}'
          /* fix14: base card - more presence at rest, extra bottom padding for the cue, site font, richer transition */
          + 'body:not(.ar-fp-edit-mode) .ar-card{position:relative;border:1.5px solid #dcc6aa;border-radius:8px;padding:12px 13px 30px;cursor:pointer;background:#fdf6ee;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease}'
          /* fix14: persistent "Select date ->" cue, bottom-left of every unselected card */
          + 'body:not(.ar-fp-edit-mode) .ar-card:before{content:"Select date \\2192";position:absolute;left:13px;bottom:9px;font-size:11px;font-weight:700;letter-spacing:.02em;color:#e8853d;opacity:.85;transition:opacity .15s ease,transform .15s ease}'
          /* fix14: hover lifts the card + shadow + stronger border + brighter cue (movement = "interactive") */
          + 'body:not(.ar-fp-edit-mode) .ar-card:hover{border-color:#e8853d;transform:translateY(-3px);box-shadow:0 6px 16px rgba(154,77,16,.22);background:#fffaf4}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:hover:before{opacity:1;transform:translateX(3px)}'
          /* fix14: pressed + keyboard focus */
          + 'body:not(.ar-fp-edit-mode) .ar-card:active{transform:translateY(-1px);box-shadow:0 2px 8px rgba(154,77,16,.25)}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:focus-visible{outline:3px solid rgba(232,133,61,.55);outline-offset:2px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.ar-hide{display:none}'
          /* fix14: selected - keep strong state, sit flat, compensate padding for 3px border */
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel{background:#f9e3c8;border:3px solid #9a4d0f;box-shadow:0 2px 10px rgba(154,77,16,.25);transform:none;padding:10.5px 11.5px 28.5px}'
          /* fix14: selected swaps the cue text to "checkmark Selected" (green), keeps the corner badge too */
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel:before{content:"\\2713 Selected";color:#2e7d32;opacity:1;font-weight:800}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel:after{content:"\u2713";position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;background:#2e7d32;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .d{font-weight:700;font-size:15px;color:#1a1a1a;padding-right:24px;line-height:1.35}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .t{font-size:13px;font-weight:600;color:#555;margin-top:3px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .p{font-size:18px;font-weight:800;margin-top:6px;color:#1a1a1a}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel .d{color:#3d2200}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel .t{color:#5c4326}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel .p{color:#7a3c10}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .a{font-size:12px;color:#3a8a3a;margin-top:6px;font-weight:700}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .a.low{color:#c2571f}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .a.soldout{color:#999}'
          /* fix14: sold-out cards are not clickable so suppress the "Select date" cue */
          + 'body:not(.ar-fp-edit-mode) .ar-card.out{cursor:default;border-style:dashed;padding:12px 13px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out:before{display:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out:hover{transform:none;box-shadow:none;border-color:#dcc6aa;background:#fdf6ee}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out:after{content:"SOLD OUT";position:absolute;top:8px;right:8px;background:#c62828;color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;padding:4px 9px;border-radius:11px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out .d{padding-right:74px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out .p{color:#888;text-decoration:line-through}'
          + 'body:not(.ar-fp-edit-mode) .ar-pill{display:inline-block;border:1.5px solid #e8853d;color:#e8853d;border-radius:22px;padding:9px 22px;background:#fff;cursor:pointer;font:600 13px "Segoe UI",sans-serif;letter-spacing:.04em}'
          + 'body:not(.ar-fp-edit-mode) .ar-pill:hover{background:#e8853d;color:#fff}'
          + 'body:not(.ar-fp-edit-mode) .ar-dates-more{margin:0 0 16px}'
          + 'body:not(.ar-fp-edit-mode) #ar-reviews{max-width:1400px;margin:30px auto 50px;padding:0 40px;font-family:"Segoe UI",sans-serif}'
          + 'body:not(.ar-fp-edit-mode) #ar-reviews h2{font-size:22px;font-weight:600;color:#222;margin:0 0 2px}'
          + 'body:not(.ar-fp-edit-mode) #ar-reviews .ar-sub{display:flex;align-items:center;gap:8px;color:#666;font-size:13.5px;margin:4px 0 18px}'
          + 'body:not(.ar-fp-edit-mode) .ar-revgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;align-items:start}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev{border:1px solid #f0d9c2;border-radius:10px;padding:16px 18px;background:#fbeee1;position:relative}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev .st{color:#f5a623;font-size:13px;letter-spacing:1.5px;margin-bottom:6px}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev .w{font-size:13.5px;font-weight:600;color:#222;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev .s{background:#fff;border-radius:10px;padding:2px 9px;font-size:10.5px;color:#9a6a3f;font-weight:600}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev p{font-size:13.5px;color:#2b2118;font-weight:600;line-height:1.6;margin-top:7px}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp p{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp.ar-open p,body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp:hover p,body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp:focus-within p{-webkit-line-clamp:unset;overflow:visible}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev-more{display:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp{cursor:pointer}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp .ar-rev-more{display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#c96a1e;letter-spacing:.02em}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp.ar-open .ar-rev-more,body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp:hover .ar-rev-more{display:none}'
          + 'body:not(.ar-fp-edit-mode) #ar-more{display:inline-block;margin-top:16px;border:1.5px solid #e8853d;color:#e8853d;border-radius:22px;padding:9px 22px;background:#fff;cursor:pointer;font:600 13px "Segoe UI",sans-serif;letter-spacing:.04em}'
          + 'body:not(.ar-fp-edit-mode) #ar-more:hover{background:#e8853d;color:#fff}'
          + 'body:not(.ar-fp-edit-mode) [data-ar-tip]{position:relative}'
          + 'body:not(.ar-fp-edit-mode) [data-ar-tip]:hover:before,body:not(.ar-fp-edit-mode) [data-ar-tip]:focus-visible:before{content:attr(data-ar-tip);position:absolute;bottom:calc(100% + 12px);left:0;width:300px;background:#1a1a1a;color:#fff;font:500 12.5px/1.55 "Segoe UI",sans-serif;letter-spacing:.01em;text-transform:none;padding:11px 14px;border-radius:9px;z-index:99999;white-space:normal;text-align:left;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none}'
          + 'body:not(.ar-fp-edit-mode) [data-ar-tip]:hover:after,body:not(.ar-fp-edit-mode) [data-ar-tip]:focus-visible:after{content:"";position:absolute;bottom:calc(100% + 1px);left:26px;border:6px solid transparent;border-top-color:#1a1a1a;pointer-events:none}'
          + 'body:not(.ar-fp-edit-mode) .ProductItem-relatedProducts h2.ProductList-title{font-size:17px !important;line-height:1.4;font-weight:600;margin:10px 0 4px}'
          + 'body:not(.ar-fp-edit-mode) #ar-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:14px 18px 14px 22px;border-radius:12px;display:flex;gap:16px;align-items:center;z-index:999999;font:600 13.5px "Segoe UI",sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)}'
          + 'body:not(.ar-fp-edit-mode) #ar-toast a{background:#e8853d;color:#fff;padding:9px 18px;border-radius:20px;font-weight:700;text-decoration:none;white-space:nowrap}'
          + 'body:not(.ar-fp-edit-mode) #ar-toast a:hover{background:#c96a1e}'
          /* fix13: date-selected confirm toast (separate from #ar-toast add-to-cart) */
          + 'body:not(.ar-fp-edit-mode) #ar-pick-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,16px);opacity:0;background:#2e7d32;color:#fff;padding:13px 20px;border-radius:12px;z-index:999998;font:600 14px "Segoe UI",sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);max-width:92vw;text-align:center;transition:opacity .3s ease,transform .3s ease;pointer-events:none}'
          + 'body:not(.ar-fp-edit-mode) #ar-pick-toast.ar-show{opacity:1;transform:translate(-50%,0)}'
          + 'body:not(.ar-fp-edit-mode) #ar-pick-toast b{font-weight:800;letter-spacing:.03em}'
          /* fix13: pulse/glow to draw the eye to Book Now */
          + 'body:not(.ar-fp-edit-mode) .ar-pulse{animation:arPulse 1.3s ease-out 2}'
          + '@keyframes arPulse{0%{box-shadow:0 0 0 0 rgba(201,106,30,.55)}70%{box-shadow:0 0 0 14px rgba(201,106,30,0)}100%{box-shadow:0 0 0 0 rgba(201,106,30,0)}}'
          + 'body:not(.ar-fp-edit-mode) .ar-sbox{border:1.5px solid #e0cdb0;background:#fdfaf5;border-radius:14px;padding:30px 22px 20px;margin:22px 0 18px;position:relative}'
          + 'body:not(.ar-fp-edit-mode) .ar-sbox:before{content:\'DETAILS\';position:absolute;top:-13px;left:18px;background:#c96a1e;color:#fff;font-size:12px;font-weight:700;letter-spacing:.1em;padding:5px 14px;border-radius:7px;box-shadow:0 2px 6px rgba(201,106,30,.3)}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;background:transparent}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .c{flex:1;min-width:110px;text-align:center;padding:13px 10px;position:relative;background:linear-gradient(#fbf2e4,#f5e6cf);border:1px solid #e3cda8;border-radius:9px}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .k{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#9a6b2f;font-weight:700;margin-bottom:6px;display:inline-block;border-bottom:1.5px solid #1a1a1a;padding-bottom:3px}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .v{font-size:15px;font-weight:700;color:#1f1206}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .c.tip{cursor:help}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .c.tip:hover:before{content:attr(data-tip);position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);width:260px;background:#1a1a1a;color:#fff;font:500 12.5px/1.5 "Segoe UI",sans-serif;text-transform:none;letter-spacing:0;padding:10px 13px;border-radius:8px;z-index:99999;box-shadow:0 6px 20px rgba(0,0,0,.25);white-space:normal;text-align:left}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .c.tip:hover:after{content:"";position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);border:6px solid transparent;border-top-color:#1a1a1a}'
          + 'body:not(.ar-fp-edit-mode) .ar-summary{display:grid;grid-template-columns:160px 1fr;column-gap:14px;font-size:14px;line-height:1.55;color:#33271b}'
          + 'body:not(.ar-fp-edit-mode) .ar-slabel{color:#7a5320;font-weight:700;display:flex;align-items:flex-start;gap:7px;padding:9px 0;border-top:1px solid #efe2cd}'
          + 'body:not(.ar-fp-edit-mode) .ar-slabel:before{content:"";width:7px;height:7px;border-radius:50%;background:#c96a1e;display:inline-block;flex:none;margin-top:6px}'
          + 'body:not(.ar-fp-edit-mode) .ar-sval{padding:9px 0;border-top:1px solid #efe2cd;color:#2b2118}'
          + 'body:not(.ar-fp-edit-mode) .ar-summary .ar-first{border-top:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-sdates{display:flex;flex-wrap:wrap;gap:8px}'
          + 'body:not(.ar-fp-edit-mode) .ar-dchip{display:inline-block;max-width:100%;background:#fff;border:1px solid #ddbf94;color:#2b2118;border-radius:8px;padding:7px 13px;font-size:13.5px;font-weight:700;white-space:normal;overflow-wrap:anywhere}'
          + 'body:not(.ar-fp-edit-mode) .ar-drange{flex-basis:100%;font-size:15px;font-weight:700;color:#2b2118;margin-bottom:2px}'
          + 'body:not(.ar-fp-edit-mode) .ar-dpills{flex-basis:100%;display:flex;flex-wrap:wrap;gap:6px}'
          + 'body:not(.ar-fp-edit-mode) .ar-dpill{background:#fff;border:1px solid #ddbf94;color:#5a4a36;border-radius:7px;padding:4px 10px;font-size:12px}'
          + 'body:not(.ar-fp-edit-mode) .ar-srow-desc{grid-column:1 / -1;border-top:2px solid #ecd9bd;margin-top:6px;padding-top:14px}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-lab{color:#7a5320;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center;gap:7px}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-lab:before{content:"";width:7px;height:7px;border-radius:50%;background:#c96a1e;display:inline-block}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-body{font-size:16.5px;line-height:1.7;color:#1c140c;font-weight:500}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-body p{margin:0 0 10px}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-body p:last-child{margin-bottom:0}'
          + 'body:not(.ar-fp-edit-mode) .ar-btn-row{display:flex;align-items:center;flex-wrap:wrap;gap:22px;margin:4px 0 8px}'
          + 'body:not(.ar-fp-edit-mode) .ar-btn-row .sqs-add-to-cart-button-wrapper{margin:0}'
          + 'body:not(.ar-fp-edit-mode) .ar-btn-row .register-interest-button{margin:0}'
          + 'body:not(.ar-fp-edit-mode) .ar-reg-compact .sqs-block-button-element{padding:7px 16px !important;font-size:11.5px !important;letter-spacing:.04em;min-height:0 !important;line-height:1.2 !important;border-width:1px !important;opacity:.9}'
          + 'body:not(.ar-fp-edit-mode) .ar-reg-compact .sqs-block-button-element:hover{opacity:1}'
          + 'body:not(.ar-fp-edit-mode) .ar-sval{min-width:0;overflow-wrap:anywhere;word-break:break-word}'
          + 'body:not(.ar-fp-edit-mode) .ar-sval a{overflow-wrap:anywhere;word-break:break-word}'
          /* fix15 STICKY BOTTOM CTA BAR */
          + 'body:not(.ar-fp-edit-mode) #ar-sticky{position:fixed;left:0;right:0;bottom:0;z-index:999990;background:#1a1a1a;color:#fff;box-shadow:0 -4px 20px rgba(0,0,0,.22);transform:translateY(110%);transition:transform .32s cubic-bezier(.4,0,.2,1);font-family:"Segoe UI",sans-serif}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky.ar-show{transform:translateY(0)}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-in{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 20px}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-txt{min-width:0;display:flex;flex-direction:column;line-height:1.3}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-title{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62vw}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-price{font-size:13px;color:#f0c89a;font-weight:600;margin-top:1px}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn{flex:none;background:#e8853d;color:#fff;border:none;border-radius:24px;padding:11px 26px;font:700 14px "Segoe UI",sans-serif;letter-spacing:.03em;cursor:pointer;white-space:nowrap;transition:background .15s ease,transform .15s ease}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn:hover{background:#c96a1e;transform:translateY(-1px)}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn:active{transform:translateY(0)}'
          + '@media (max-width:600px){'
          +   'body:not(.ar-fp-edit-mode) .ar-summary{grid-template-columns:1fr;column-gap:0}'
          +   'body:not(.ar-fp-edit-mode) .ar-slabel{padding:10px 0 2px;border-top:1px solid #efe2cd}'
          +   'body:not(.ar-fp-edit-mode) .ar-sval{padding:0 0 8px;border-top:none}'
          +   'body:not(.ar-fp-edit-mode) .ar-sval.ar-first{border-top:none}'
          +   'body:not(.ar-fp-edit-mode) .ar-sbox{padding:30px 16px 18px}'
          +   'body:not(.ar-fp-edit-mode) .ar-strip .c{min-width:calc(50% - 8px)}'
          +   'body:not(.ar-fp-edit-mode) .ar-btn-row{flex-direction:column;align-items:flex-start;gap:12px}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-in{padding:9px 14px;gap:12px}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-title{font-size:13px;max-width:52vw}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-price{font-size:12px}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn{padding:10px 18px;font-size:13px}'
          + '}'
          ;

        /* ---------- add-to-cart toast ---------- */
        function showToast() {
          var t = document.getElementById('ar-toast');
          if (t) t.remove();
          t = document.createElement('div');
          t.id = 'ar-toast';
          t.innerHTML = '\u2713 Added to cart \u2014 go to cart to complete checkout <a href="/cart">Go to Cart \u2192</a>';
          document.body.appendChild(t);
          setTimeout(function () { if (t && t.parentNode) t.remove(); }, CFG.TOAST_MS);
        }

        /* ---------- fix13: date-selected nudge ----------
           Selecting a date card only sets the variant; visitors often think the
           selection IS the booking and walk away. On every card click we (a) show a
           confirm toast spelling out the next step, and (b) scroll the Book Now
           button into view and pulse it so the next action is unmistakable. */
        function showPickToast(bookBtn) {
          var t = document.getElementById('ar-pick-toast');
          if (t) t.remove();
          t = document.createElement('div');
          t.id = 'ar-pick-toast';
          t.innerHTML = '\u2713 Date selected \u2014 now tap <b>BOOK NOW</b> below to add it to your basket';
          document.body.appendChild(t);
          requestAnimationFrame(function () { t.classList.add('ar-show'); });
          try {
            var target = bookBtn && (bookBtn.closest('.ar-btn-row') || bookBtn.closest('.sqs-add-to-cart-button-wrapper') || bookBtn);
            if (target) {
              var r = target.getBoundingClientRect();
              var offscreen = r.top < 70 || r.bottom > (window.innerHeight || document.documentElement.clientHeight) - 10;
              if (offscreen && target.scrollIntoView) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
              bookBtn.classList.remove('ar-pulse');
              void bookBtn.offsetWidth;
              bookBtn.classList.add('ar-pulse');
              setTimeout(function () { bookBtn.classList.remove('ar-pulse'); }, 2600);
            }
          } catch (e) {}
          clearTimeout(showPickToast._t);
          showPickToast._t = setTimeout(function () {
            if (!t || !t.parentNode) return;
            t.classList.remove('ar-show');
            setTimeout(function () { if (t && t.parentNode) t.remove(); }, 350);
          }, 4200);
        }

        /* ---------- fix15: sticky bottom CTA bar ----------
           Appears once the visitor has scrolled past the date cards; reads the
           workshop's own title + price dynamically so it adapts per page. The
           "See dates & book" button smooth-scrolls back up to the date cards.
           Only built when both date cards and a Book button exist (so it never
           shows on non-bookable / 0-variant products). */
        function buildStickyCta(item) {
          try {
            if (document.getElementById('ar-sticky')) return;
            var cards = document.querySelector('.ar-cards');
            var bookBtn = Array.prototype.slice.call(document.querySelectorAll('.sqs-add-to-cart-button')).find(vis);
            if (!cards || !bookBtn) return;

            var titleEl = document.querySelector('.ProductItem-details-title');
            var title = titleEl ? titleEl.textContent.trim() : 'This workshop';
            var priceEl = Array.prototype.slice.call(document.querySelectorAll('.product-price, .ProductItem-product-price, .sqs-money-native'))
              .find(function (e) { return vis(e) && /\d/.test(e.textContent); });
            var priceText = priceEl ? priceEl.textContent.trim().replace(/\s+/g, ' ') : '';

            var bar = document.createElement('div');
            bar.id = 'ar-sticky';
            bar.innerHTML = '<div class="ar-sk-in">'
              + '<div class="ar-sk-txt"><span class="ar-sk-title">' + esc(title) + '</span>'
              + '<span class="ar-sk-price">' + esc(priceText) + '</span>'
              + '</div>'
              + '<button type="button" class="ar-sk-btn">See dates &amp; book</button>'
              + '</div>';
            document.body.appendChild(bar);

            /* fix17: cart-state-aware sticky bar - flips to "go to cart & checkout" once an item is in the basket */
            function cartCount() {
              var el = document.querySelector('.sqs-cart-quantity');
              var n = el ? parseInt((el.textContent || '').replace(/\D/g, ''), 10) : 0;
              return isNaN(n) ? 0 : n;
            }
            function renderState() {
              var inCart = cartCount() > 0;
              var b = bar.querySelector('.ar-sk-btn');
              var priceSpan = bar.querySelector('.ar-sk-price');
              if (inCart) {
                if (priceSpan) priceSpan.textContent = '\u2713 Added to cart \u2014 find it via the basket, top right';
                b.textContent = 'Go to cart & checkout \u2192';
                bar.dataset.mode = 'cart';
              } else {
                if (priceSpan) priceSpan.textContent = priceText;
                b.textContent = 'See dates & book';
                bar.dataset.mode = 'dates';
              }
            }

            bar.querySelector('.ar-sk-btn').addEventListener('click', function () {
              if (bar.dataset.mode === 'cart') { window.location.href = '/cart'; return; }
              var target = document.querySelector('.ar-cards') || bookBtn.closest('.sqs-add-to-cart-button-wrapper') || bookBtn;
              if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            renderState();
            var _lastCount = cartCount();
            setInterval(function () { var c = cartCount(); if (c !== _lastCount) { _lastCount = c; renderState(); } }, 1500);
            bookBtn.addEventListener('click', function () { setTimeout(renderState, 1000); });

            function onScroll() {
              var r = cards.getBoundingClientRect();
              var pastCards = r.bottom < 80;
              var nearBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 140);
              if (pastCards && !nearBottom) bar.classList.add('ar-show');
              else bar.classList.remove('ar-show');
            }
            var ticking = false;
            window.addEventListener('scroll', function () {
              if (ticking) return; ticking = true;
              requestAnimationFrame(function () { onScroll(); ticking = false; });
            }, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
            onScroll();
          } catch (e) {}
        }

        /* ---------- main ---------- */
        async function init() {
          if (document.getElementById('ar-pb-style')) return;

          var item = document.querySelector('.ProductItem');
          if (!item) return;

          var style = document.createElement('style');
          style.id = 'ar-pb-style';
          style.textContent = CSS;
          document.head.appendChild(style);

          var product = null;
          try {
            var manifest = await fetch(CFG.SCHEMA_HOST + 'products-manifest.json').then(function (r) { return r.json(); });
            var entry = (manifest.entries || []).find(function (e) { return arNormPath(e.pathKey) === arNormPath(location.pathname); });
            if (entry && entry.schemaFileName) {
              var schema = await fetch(CFG.SCHEMA_HOST + entry.schemaFileName).then(function (r) { return r.json(); });
              var nodes = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
              product = arFindProductNode(nodes);
              arInjectGithubSchema(schema);
              arRemoveLegacyDuplicateProducts();
            }
          } catch (e) {}

          var variants = [];
          var categories = [];
          try {
            var pj = await fetch(location.pathname + '?format=json', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
            variants = (pj.item && pj.item.variants) || [];
            categories = (pj.item && pj.item.categories) || [];
          } catch (e) {}
          /* ---------- fix18: fallback to SQUARESPACE_CONTEXT when ?format=json is broken ----------
             Squarespace's ?format=json endpoint broke site-wide (~13 Sep 2026),
             returning a truncated voltronCache blob that fails to parse, so the
             fetch above throws and variants ends up []. The same variant data is
             present inline in window.Static.SQUARESPACE_CONTEXT.product.variants.
             We rebuild variants from there and NORMALISE the shape to match what
             ?format=json returned, so every downstream consumer (money(), stock
             badges, sold-out, cards, sticky bar) works unchanged:
               price -> {value:<pounds>} object; salePrice -> pence Number (money() guard)
               qtyInStock <- stock.quantity ; unlimited <- stock.unlimited
             Categories are NOT present in CONTEXT, so Duration falls back to the
             loader's date-parsing path (styleSummary derives it from date labels).
             Purely additive: if ?format=json recovers, variants.length is truthy
             and this block never runs. Rollback: delete this block. Ref case #14652500. */
          if (!variants.length) {
            try {
              var ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
              var ctxP = ctx && ctx.product;
              var ctxV = (ctxP && ctxP.variants) || [];
              if (ctxV.length) {
                variants = ctxV.map(function (v) {
                  var st = v.stock || {};
                  return {
                    id: v.id,
                    sku: v.sku,
                    price: arPricePounds(v.price),
                    salePrice: arSalePence(v.salePrice),
                    onSale: !!v.onSale,
                    attributes: v.attributes || {},
                    qtyInStock: (st.unlimited ? null : (st.quantity != null ? st.quantity : null)),
                    unlimited: !!st.unlimited
                  };
                });
              }
              if (!categories.length) {
                var ctxItem = ctx && ctx.item;
                if (ctxItem && ctxItem.categories && ctxItem.categories.length) { categories = ctxItem.categories; }
                else if (ctx && ctx.collection && ctx.collection.categories && ctx.collection.categories.length) { categories = ctx.collection.categories; }
              }
            } catch (e) {}
          }

          try { styleSummary(variants, categories); } catch (e) {}

          var h1 = Array.prototype.slice.call(document.querySelectorAll('h1')).find(function (h) { return vis(h) && h.closest('.ProductItem'); });
          if (h1 && product && product.aggregateRating && !document.querySelector('.ar-rating')) {
            var agg = product.aggregateRating;
            var r = document.createElement('div');
            r.className = 'ar-rating';
            r.innerHTML = '<span class="ar-stars">\u2605\u2605\u2605\u2605\u2605</span> <b>' + esc(agg.ratingValue) + '</b> \u00b7 ' + plural(agg.reviewCount, 'review') + ' <span style="color:#bbb">\u00b7 Google &amp; Trustpilot</span>';
            h1.after(r);
            r.style.order = getComputedStyle(h1).order;
          }

          var btn = Array.prototype.slice.call(document.querySelectorAll('.sqs-add-to-cart-button')).find(vis);
          var sel = document.querySelector('.product-variants select');
          if (btn && variants.length) {
            var wrap = document.createElement('div');
            wrap.className = 'ar-cards';
            function splitLabel(s) {
              s = String(s);
              var re = /\d{1,2}([:.][0-5]\d)?\s*(am|pm)/ig, m;
              while ((m = re.exec(s))) {
                var prev = m.index > 0 ? s.charAt(m.index - 1) : '';
                if (!/\d/.test(prev)) {
                  return {
                    date: s.slice(0, m.index).replace(/[\s\-\u2013]+$/, ''),
                    time: s.slice(m.index).trim()
                  };
                }
              }
              return { date: s, time: '' };
            }
            function summaryDateParts() {
              try {
                var ex = document.querySelector('.ProductItem-details-excerpt') || document.querySelector('.ProductItem-additional');
                if (ex) {
                  var m = ex.innerText.match(/Dates?:\s*\n?\s*([^\n]+)/i);
                  if (m) {
                    var s = m[1].trim();
                    var p = splitLabel(s);
                    if (p.time) return p;
                    s = s.replace(/,?\s*\d{1,2}:\d{2}\s*(am|pm)?/gi, ' ').replace(/\s{2,}/g, ' ').trim();
                    var d = s.match(/^(.*?)[\s\-\u2013]+(\d+\s*Days?(?:\/\d+\s*Nights?)?.*)$/i);
                    if (d) return { date: d[1].replace(/[\s\-\u2013]+$/, ''), time: d[2].trim() };
                    return { date: s, time: '' };
                  }
                }
              } catch (e) {}
              return { date: 'Available option', time: '' };
            }
            variants.forEach(function (v, i) {
              var lbl = Object.values(v.attributes || {})[0];
              var parts;
              if (lbl) { parts = splitLabel(lbl); }
              else if (variants.length === 1) { parts = summaryDateParts(); lbl = parts.date; }
              else { lbl = 'Option ' + (i + 1); parts = { date: lbl, time: '' }; }
              var qty = v.unlimited ? null : (v.qtyInStock != null ? v.qtyInStock : null);
              var card = document.createElement('div');
              card.className = 'ar-card' + (qty === 0 ? ' out' : '');
              card.dataset.sku = v.sku || '';
              var stockHtml = '';
              if (qty != null && qty > 0) stockHtml = '<div class="a' + (qty <= 3 ? ' low' : '') + '">' + qty + ' places left</div>';
              card.innerHTML = '<div class="d">' + esc(parts.date) + '</div>'
                + (parts.time ? '<div class="t">' + esc(parts.time) + '</div>' : '')
                + stockHtml
                + '<div class="p">' + money(v) + '</div>';
              if (qty !== 0) {
                card.addEventListener('click', function () {
                  wrap.querySelectorAll('.ar-card').forEach(function (c) { c.classList.remove('sel'); });
                  card.classList.add('sel');
                  if (sel) {
                    for (var k = 0; k < sel.options.length; k++) {
                      if (sel.options[k].textContent.trim() === String(lbl).trim()) {
                        sel.value = sel.options[k].value;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                        break;
                      }
                    }
                  }
                  /* fix13: confirm the pick and point the visitor at Book Now */
                  showPickToast(btn);
                });
              }
              wrap.appendChild(card);
            });

            var dm = null;
            if (variants.length > CFG.EXPAND_THRESHOLD) {
              wrap.querySelectorAll('.ar-card').forEach(function (c, i) { if (i >= CFG.VISIBLE_CARDS) c.classList.add('ar-hide'); });
              dm = document.createElement('div');
              dm.className = 'ar-dates-more';
              var pill = document.createElement('span');
              pill.className = 'ar-pill';
              pill.textContent = 'Show all ' + variants.length + ' options \u25be';
              var open = false;
              pill.addEventListener('click', function () {
                open = !open;
                wrap.querySelectorAll('.ar-card').forEach(function (c, i) {
                  if (i >= CFG.VISIBLE_CARDS) {
                    if (open) c.classList.remove('ar-hide');
                    else if (!c.classList.contains('sel')) c.classList.add('ar-hide');
                  }
                });
                pill.textContent = open ? 'Show fewer options \u25b4' : 'Show all ' + variants.length + ' options \u25be';
              });
              dm.appendChild(pill);
            }

            var cont = btn.closest('.ProductItem-details') || item;
            var varBox = Array.prototype.slice.call(cont.querySelectorAll('.product-variants')).find(vis);
            var price = Array.prototype.slice.call(cont.querySelectorAll('.product-price')).find(vis);
            var o = '4';
            if (varBox) {
              o = getComputedStyle(varBox).order;
              varBox.parentNode.insertBefore(wrap, varBox);
              if (dm) varBox.parentNode.insertBefore(dm, varBox);
            } else if (price) {
              o = String(Number(getComputedStyle(price).order) + 1);
              price.after(wrap);
              if (dm) wrap.after(dm);
            } else {
              var host = btn.closest('div');
              host.parentNode.insertBefore(wrap, host);
              if (dm) host.parentNode.insertBefore(dm, host);
            }
            wrap.style.order = o;
            if (dm) dm.style.order = o;
          }

          /* fix16: pre-select a date from #ar-date=<SKU> when arriving from a landing-page tile */
          try {
            var arHash = (location.hash.match(/ar-date=([^&]+)/) || [])[1];
            if (arHash) {
              var wantSku = decodeURIComponent(arHash);
              var pick = document.querySelector('.ar-card[data-sku="' + (window.CSS && CSS.escape ? CSS.escape(wantSku) : wantSku) + '"]');
              if (pick) { pick.classList.remove('ar-hide'); pick.click(); pick.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            }
          } catch (e) {}

          if (btn && !btn.dataset.arToast) {
            btn.dataset.arToast = '1';
            btn.addEventListener('click', function () { setTimeout(showToast, 900); });
          }

          if (btn && !btn.hasAttribute('data-ar-tip')) {
            btn.setAttribute('data-ar-tip', 'Book your place \u2014 this adds your selection to the cart for checkout. Find your cart via the basket symbol: top right of the menu on desktop, bottom of the screen on mobile.');
          }
          var regBtn = Array.prototype.slice.call(document.querySelectorAll('a, button')).find(function (el) {
            return vis(el) && /register\s*interest/i.test(el.textContent || '');
          });
          if (regBtn && !regBtn.hasAttribute('data-ar-tip')) {
            regBtn.setAttribute('data-ar-tip', 'Sends an email to Alan to confirm your interest \u2014 please include any questions you need answered to proceed with a booking. Register Interest does not create a booking or reserve your place.');
          }

          try {
            var bookWrap = document.querySelector('.sqs-add-to-cart-button-wrapper');
            var regWrap = document.querySelector('.register-interest-button');
            if (bookWrap && regWrap && bookWrap.parentNode === regWrap.parentNode
                && !document.querySelector('.ar-btn-row')) {
              var row = document.createElement('div');
              row.className = 'ar-btn-row';
              row.style.order = getComputedStyle(bookWrap).order;
              bookWrap.parentNode.insertBefore(row, bookWrap);
              row.appendChild(bookWrap);
              row.appendChild(regWrap);
              regWrap.classList.add('ar-reg-compact');
            }
          } catch (e) {}

          if (product && product.review && !document.getElementById('ar-reviews')) {
            var revs = Array.isArray(product.review) ? product.review : [product.review];
            if (revs.length) {
              var sec = document.createElement('div');
              sec.id = 'ar-reviews';
              var ratingVal = product.aggregateRating ? product.aggregateRating.ratingValue : '5.0';
              var totalReviews = product.aggregateRating && product.aggregateRating.reviewCount != null
                ? Number(product.aggregateRating.reviewCount) : revs.length;
              if (!(totalReviews > 0)) totalReviews = revs.length;
              var showingN = revs.length;
              function rcard(rv) {
                var body = String(rv.reviewBody || '');
                var srcName = (rv.publisher && rv.publisher.name) || 'Review';
                return '<div class="ar-rev" tabindex="0"><div class="st">\u2605\u2605\u2605\u2605\u2605</div><div class="w">' + esc(rv.author && rv.author.name) + ' <span class="s">' + esc(srcName) + '</span></div><p>\u201c' + esc(body) + '\u201d</p><span class="ar-rev-more" aria-hidden="true">Read more \u25be</span></div>';
              }
              sec.innerHTML = '<h2>What attendees say</h2>'
                + '<div class="ar-sub"><span class="ar-stars">\u2605\u2605\u2605\u2605\u2605</span> <b>' + esc(ratingVal) + '</b> from ' + plural(totalReviews, 'review') + ' \u00b7 showing the ' + showingN + ' most recent</div>'
                + '<div class="ar-revgrid">' + revs.slice(0, CFG.REVIEWS_VISIBLE).map(rcard).join('') + '</div>'
                + (revs.length > CFG.REVIEWS_VISIBLE ? '<button id="ar-more" type="button">Show all ' + showingN + ' recent reviews + ' \u25be</button>' : '');
              var accBlocks = document.querySelectorAll('.sqs-block-accordion');
              var anchor = (accBlocks.length ? accBlocks[accBlocks.length - 1] : null)
                || document.querySelector('.ProductItem-additional') || item;
              anchor.after(sec);

              function wireReviewCards(gridEl) {
                Array.prototype.forEach.call(gridEl.querySelectorAll('.ar-rev'), function (cardEl) {
                  var p = cardEl.querySelector('p');
                  if (!p) return;
                  cardEl.classList.add('ar-clamp');
                  if (p.scrollHeight <= p.clientHeight + 2) {
                    cardEl.classList.remove('ar-clamp');
                    return;
                  }
                  if (cardEl.dataset.arWired) return;
                  cardEl.dataset.arWired = '1';
                  cardEl.addEventListener('click', function () { cardEl.classList.toggle('ar-open'); });
                  cardEl.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardEl.classList.toggle('ar-open'); }
                  });
                });
              }
              var grid0 = sec.querySelector('.ar-revgrid');
              if (grid0) wireReviewCards(grid0);

              var more = sec.querySelector('#ar-more');
              if (more) {
                var grid = sec.querySelector('.ar-revgrid');
                var expanded = false;
                more.addEventListener('click', function () {
                  expanded = !expanded;
                  grid.innerHTML = (expanded ? revs : revs.slice(0, CFG.REVIEWS_VISIBLE)).map(rcard).join('');
                  more.textContent = expanded ? 'Show fewer \u25b4' : 'Show all ' + showingN + ' recent reviews + ' \u25be';
                  wireReviewCards(grid);
                });
              }
            }
          }

          /* fix15: build the sticky bottom CTA bar (bookable pages only). */
          buildStickyCta(item);
        }

        /* ---------- v1.9: style the native Summary IN PLACE ---------- */
        function arBuildDates(variants, originalLi) {
          var host = document.createElement('div'); host.className = 'ar-sdates';
          var labels = (variants || []).map(function (v) { return Object.values(v.attributes || {})[0] || ''; }).filter(Boolean);
          var dateLike = labels.filter(function (s) {
            return /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s) || /\d{1,2}\s*[\/-]\s*\d{1,2}/.test(s);
          });
          if (!dateLike.length) {
            if (originalLi) {
              var subList = originalLi.querySelector('ul, ol');
              var subLis = subList ? subList.querySelectorAll(':scope > li') : [];
              if (subLis.length) {
                Array.prototype.forEach.call(subLis, function (sli) {
                  var txt = (sli.textContent || '').trim();
                  if (!txt) return;
                  var c = document.createElement('span'); c.className = 'ar-dchip'; c.textContent = txt; host.appendChild(c);
                });
                if (host.childNodes.length) return host;
              }
              var rest = arStripLabel(originalLi.innerHTML);
              host.innerHTML = '<span class="ar-sval">' + rest + '</span>';
            }
            return host;
          }
          function dayKey(s) {
            var d = String(s).split(/\s+[-\u2013]\s+/)[0].trim();
            d = d.replace(/\s+(all\s*day|sunrise|sunset|mid[-\s]?morning|morning|afternoon|evening)\b.*$/i, '').trim();
            d = d.replace(/\s+(am|pm)\b\.?\s*$/i, '').trim();
            d = d.replace(/[,\s]+\d{4}\s*$/, '').trim();
            d = d.replace(/\s+/g, ' ').trim();
            return d;
          }
          var days = [];
          dateLike.forEach(function (s) { var d = dayKey(s); if (d && days.indexOf(d) === -1) days.push(d); });
          if (days.length <= 6) {
            var singlePerDay = days.length === dateLike.length;
            if (singlePerDay) {
              var seen = {};
              dateLike.forEach(function (s) {
                var l = s.trim(); if (seen[l]) return; seen[l] = 1;
                var c = document.createElement('span'); c.className = 'ar-dchip'; c.textContent = l; host.appendChild(c);
              });
            } else {
              days.forEach(function (d) {
                var c = document.createElement('span'); c.className = 'ar-dchip'; c.textContent = d; host.appendChild(c);
              });
            }
          } else {
            var banner = document.createElement('div'); banner.className = 'ar-drange';
            banner.textContent = days[0] + ' \u2013 ' + days[days.length - 1] + '  \u00b7  ' + days.length + ' dates';
            host.appendChild(banner);
            var pills = document.createElement('div'); pills.className = 'ar-dpills';
            days.forEach(function (d) {
              var p = document.createElement('span'); p.className = 'ar-dpill';
              p.textContent = d.replace(/[,\s]+\d{2,4}$/, '').trim() || d; pills.appendChild(p);
            });
            host.appendChild(pills);
          }
          return host;
        }
        function arStripLabel(html) {
          return String(html).replace(/^\s*<(strong|b)[^>]*>.*?<\/\1>\s*:?\s*/i, '').trim();
        }
        var AR_FIT_TIPS = {
          '1': 'Fitness 1 \u00b7 Easy: most people should manage the short walks (5\u201315 mins, less than a mile) with occasional steps or gradual gradients.',
          '2': 'Fitness 2 \u00b7 Moderate: most people with average fitness should comfortably manage the walks (15\u201330 mins, around 1 mile) with occasional steps or gradients.',
          '3': 'Fitness 3 \u00b7 Hard: longer walks (30\u201345 mins, 1\u20132 miles) with frequent steps and steeper gradients.'
        };
        var AR_LEVEL_TIP = 'Suitable for any level including beginners. Every participant gets 1-2-1 tuition tailored to their needs \u2014 no prior knowledge required.';

        function styleSummary(variants, categories) {
          try {
            var ex = document.querySelector('.ProductItem-details-excerpt');
            if (!ex || ex.getAttribute('data-ar-summary') === '1') return;
            var ul = ex.querySelector('ul, ol');
            if (!ul) return;
            var lis = Array.prototype.slice.call(ul.children).filter(function (n) { return n.tagName === 'LI'; });
            if (!lis.length) return;

            function parseRow(li) {
              var host = li.querySelector(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > div') || li;
              var strong = host.querySelector('strong, b');
              var label = strong ? strong.textContent.replace(/:\s*$/, '').trim() : '';
              var clone = li.cloneNode(true);
              var s2 = clone.querySelector('strong, b');
              if (s2) s2.remove();
              var valueHtml = clone.innerHTML.replace(/^(?:\s|&nbsp;|\u00a0)*:?(?:\s|&nbsp;|\u00a0)*/, '').trim();
              return { label: label, valueHtml: valueHtml, text: (li.innerText || '').trim(), el: li };
            }
            var rows = lis.map(parseRow);
            function find(re) { return rows.find(function (r) { return re.test(r.label); }) || { valueHtml: '', text: '', el: null }; }

            var cats = (categories || []).map(function (c) { return String(c).toLowerCase(); });
            function catHas(re) { return cats.some(function (c) { return re.test(c); }); }

            var dlabels = (variants || []).map(function (v) { return Object.values(v.attributes || {})[0] || ''; }).filter(Boolean);
            var dateLike = dlabels.filter(function (s) { return /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(s); });
            var durSrc = dateLike.slice();
            if (!durSrc.length) {
              var _dr = find(/^date/i);
              if (_dr && _dr.el) durSrc = [_dr.el.innerText || ''];
            }
            var durs = [], nightsFor = {};
            durSrc.forEach(function (s) {
              var dn = String(s).match(/(\d+)\s*Days?\s*\/\s*(\d+)\s*Nights?/i);
              if (dn) { var d = +dn[1]; if (durs.indexOf(d) === -1) durs.push(d); nightsFor[d] = +dn[2]; return; }
              var dm = String(s).match(/(\d+)\s*Days?/i);
              if (dm) { var d2 = +dm[1]; if (durs.indexOf(d2) === -1) durs.push(d2); }
            });
            durs.sort(function (a, b) { return a - b; });
            function daysNights() {
              if (durs.length === 1) {
                return nightsFor[durs[0]]
                  ? (durs[0] + ' Days/' + nightsFor[durs[0]] + ' Nights')
                  : (durs[0] + (durs[0] === 1 ? ' Day' : ' Days'));
              }
              if (durs.length > 1) return durs[0] + '\u2013' + durs[durs.length - 1] + ' Days';
              return '';
            }

            var isHalf = catHas(/half[\s-]?day/);
            var isOne  = catHas(/one[\s-]?day|full[\s-]?day|1[\s-]?day/);
            var dur = '';
            if (catHas(/residential/)) { dur = daysNights() || 'Residential'; }
            else if (isHalf && isOne) { dur = 'Half or 1 Day'; }
            else if (isHalf) { dur = 'Half Day'; }
            else if (isOne) { dur = '1 Day'; }
            else { dur = daysNights(); }

            var loc = find(/^location/i).text.replace(/^location:?\s*/i, '').trim();
            var grp = find(/^participant/i).text.replace(/^participants:?\s*/i, '').trim();
            var fit = find(/^fitness/i).text.replace(/^fitness:?\s*/i, '').trim();
            var lvl = find(/^experience/i).text.replace(/^experience level:?\s*/i, '').trim();
            var fitTip = AR_FIT_TIPS[(fit.match(/\d/) || [])[0]] || '';

            var box = document.createElement('div'); box.className = 'ar-sbox';
            var strip = document.createElement('div'); strip.className = 'ar-strip';
            function cell(k, v, tip) {
              if (!v) return '';
              return '<div class="c' + (tip ? ' tip' : '') + '"' + (tip ? (' data-tip="' + esc(tip) + '"') : '') + '>'
                + '<div class="k">' + k + '</div><div class="v">' + esc(v) + '</div></div>';
            }
            strip.innerHTML = cell('Location', loc) + cell('Duration', dur) + cell('Group', grp)
              + cell('Fitness', fit, fitTip) + cell('Level', lvl, AR_LEVEL_TIP);
            box.appendChild(strip);

            var grid = document.createElement('div'); grid.className = 'ar-summary';
            var datesRow = find(/^date/i);
            var rowsOut = [
              ['Dates', { dates: true, src: datesRow }],
              ['Equipment', find(/^equipment/i)],
              ['Event Details', find(/event detail|workshop event/i)]
            ];
            var first = true;
            rowsOut.forEach(function (pair) {
              var lab = pair[0], r = pair[1], valHtml;
              if (r.dates) { valHtml = ''; }
              else { if (!r.valueHtml) return; valHtml = r.valueHtml; }
              var fc = first ? ' ar-first' : '';
              if (r.dates) {
                var ld = document.createElement('div'); ld.className = 'ar-slabel' + fc; ld.textContent = 'Dates';
                var vd = document.createElement('div'); vd.className = 'ar-sval' + fc;
                vd.appendChild(arBuildDates(variants, r.src && r.src.el ? r.src.el : null));
                grid.appendChild(ld); grid.appendChild(vd);
              } else {
                grid.insertAdjacentHTML('beforeend', '<div class="ar-slabel' + fc + '">' + esc(lab) + '</div><div class="ar-sval' + fc + '">' + valHtml + '</div>');
              }
              first = false;
            });

            var desc = find(/^description/i);
            if (desc.valueHtml) {
              grid.insertAdjacentHTML('beforeend',
                '<div class="ar-srow-desc"><div class="ar-desc-lab">Overview</div><div class="ar-desc-body">' + desc.valueHtml + '</div></div>');
            }
            box.appendChild(grid);

            ul.parentNode.insertBefore(box, ul);
            ul.style.display = 'none';
            ex.setAttribute('data-ar-summary', '1');
          } catch (e) {}
        }

        /* ---------- bootstrap ---------- */
        function boot() {
          if (inEditor()) { try { document.body.classList.add('ar-fp-edit-mode'); } catch (e) {} return; }
          var tries = 0;
          var t = setInterval(function () {
            tries++;
            if (document.querySelector('.ProductItem') || tries > 20) {
              clearInterval(t);
              init().catch(function () {});
            }
          }, 300);
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    })();
  } else {
    (function arServicesProductPage() {
      'use strict';

        var CFG = {
          VISIBLE_CARDS: 6, EXPAND_THRESHOLD: 8, REVIEWS_VISIBLE: 4,
          REVIEW_CHARS: 300, TOAST_MS: 9000,
          SCHEMA_HOST: 'https://schema.alanranger.com/'
        };

        var AR_NO_REVIEWS = []; /* emptied 2026-10-07: badge when rated reviewCount >= 1 */

        var AR_TILE_MAP = [
          { key: 'Location',     match: /^location/i },
          { key: 'Duration',     match: /^duration/i },
          { key: 'Participants', match: /^participant/i },
          { key: 'Time',         match: /^time\b/i },
          { key: 'Format',       match: /^format/i },
          { key: 'Sessions',     match: /^sessions?\b|^package options?/i },
          { key: 'Availability', match: /^availability|^available/i },
          { key: 'Level',        match: /^(experience|level)/i },
          { key: 'Billing',      match: /^billing|^subscription|^renewal/i },
          { key: 'Validity',     match: /^validity|^valid for|^must be used/i }
        ];
        var AR_TILE_SKIP = /^description|^overview|^next steps|^booking|^terms|^benefits|^method|^equipment|^gift voucher ideas|^5 reasons|^choose a package|^order/i;
        var AR_DATE_LABELS = /start date|multi course start|event details|^dates?\b/i;

        function inEditor() {
          try {
            return window.self !== window.top ||
              document.body.classList.contains('sqs-edit-mode') ||
              document.body.classList.contains('sqs-edit-mode-active');
          } catch (e) { return true; }
        }
        function vis(el) { return !!(el && el.offsetParent !== null); }
        function money(v) {
          var p = (v.onSale && v.salePrice != null && Number(v.salePrice) > 0) ? v.salePrice : v.price;
          if (p && typeof p === 'object' && p.value != null) { p = parseFloat(p.value); }
          else { p = Number(p) / 100; }
          return '\u00a3' + p.toLocaleString('en-GB');
        }
        function esc(s) {
          return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
          });
        }
        function plural(n, w) { return n + ' ' + w + (Number(n) === 1 ? '' : 's'); }
        function slugNow() { return location.pathname.split('/').filter(Boolean).pop() || ''; }

        /* ---------- v2.3: normalise SQUARESPACE_CONTEXT money fields to match ?format=json ----------
           money() treats price and salePrice DIFFERENTLY:
             - it guards on Number(v.salePrice) > 0, so salePrice must be a plain
               NUMBER; it then does Number(p)/100, so that number must be PENCE.
             - price falls through to the object branch parseFloat(p.value), so price
               must be an OBJECT whose .value is POUNDS.
           CONTEXT gives both as objects with .value in PENCE and .decimalValue in
           POUNDS, so convert each to the shape money() expects:
             arPricePounds(price)   -> { value: <pounds> }   (object, pounds)
             arSalePence(salePrice) -> <pence Number>         (plain number, pence) */
        function arPricePounds(m) {
          if (m == null) return null;
          if (typeof m === 'object') {
            if (m.decimalValue != null) return { value: parseFloat(m.decimalValue) };
            if (m.value != null) return { value: Number(m.value) / 100 };
            return null;
          }
          return { value: Number(m) / 100 };
        }
        function arSalePence(m) {
          if (m == null) return null;
          if (typeof m === 'object') {
            if (m.value != null) return Number(m.value);                       /* .value is pence */
            if (m.decimalValue != null) return Math.round(parseFloat(m.decimalValue) * 100);
            return null;
          }
          return Number(m);                                                    /* already a pence number */
        }

        var CSS = ''
          + 'body:not(.ar-fp-edit-mode) .ar-rating{display:flex;align-items:center;gap:8px;font:13.5px "Segoe UI",sans-serif;color:#555;margin:8px 0 4px}'
          + 'body:not(.ar-fp-edit-mode) .ar-stars{color:#f5a623;font-size:16px;letter-spacing:2px}'
          + 'body:not(.ar-fp-edit-mode) .ar-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0 10px;max-width:480px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card{position:relative;border:1.5px solid #dcc6aa;border-radius:8px;padding:12px 13px 30px;cursor:pointer;background:#fdf6ee;font-family:inherit;transition:transform .15s ease,box-shadow .15s ease,border-color .15s ease,background .15s ease}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:before{content:"Select \\2192";position:absolute;left:13px;bottom:9px;font-size:11px;font-weight:700;letter-spacing:.02em;color:#e8853d;opacity:.85;transition:opacity .15s ease,transform .15s ease}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:hover{border-color:#e8853d;transform:translateY(-3px);box-shadow:0 6px 16px rgba(154,77,16,.22);background:#fffaf4}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:hover:before{opacity:1;transform:translateX(3px)}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:active{transform:translateY(-1px);box-shadow:0 2px 8px rgba(154,77,16,.25)}'
          + 'body:not(.ar-fp-edit-mode) .ar-card:focus-visible{outline:3px solid rgba(232,133,61,.55);outline-offset:2px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.ar-hide{display:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel{background:#f9e3c8;border:3px solid #9a4d0f;box-shadow:0 2px 10px rgba(154,77,16,.25);transform:none;padding:10.5px 11.5px 28.5px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel:before{content:"\\2713 Selected";color:#2e7d32;opacity:1;font-weight:800}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel:after{content:"\u2713";position:absolute;top:8px;right:8px;width:22px;height:22px;border-radius:50%;background:#2e7d32;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .d{font-weight:700;font-size:15px;color:#1a1a1a;padding-right:24px;line-height:1.35}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .t{font-size:13px;font-weight:600;color:#555;margin-top:3px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .p{font-size:18px;font-weight:800;margin-top:6px;color:#1a1a1a}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel .d{color:#3d2200}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel .t{color:#5c4326}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.sel .p{color:#7a3c10}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .a{font-size:12px;color:#3a8a3a;margin-top:6px;font-weight:700}'
          + 'body:not(.ar-fp-edit-mode) .ar-card .a.low{color:#c2571f}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out{cursor:default;border-style:dashed;padding:12px 13px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out:before{display:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out:hover{transform:none;box-shadow:none;border-color:#dcc6aa;background:#fdf6ee}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out:after{content:"SOLD OUT";position:absolute;top:8px;right:8px;background:#c62828;color:#fff;font-size:10px;font-weight:800;letter-spacing:.06em;padding:4px 9px;border-radius:11px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out .d{padding-right:74px}'
          + 'body:not(.ar-fp-edit-mode) .ar-card.out .p{color:#888;text-decoration:line-through}'
          + 'body:not(.ar-fp-edit-mode) .ar-pill{display:inline-block;border:1.5px solid #e8853d;color:#e8853d;border-radius:22px;padding:9px 22px;background:#fff;cursor:pointer;font:600 13px "Segoe UI",sans-serif;letter-spacing:.04em}'
          + 'body:not(.ar-fp-edit-mode) .ar-pill:hover{background:#e8853d;color:#fff}'
          + 'body:not(.ar-fp-edit-mode) .ar-dates-more{margin:0 0 16px}'
          + 'body:not(.ar-fp-edit-mode) .ar-sbox{border:1.5px solid #e0cdb0;background:#fdfaf5;border-radius:14px;padding:30px 22px 20px;margin:22px 0 18px;position:relative}'
          + 'body:not(.ar-fp-edit-mode) .ar-sbox:before{content:\'DETAILS\';position:absolute;top:-13px;left:18px;background:#c96a1e;color:#fff;font-size:12px;font-weight:700;letter-spacing:.1em;padding:5px 14px;border-radius:7px;box-shadow:0 2px 6px rgba(201,106,30,.3)}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;background:transparent}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .c{flex:1;min-width:110px;text-align:center;padding:13px 10px;position:relative;background:linear-gradient(#fbf2e4,#f5e6cf);border:1px solid #e3cda8;border-radius:9px}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .k{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#9a6b2f;font-weight:700;margin-bottom:6px;display:inline-block;border-bottom:1.5px solid #1a1a1a;padding-bottom:3px}'
          + 'body:not(.ar-fp-edit-mode) .ar-strip .v{font-size:15px;font-weight:700;color:#1f1206}'
          + 'body:not(.ar-fp-edit-mode) .ar-summary{display:grid;grid-template-columns:160px 1fr;column-gap:14px;font-size:14px;line-height:1.55;color:#33271b}'
          + 'body:not(.ar-fp-edit-mode) .ar-slabel{color:#7a5320;font-weight:700;display:flex;align-items:flex-start;gap:7px;padding:9px 0;border-top:1px solid #efe2cd}'
          + 'body:not(.ar-fp-edit-mode) .ar-slabel:before{content:"";width:7px;height:7px;border-radius:50%;background:#c96a1e;display:inline-block;flex:none;margin-top:6px}'
          + 'body:not(.ar-fp-edit-mode) .ar-sval{padding:9px 0;border-top:1px solid #efe2cd;color:#2b2118;min-width:0;overflow-wrap:anywhere;word-break:break-word}'
          + 'body:not(.ar-fp-edit-mode) .ar-sval a{overflow-wrap:anywhere;word-break:break-word}'
          + 'body:not(.ar-fp-edit-mode) .ar-summary .ar-first{border-top:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-sdates{display:flex;flex-wrap:wrap;gap:8px}'
          + 'body:not(.ar-fp-edit-mode) .ar-dchip{display:inline-block;max-width:100%;background:#fff;border:1px solid #ddbf94;color:#2b2118;border-radius:8px;padding:7px 13px;font-size:13.5px;font-weight:700;white-space:normal;overflow-wrap:anywhere}'
          + 'body:not(.ar-fp-edit-mode) .ar-srow-desc{grid-column:1 / -1;border-top:2px solid #ecd9bd;margin-top:6px;padding-top:14px}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-lab{color:#7a5320;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px;display:flex;align-items:center;gap:7px}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-lab:before{content:"";width:7px;height:7px;border-radius:50%;background:#c96a1e;display:inline-block}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-body{font-size:16.5px;line-height:1.7;color:#1c140c;font-weight:500}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-body p{margin:0 0 10px}'
          + 'body:not(.ar-fp-edit-mode) .ar-desc-body p:last-child{margin-bottom:0}'
          /* v2.0 ALIGNMENT: place .ProductItem-additional under the summary card by matching
             the product details column geometry (30% gallery + 80px details left-padding).
             Holds responsively; collapses to full width when the template stacks to 1 col. */
          + 'body:not(.ar-fp-edit-mode) .ProductItem-additional{margin-left:calc(30% + 80px);max-width:calc(70% - 80px);margin-right:0}'
          + 'body:not(.ar-fp-edit-mode) .ProductItem-additional [id^="arp-"]{max-width:none;margin-left:0;margin-right:0}'
          + '@media (max-width:767px){body:not(.ar-fp-edit-mode) .ProductItem-additional{margin-left:0;max-width:100%}}'
          /* button row (matches workshops loader) */
          + 'body:not(.ar-fp-edit-mode) .ar-btn-row{display:flex;align-items:center;flex-wrap:wrap;gap:22px;margin:4px 0 8px}'
          + 'body:not(.ar-fp-edit-mode) .ar-btn-row .sqs-add-to-cart-button-wrapper{margin:0}'
          + 'body:not(.ar-fp-edit-mode) .ar-btn-row .register-interest-button{margin:0}'
          + 'body:not(.ar-fp-edit-mode) .ar-reg-compact .sqs-block-button-element{padding:7px 16px !important;font-size:11.5px !important;letter-spacing:.04em;min-height:0 !important;line-height:1.2 !important;border-width:1px !important;opacity:.9}'
          + 'body:not(.ar-fp-edit-mode) .ar-reg-compact .sqs-block-button-element:hover{opacity:1}'
          + 'body:not(.ar-fp-edit-mode) #ar-reviews{max-width:1490px;margin:30px 0 50px;padding:0;font-family:"Segoe UI",sans-serif}'
          + 'body:not(.ar-fp-edit-mode) #ar-reviews h2{font-size:22px;font-weight:600;color:#222;margin:0 0 2px}'
          + 'body:not(.ar-fp-edit-mode) #ar-reviews .ar-sub{display:flex;align-items:center;gap:8px;color:#666;font-size:13.5px;margin:4px 0 18px}'
          + 'body:not(.ar-fp-edit-mode) .ar-revgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px;align-items:start}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev{border:1px solid #f0d9c2;border-radius:10px;padding:16px 18px;background:#fbeee1;position:relative}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev .st{color:#f5a623;font-size:13px;letter-spacing:1.5px;margin-bottom:6px}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev .w{font-size:13.5px;font-weight:600;color:#222;display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev .s{background:#fff;border-radius:10px;padding:2px 9px;font-size:10.5px;color:#9a6a3f;font-weight:600}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev p{font-size:13.5px;color:#2b2118;font-weight:600;line-height:1.6;margin-top:7px}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp p{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp.ar-open p,body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp:hover p,body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp:focus-within p{-webkit-line-clamp:unset;overflow:visible}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev-more{display:none}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp{cursor:pointer}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp .ar-rev-more{display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#c96a1e;letter-spacing:.02em}'
          + 'body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp.ar-open .ar-rev-more,body:not(.ar-fp-edit-mode) .ar-rev.ar-clamp:hover .ar-rev-more{display:none}'
          + 'body:not(.ar-fp-edit-mode) #ar-more{display:inline-block;margin-top:16px;border:1.5px solid #e8853d;color:#e8853d;border-radius:22px;padding:9px 22px;background:#fff;cursor:pointer;font:600 13px "Segoe UI",sans-serif;letter-spacing:.04em}'
          + 'body:not(.ar-fp-edit-mode) #ar-more:hover{background:#e8853d;color:#fff}'
          + 'body:not(.ar-fp-edit-mode) [data-ar-tip]{position:relative}'
          + 'body:not(.ar-fp-edit-mode) [data-ar-tip]:hover:before,body:not(.ar-fp-edit-mode) [data-ar-tip]:focus-visible:before{content:attr(data-ar-tip);position:absolute;bottom:calc(100% + 12px);left:0;width:300px;background:#1a1a1a;color:#fff;font:500 12.5px/1.55 "Segoe UI",sans-serif;letter-spacing:.01em;text-transform:none;padding:11px 14px;border-radius:9px;z-index:99999;white-space:normal;text-align:left;box-shadow:0 6px 20px rgba(0,0,0,.25);pointer-events:none}'
          + 'body:not(.ar-fp-edit-mode) [data-ar-tip]:hover:after,body:not(.ar-fp-edit-mode) [data-ar-tip]:focus-visible:after{content:"";position:absolute;bottom:calc(100% + 1px);left:26px;border:6px solid transparent;border-top-color:#1a1a1a;pointer-events:none}'
          + 'body:not(.ar-fp-edit-mode) .ProductItem-relatedProducts h2.ProductList-title{font-size:17px !important;line-height:1.4;font-weight:600;margin:10px 0 4px}'
          + 'body:not(.ar-fp-edit-mode) #ar-toast{position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:14px 18px 14px 22px;border-radius:12px;display:flex;gap:16px;align-items:center;z-index:999999;font:600 13.5px "Segoe UI",sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)}'
          + 'body:not(.ar-fp-edit-mode) #ar-toast a{background:#e8853d;color:#fff;padding:9px 18px;border-radius:20px;font-weight:700;text-decoration:none;white-space:nowrap}'
          + 'body:not(.ar-fp-edit-mode) #ar-toast a:hover{background:#c96a1e}'
          + 'body:not(.ar-fp-edit-mode) #ar-pick-toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,16px);opacity:0;background:#2e7d32;color:#fff;padding:13px 20px;border-radius:12px;z-index:999998;font:600 14px "Segoe UI",sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);max-width:92vw;text-align:center;transition:opacity .3s ease,transform .3s ease;pointer-events:none}'
          + 'body:not(.ar-fp-edit-mode) #ar-pick-toast.ar-show{opacity:1;transform:translate(-50%,0)}'
          + 'body:not(.ar-fp-edit-mode) #ar-pick-toast b{font-weight:800;letter-spacing:.03em}'
          + 'body:not(.ar-fp-edit-mode) .ar-pulse{animation:arPulse 1.3s ease-out 2}'
          + '@keyframes arPulse{0%{box-shadow:0 0 0 0 rgba(201,106,30,.55)}70%{box-shadow:0 0 0 14px rgba(201,106,30,0)}100%{box-shadow:0 0 0 0 rgba(201,106,30,0)}}'
          /* v2.2 STICKY BOTTOM CTA BAR (ported from workshops fix17) */
          + 'body:not(.ar-fp-edit-mode) #ar-sticky{position:fixed;left:0;right:0;bottom:0;z-index:999990;background:#1a1a1a;color:#fff;box-shadow:0 -4px 20px rgba(0,0,0,.22);transform:translateY(110%);transition:transform .32s cubic-bezier(.4,0,.2,1);font-family:"Segoe UI",sans-serif}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky.ar-show{transform:translateY(0)}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-in{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:12px 20px}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-txt{min-width:0;display:flex;flex-direction:column;line-height:1.3}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-title{font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:62vw}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-price{font-size:13px;color:#f0c89a;font-weight:600;margin-top:1px}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn{flex:none;background:#e8853d;color:#fff;border:none;border-radius:24px;padding:11px 26px;font:700 14px "Segoe UI",sans-serif;letter-spacing:.03em;cursor:pointer;white-space:nowrap;transition:background .15s ease,transform .15s ease}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn:hover{background:#c96a1e;transform:translateY(-1px)}'
          + 'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn:active{transform:translateY(0)}'
          + '@media (max-width:600px){'
          +   'body:not(.ar-fp-edit-mode) .ar-summary{grid-template-columns:1fr;column-gap:0}'
          +   'body:not(.ar-fp-edit-mode) .ar-slabel{padding:10px 0 2px;border-top:1px solid #efe2cd}'
          +   'body:not(.ar-fp-edit-mode) .ar-sval{padding:0 0 8px;border-top:none}'
          +   'body:not(.ar-fp-edit-mode) .ar-sval.ar-first{border-top:none}'
          +   'body:not(.ar-fp-edit-mode) .ar-sbox{padding:30px 16px 18px}'
          +   'body:not(.ar-fp-edit-mode) .ar-strip .c{min-width:calc(50% - 8px)}'
          +   'body:not(.ar-fp-edit-mode) .ar-btn-row{flex-direction:column;align-items:flex-start;gap:12px}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-in{padding:9px 14px;gap:12px}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-title{font-size:13px;max-width:52vw}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-price{font-size:12px}'
          +   'body:not(.ar-fp-edit-mode) #ar-sticky .ar-sk-btn{padding:10px 18px;font-size:13px}'
          + '}';

        function showToast() {
          var t = document.getElementById('ar-toast');
          if (t) t.remove();
          t = document.createElement('div'); t.id = 'ar-toast';
          t.innerHTML = '\u2713 Added to cart \u2014 go to cart to complete checkout <a href="/cart">Go to Cart \u2192</a>';
          document.body.appendChild(t);
          setTimeout(function () { if (t && t.parentNode) t.remove(); }, CFG.TOAST_MS);
        }

        function showPickToast(bookBtn) {
          var t = document.getElementById('ar-pick-toast');
          if (t) t.remove();
          t = document.createElement('div'); t.id = 'ar-pick-toast';
          t.innerHTML = '\u2713 Selected \u2014 now tap <b>BOOK NOW</b> below to add it to your basket';
          document.body.appendChild(t);
          requestAnimationFrame(function () { t.classList.add('ar-show'); });
          try {
            var target = bookBtn && (bookBtn.closest('.ar-btn-row') || bookBtn.closest('.sqs-add-to-cart-button-wrapper') || bookBtn);
            if (target) {
              var r = target.getBoundingClientRect();
              var offscreen = r.top < 70 || r.bottom > (window.innerHeight || document.documentElement.clientHeight) - 10;
              if (offscreen && target.scrollIntoView) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
              bookBtn.classList.remove('ar-pulse'); void bookBtn.offsetWidth; bookBtn.classList.add('ar-pulse');
              setTimeout(function () { bookBtn.classList.remove('ar-pulse'); }, 2600);
            }
          } catch (e) {}
          clearTimeout(showPickToast._t);
          showPickToast._t = setTimeout(function () {
            if (!t || !t.parentNode) return;
            t.classList.remove('ar-show');
            setTimeout(function () { if (t && t.parentNode) t.remove(); }, 350);
          }, 4200);
        }

        function tileKeyFor(label) {
          if (!label) return null;
          if (AR_TILE_SKIP.test(label)) return null;
          for (var i = 0; i < AR_TILE_MAP.length; i++) { if (AR_TILE_MAP[i].match.test(label)) return AR_TILE_MAP[i].key; }
          return null;
        }
        function tileVal(s) {
          s = String(s || '').replace(/\u00a0/g, ' ').trim();
          s = s.split(/[\n\r]/)[0].trim();
          s = s.replace(/\s+/g, ' ');
          if (s.length > 60) s = s.slice(0, 57).replace(/[\s,;:.\-]+$/, '') + '\u2026';
          return s;
        }
        function adaptiveSummary(variants) {
          try {
            var ex = document.querySelector('.ProductItem-details-excerpt');
            if (!ex || ex.getAttribute('data-ar-summary') === '1') return false;

            var ul = Array.prototype.slice.call(ex.querySelectorAll('ul, ol'))
              .filter(function (u) { return !u.closest('.sqs-block-accordion, .accordion-block'); })[0];
            if (!ul) return false;

            var topLis = Array.prototype.slice.call(ul.children).filter(function (n) { return n.tagName === 'LI'; });
            if (!topLis.length) return false;

            var boldLabelCount = topLis.filter(function (li) { return li.querySelector('strong, b'); }).length;
            if (boldLabelCount < 1) return false;

            function parseRow(li) {
              var strong = li.querySelector('strong, b');
              var label = strong ? strong.textContent.replace(/:\s*$/, '').replace(/\s*[-\u2013]\s*$/, '').trim() : '';
              var clone = li.cloneNode(true);
              var s2 = clone.querySelector('strong, b'); if (s2) s2.remove();
              var valueHtml = clone.innerHTML.replace(/^(?:\s|&nbsp;|\u00a0)*:?(?:\s|&nbsp;|\u00a0)*/, '').trim();
              var rawText = (li.innerText || '').replace(/\s+/g, ' ').trim();
              var valueText = label
                ? rawText.replace(new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*', 'i'), '').trim()
                : rawText;
              return { label: label, valueHtml: valueHtml, valueText: valueText, el: li };
            }
            var rows = topLis.map(parseRow);

            var tiles = [], bodyRows = [];
            rows.forEach(function (r) {
              if (r.label && AR_DATE_LABELS.test(r.label)) return;
              if (!r.label) return;
              var key = tileKeyFor(r.label);
              if (key && r.valueText) { tiles.push({ key: key, val: tileVal(r.valueText) }); }
              else if (r.valueHtml) { bodyRows.push(r); }
            });

            if (!tiles.length && !bodyRows.length) return false;

            var box = document.createElement('div'); box.className = 'ar-sbox';

            if (tiles.length) {
              tiles.sort(function (a, b) {
                function idx(k){ for(var i=0;i<AR_TILE_MAP.length;i++){ if(AR_TILE_MAP[i].key===k) return i; } return 99; }
                return idx(a.key) - idx(b.key);
              });
              var seenK = {};
              var strip = document.createElement('div'); strip.className = 'ar-strip';
              strip.innerHTML = tiles.filter(function (t) { if (seenK[t.key]) return false; seenK[t.key] = 1; return true; })
                .map(function (t) { return '<div class="c"><div class="k">' + esc(t.key) + '</div><div class="v">' + esc(t.val) + '</div></div>'; })
                .join('');
              box.appendChild(strip);
            }

            var grid = document.createElement('div'); grid.className = 'ar-summary';
            var first = true;

            var hasDateBullets = rows.some(function (r) { return r.label && AR_DATE_LABELS.test(r.label); });
            if ((hasDateBullets || (variants && variants.length > 1)) && variants && variants.length) {
              var ld = document.createElement('div'); ld.className = 'ar-slabel' + (first ? ' ar-first' : ''); ld.textContent = 'Dates / Options';
              var vd = document.createElement('div'); vd.className = 'ar-sval' + (first ? ' ar-first' : '');
              var dhost = document.createElement('div'); dhost.className = 'ar-sdates';
              variants.forEach(function (v) {
                var lbl = Object.values(v.attributes || {})[0]; if (!lbl) return;
                var c = document.createElement('span'); c.className = 'ar-dchip'; c.textContent = lbl; dhost.appendChild(c);
              });
              if (dhost.childNodes.length) { vd.appendChild(dhost); grid.appendChild(ld); grid.appendChild(vd); first = false; }
            }

            bodyRows.forEach(function (r) {
              var lab = r.label || 'Details';
              if (/^description/i.test(lab)) return;
              grid.insertAdjacentHTML('beforeend',
                '<div class="ar-slabel' + (first ? ' ar-first' : '') + '">' + esc(lab) + '</div>'
                + '<div class="ar-sval' + (first ? ' ar-first' : '') + '">' + r.valueHtml + '</div>');
              first = false;
            });

            var desc = rows.find(function (r) { return /^description/i.test(r.label); });
            if (desc && desc.valueHtml) {
              grid.insertAdjacentHTML('beforeend',
                '<div class="ar-srow-desc"><div class="ar-desc-lab">Overview</div><div class="ar-desc-body">' + desc.valueHtml + '</div></div>');
            }

            if (grid.childNodes.length) box.appendChild(grid);

            ul.parentNode.insertBefore(box, ul);
            ul.style.display = 'none';
            ex.setAttribute('data-ar-summary', '1');
            return true;
          } catch (e) { return false; }
        }

        /* ---------- v2.2: sticky bottom CTA bar (ported from workshops fix17) ----------
           Appears once the visitor has scrolled past the date cards; reads the
           product's own title + price dynamically. Cart-state-aware: flips to
           "Go to cart & checkout" once an item is in the basket. Only built when
           both date cards (.ar-cards) AND a visible Book button exist, so it never
           shows on non-bookable / 0-variant CS products (prints, vouchers, subs). */
        function buildStickyCta(item) {
          try {
            if (document.getElementById('ar-sticky')) return;
            var cards = document.querySelector('.ar-cards');
            var bookBtn = Array.prototype.slice.call(document.querySelectorAll('.sqs-add-to-cart-button')).find(vis);
            if (!cards || !bookBtn) return;

            var titleEl = document.querySelector('.ProductItem-details-title');
            var title = titleEl ? titleEl.textContent.trim() : 'This product';
            var priceEl = Array.prototype.slice.call(document.querySelectorAll('.product-price, .ProductItem-product-price, .sqs-money-native'))
              .find(function (e) { return vis(e) && /\d/.test(e.textContent); });
            var priceText = priceEl ? priceEl.textContent.trim().replace(/\s+/g, ' ') : '';

            var bar = document.createElement('div');
            bar.id = 'ar-sticky';
            bar.innerHTML = '<div class="ar-sk-in">'
              + '<div class="ar-sk-txt"><span class="ar-sk-title">' + esc(title) + '</span>'
              + '<span class="ar-sk-price">' + esc(priceText) + '</span>'
              + '</div>'
              + '<button type="button" class="ar-sk-btn">See dates &amp; book</button>'
              + '</div>';
            document.body.appendChild(bar);

            /* fix17: cart-state-aware sticky bar - flips to "go to cart & checkout" once an item is in the basket */
            function cartCount() {
              var el = document.querySelector('.sqs-cart-quantity');
              var n = el ? parseInt((el.textContent || '').replace(/\D/g, ''), 10) : 0;
              return isNaN(n) ? 0 : n;
            }
            function renderState() {
              var inCart = cartCount() > 0;
              var b = bar.querySelector('.ar-sk-btn');
              var priceSpan = bar.querySelector('.ar-sk-price');
              if (inCart) {
                if (priceSpan) priceSpan.textContent = '\u2713 Added to cart \u2014 find it via the basket, top right';
                b.textContent = 'Go to cart & checkout \u2192';
                bar.dataset.mode = 'cart';
              } else {
                if (priceSpan) priceSpan.textContent = priceText;
                b.textContent = 'See dates & book';
                bar.dataset.mode = 'dates';
              }
            }

            bar.querySelector('.ar-sk-btn').addEventListener('click', function () {
              if (bar.dataset.mode === 'cart') { window.location.href = '/cart'; return; }
              var target = document.querySelector('.ar-cards') || bookBtn.closest('.sqs-add-to-cart-button-wrapper') || bookBtn;
              if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });

            renderState();
            var _lastCount = cartCount();
            setInterval(function () { var c = cartCount(); if (c !== _lastCount) { _lastCount = c; renderState(); } }, 1500);
            bookBtn.addEventListener('click', function () { setTimeout(renderState, 1000); });

            function onScroll() {
              var r = cards.getBoundingClientRect();
              var pastCards = r.bottom < 80;
              var nearBottom = (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 140);
              if (pastCards && !nearBottom) bar.classList.add('ar-show');
              else bar.classList.remove('ar-show');
            }
            var ticking = false;
            window.addEventListener('scroll', function () {
              if (ticking) return; ticking = true;
              requestAnimationFrame(function () { onScroll(); ticking = false; });
            }, { passive: true });
            window.addEventListener('resize', onScroll, { passive: true });
            onScroll();
          } catch (e) {}
        }

        async function init() {
          if (document.getElementById('ar-pb-style')) return;
          var item = document.querySelector('.ProductItem');
          if (!item) return;

          var style = document.createElement('style');
          style.id = 'ar-pb-style'; style.textContent = CSS;
          document.head.appendChild(style);

          var product = null;
          try {
            var manifest = await fetch(CFG.SCHEMA_HOST + 'products-manifest.json').then(function (r) { return r.json(); });
            var entry = (manifest.entries || []).find(function (e) { return arNormPath(e.pathKey) === arNormPath(location.pathname); });
            if (entry && entry.schemaFileName) {
              var schema = await fetch(CFG.SCHEMA_HOST + entry.schemaFileName).then(function (r) { return r.json(); });
              var nodes = Array.isArray(schema['@graph']) ? schema['@graph'] : [schema];
              product = arFindProductNode(nodes);
              arInjectGithubSchema(schema);
              arRemoveLegacyDuplicateProducts();
            }
          } catch (e) {}

          var variants = [];
          try {
            var pj = await fetch(location.pathname + '?format=json', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
            variants = (pj.item && pj.item.variants) || [];
          } catch (e) {}
          /* ---------- v2.3: fallback to SQUARESPACE_CONTEXT when ?format=json is broken ----------
             Squarespace's ?format=json endpoint broke site-wide (~13 Sep 2026),
             returning a truncated voltronCache blob that fails to parse, so the
             fetch above throws and variants ends up []. The same variant data is
             present inline in window.Static.SQUARESPACE_CONTEXT.product.variants.
             Rebuild from there and NORMALISE the shape to match ?format=json so every
             downstream consumer (money(), stock badges, sold-out, cards, sticky bar)
             works unchanged:
               price -> {value:<pounds>} object; salePrice -> pence Number (money() guard)
               qtyInStock <- stock.quantity ; unlimited <- stock.unlimited
             Verified across CS types: dated courses, fixed-price services,
             subscriptions, prints (Size), RPS (Options). Zero-variant products
             (gift vouchers) have no variants, so this never fires and cards never
             build - unchanged. Purely additive: if ?format=json recovers,
             variants.length is truthy and this block never runs. Rollback: delete
             this block. Ref case #14652500. */
          if (!variants.length) {
            try {
              var ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
              var ctxP = ctx && ctx.product;
              var ctxV = (ctxP && ctxP.variants) || [];
              if (ctxV.length) {
                variants = ctxV.map(function (v) {
                  var st = v.stock || {};
                  return {
                    id: v.id,
                    sku: v.sku,
                    price: arPricePounds(v.price),
                    salePrice: arSalePence(v.salePrice),
                    onSale: !!v.onSale,
                    attributes: v.attributes || {},
                    qtyInStock: (st.unlimited ? null : (st.quantity != null ? st.quantity : null)),
                    unlimited: !!st.unlimited
                  };
                });
              }
            } catch (e) {}
          }

          var builtBox = false;
          try { builtBox = adaptiveSummary(variants); } catch (e) {}

          var h1 = Array.prototype.slice.call(document.querySelectorAll('h1')).find(function (h) { return vis(h) && h.closest('.ProductItem'); });
          if (h1 && product && product.aggregateRating && !document.querySelector('.ar-rating')) {
            var agg = product.aggregateRating;
            var r = document.createElement('div'); r.className = 'ar-rating';
            r.innerHTML = '<span class="ar-stars">\u2605\u2605\u2605\u2605\u2605</span> <b>' + esc(agg.ratingValue) + '</b> \u00b7 ' + plural(agg.reviewCount, 'review') + ' <span style="color:#bbb">\u00b7 Google &amp; Trustpilot</span>';
            h1.after(r); r.style.order = getComputedStyle(h1).order;
          }

          var btn = Array.prototype.slice.call(document.querySelectorAll('.sqs-add-to-cart-button')).find(vis);
          var sel = document.querySelector('.product-variants select');
          if (btn && variants.length) {
            var wrap = document.createElement('div'); wrap.className = 'ar-cards';
            function splitLabel(s) {
              s = String(s);
              var re = /\d{1,2}([:.][0-5]\d)?\s*(am|pm)/ig, m;
              while ((m = re.exec(s))) {
                var prev = m.index > 0 ? s.charAt(m.index - 1) : '';
                if (!/\d/.test(prev)) { return { date: s.slice(0, m.index).replace(/[\s\-\u2013]+$/, ''), time: s.slice(m.index).trim() }; }
              }
              return { date: s, time: '' };
            }
            function summaryDateParts() {
              try {
                var ex = document.querySelector('.ProductItem-details-excerpt') || document.querySelector('.ProductItem-additional');
                if (ex) {
                  var m = ex.innerText.match(/Dates?:\s*\n?\s*([^\n]+)/i);
                  if (m) {
                    var s = m[1].trim(); var p = splitLabel(s);
                    if (p.time) return p;
                    s = s.replace(/,?\s*\d{1,2}:\d{2}\s*(am|pm)?/gi, ' ').replace(/\s{2,}/g, ' ').trim();
                    var d = s.match(/^(.*?)[\s\-\u2013]+(\d+\s*Days?(?:\/\d+\s*Nights?)?.*)$/i);
                    if (d) return { date: d[1].replace(/[\s\-\u2013]+$/, ''), time: d[2].trim() };
                    return { date: s, time: '' };
                  }
                }
              } catch (e) {}
              return { date: 'Available option', time: '' };
            }
            variants.forEach(function (v, i) {
              var lbl = Object.values(v.attributes || {})[0]; var parts;
              if (lbl) { parts = splitLabel(lbl); }
              else if (variants.length === 1) { parts = summaryDateParts(); lbl = parts.date; }
              else { lbl = 'Option ' + (i + 1); parts = { date: lbl, time: '' }; }
              var qty = v.unlimited ? null : (v.qtyInStock != null ? v.qtyInStock : null);
              var card = document.createElement('div'); card.className = 'ar-card' + (qty === 0 ? ' out' : '');
              card.dataset.sku = v.sku || '';
              var stockHtml = '';
              if (qty != null && qty > 0) stockHtml = '<div class="a' + (qty <= 3 ? ' low' : '') + '">' + qty + ' places left</div>';
              card.innerHTML = '<div class="d">' + esc(parts.date) + '</div>'
                + (parts.time ? '<div class="t">' + esc(parts.time) + '</div>' : '') + stockHtml
                + '<div class="p">' + money(v) + '</div>';
              if (qty !== 0) {
                card.addEventListener('click', function () {
                  wrap.querySelectorAll('.ar-card').forEach(function (c) { c.classList.remove('sel'); });
                  card.classList.add('sel');
                  if (sel) {
                    for (var k = 0; k < sel.options.length; k++) {
                      if (sel.options[k].textContent.trim() === String(lbl).trim()) {
                        sel.value = sel.options[k].value; sel.dispatchEvent(new Event('change', { bubbles: true })); break;
                      }
                    }
                  }
                  showPickToast(btn);
                });
              }
              wrap.appendChild(card);
            });

            var dm = null;
            if (variants.length > CFG.EXPAND_THRESHOLD) {
              wrap.querySelectorAll('.ar-card').forEach(function (c, i) { if (i >= CFG.VISIBLE_CARDS) c.classList.add('ar-hide'); });
              dm = document.createElement('div'); dm.className = 'ar-dates-more';
              var pill = document.createElement('span'); pill.className = 'ar-pill';
              pill.textContent = 'Show all ' + variants.length + ' options \u25be';
              var open = false;
              pill.addEventListener('click', function () {
                open = !open;
                wrap.querySelectorAll('.ar-card').forEach(function (c, i) {
                  if (i >= CFG.VISIBLE_CARDS) { if (open) c.classList.remove('ar-hide'); else if (!c.classList.contains('sel')) c.classList.add('ar-hide'); }
                });
                pill.textContent = open ? 'Show fewer options \u25b4' : 'Show all ' + variants.length + ' options \u25be';
              });
              dm.appendChild(pill);
            }

            var cont = btn.closest('.ProductItem-details') || item;
            var varBox = Array.prototype.slice.call(cont.querySelectorAll('.product-variants')).find(vis);
            var price = Array.prototype.slice.call(cont.querySelectorAll('.product-price')).find(vis);
            var o = '4';
            if (varBox) { o = getComputedStyle(varBox).order; varBox.parentNode.insertBefore(wrap, varBox); if (dm) varBox.parentNode.insertBefore(dm, varBox); }
            else if (price) { o = String(Number(getComputedStyle(price).order) + 1); price.after(wrap); if (dm) wrap.after(dm); }
            else { var host = btn.closest('div'); host.parentNode.insertBefore(wrap, host); if (dm) host.parentNode.insertBefore(dm, host); }
            wrap.style.order = o; if (dm) dm.style.order = o;
          }

          /* fix16: pre-select a date from #ar-date=<SKU> when arriving from a landing-page tile */
          try {
            var arHash = (location.hash.match(/ar-date=([^&]+)/) || [])[1];
            if (arHash) {
              var wantSku = decodeURIComponent(arHash);
              var pick = document.querySelector('.ar-card[data-sku="' + (window.CSS && CSS.escape ? CSS.escape(wantSku) : wantSku) + '"]');
              if (pick) { pick.classList.remove('ar-hide'); pick.click(); pick.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            }
          } catch (e) {}

          if (btn && !btn.dataset.arToast) { btn.dataset.arToast = '1'; btn.addEventListener('click', function () { setTimeout(showToast, 900); }); }
          if (btn && !btn.hasAttribute('data-ar-tip')) {
            btn.setAttribute('data-ar-tip', 'Book your place \u2014 this adds your selection to the cart for checkout. Find your cart via the basket symbol: top right of the menu on desktop, bottom of the screen on mobile.');
          }
          var regBtn = Array.prototype.slice.call(document.querySelectorAll('a, button')).find(function (el) { return vis(el) && /register\s*interest/i.test(el.textContent || ''); });
          if (regBtn && !regBtn.hasAttribute('data-ar-tip')) {
            regBtn.setAttribute('data-ar-tip', 'Sends an email to Alan to confirm your interest \u2014 please include any questions you need answered to proceed with a booking. Register Interest does not create a booking or reserve your place.');
          }

          /* FIX 3: move + restyle Register Interest next to Book Now (workshops loader). */
          try {
            var bookWrap = document.querySelector('.sqs-add-to-cart-button-wrapper');
            var regWrap = document.querySelector('.register-interest-button');
            if (bookWrap && regWrap && bookWrap.parentNode === regWrap.parentNode
                && !document.querySelector('.ar-btn-row')) {
              var row = document.createElement('div');
              row.className = 'ar-btn-row';
              row.style.order = getComputedStyle(bookWrap).order;
              bookWrap.parentNode.insertBefore(row, bookWrap);
              row.appendChild(bookWrap);
              row.appendChild(regWrap);
              regWrap.classList.add('ar-reg-compact');
            }
          } catch (e) {}

          /* FIX 2: suppress reviews on the 7 listed products, OR whenever the page
             was left untouched by the skip-guard (accordion excerpt). */
          var noReviews = AR_NO_REVIEWS.indexOf(slugNow()) !== -1 || !builtBox;
          if (!noReviews && product && product.review && !document.getElementById('ar-reviews')) {
            var revs = Array.isArray(product.review) ? product.review : [product.review];
            if (revs.length) {
              var sec = document.createElement('div'); sec.id = 'ar-reviews';
              var ratingVal = product.aggregateRating ? product.aggregateRating.ratingValue : '5.0';
              var totalReviews = product.aggregateRating && product.aggregateRating.reviewCount != null
                ? Number(product.aggregateRating.reviewCount) : revs.length;
              if (!(totalReviews > 0)) totalReviews = revs.length;
              var showingN = revs.length;
              function rcard(rv) {
                var body = String(rv.reviewBody || '');
                var srcName = (rv.publisher && rv.publisher.name) || 'Review';
                return '<div class="ar-rev" tabindex="0"><div class="st">\u2605\u2605\u2605\u2605\u2605</div><div class="w">' + esc(rv.author && rv.author.name) + ' <span class="s">' + esc(srcName) + '</span></div><p>\u201c' + esc(body) + '\u201d</p><span class="ar-rev-more" aria-hidden="true">Read more \u25be</span></div>';
              }
              sec.innerHTML = '<h2>What attendees say</h2>'
                + '<div class="ar-sub"><span class="ar-stars">\u2605\u2605\u2605\u2605\u2605</span> <b>' + esc(ratingVal) + '</b> from ' + plural(totalReviews, 'review') + ' \u00b7 showing the ' + showingN + ' most recent</div>'
                + '<div class="ar-revgrid">' + revs.slice(0, CFG.REVIEWS_VISIBLE).map(rcard).join('') + '</div>'
                + (revs.length > CFG.REVIEWS_VISIBLE ? '<button id="ar-more" type="button">Show all ' + showingN + ' recent reviews + ' \u25be</button>' : '');
              var accBlocks = document.querySelectorAll('.sqs-block-accordion');
              var anchor = (accBlocks.length ? accBlocks[accBlocks.length - 1] : null) || document.querySelector('.ProductItem-additional') || item;
              anchor.after(sec);

              function wireReviewCards(gridEl) {
                Array.prototype.forEach.call(gridEl.querySelectorAll('.ar-rev'), function (cardEl) {
                  var p = cardEl.querySelector('p'); if (!p) return;
                  cardEl.classList.add('ar-clamp');
                  if (p.scrollHeight <= p.clientHeight + 2) { cardEl.classList.remove('ar-clamp'); return; }
                  if (cardEl.dataset.arWired) return; cardEl.dataset.arWired = '1';
                  cardEl.addEventListener('click', function () { cardEl.classList.toggle('ar-open'); });
                  cardEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardEl.classList.toggle('ar-open'); } });
                });
              }
              var grid0 = sec.querySelector('.ar-revgrid'); if (grid0) wireReviewCards(grid0);
              var more = sec.querySelector('#ar-more');
              if (more) {
                var grid = sec.querySelector('.ar-revgrid'); var expanded = false;
                more.addEventListener('click', function () {
                  expanded = !expanded;
                  grid.innerHTML = (expanded ? revs : revs.slice(0, CFG.REVIEWS_VISIBLE)).map(rcard).join('');
                  more.textContent = expanded ? 'Show fewer \u25b4' : 'Show all ' + showingN + ' recent reviews + ' \u25be';
                  wireReviewCards(grid);
                });
              }
            }
          }

          /* v2.2: build the cart-state-aware sticky bottom CTA bar (bookable pages only). */
          buildStickyCta(item);
        }

        function boot() {
          if (inEditor()) { try { document.body.classList.add('ar-fp-edit-mode'); } catch (e) {} return; }
          var tries = 0;
          var t = setInterval(function () {
            tries++;
            if (document.querySelector('.ProductItem') || tries > 20) { clearInterval(t); init().catch(function () {}); }
          }, 300);
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    })();
  }
})();
