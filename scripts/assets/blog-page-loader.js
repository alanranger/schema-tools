/**
 * blog-page-loader.js — https://schema.alanranger.com/loaders/blog-page-loader.js
 * Option D (2026-10-27): one collection-header loader for /blog-on-photography.
 * Replaces footer ARP Blog Schema Loader v5.1 and the WebPage stub.
 * Source of truth: alanranger-schema. Paste the one-line script tag, do not edit on Squarespace.
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

  var path = (location.pathname || '/').replace(/\/+$/, '') || '/';
  if (path !== '/blog-on-photography' && path.indexOf('/blog-on-photography/') !== 0) return;

  function getTypes(node) {
    if (!node) return [];
    return Array.isArray(node['@type']) ? node['@type'] : [node['@type']].filter(Boolean);
  }
  function visText() {
    if (!document.body) return '';
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll('script,style,noscript').forEach(function (el) { el.remove(); });
    return String(clone.textContent || '').replace(/['’]/g, "'").toLowerCase();
  }
  function qVisible(q, text) {
    var name = String((q && q.name) || '').replace(/['’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
    return name.length > 8 && text.indexOf(name) !== -1;
  }
  function isFaq(n) { return getTypes(n).indexOf('FAQPage') !== -1; }
  function keepFaq(n, text, drop) {
    if (!isFaq(n)) return n;
    if (drop) return null;
    var me = n.mainEntity;
    var qs = Array.isArray(me) ? me : (me ? [me] : []);
    var vis = qs.filter(function (q) { return qVisible(q, text); });
    if (!vis.length) return null;
    n.mainEntity = vis;
    return n;
  }
  function installSuppressor() {
    if (window.__AR_CORE_SUPPRESSOR_V21__) return;
    window.__AR_CORE_SUPPRESSOR_V21__ = true;
    var CORE = { Article: 1, Organization: 1, LocalBusiness: 1, WebSite: 1, WebPage: 1, BreadcrumbList: 1, SearchAction: 1, Place: 1, Service: 1 };
    var SUFFIX = ['#org', '#website', '#webpage', '#breadcrumbs', '#breadcrumb', '#service', '#person', '#primaryimage', '#blogposting', '#faq'];
    function canonical(node) {
      var id = String((node && node['@id']) || '');
      return SUFFIX.some(function (s) { return id.indexOf(s) !== -1; });
    }
    function run() {
      var text = visText();
      document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(function (el) {
        var txt = (el.textContent || '').trim();
        if (!txt) { el.remove(); return; }
        try {
          var json = JSON.parse(txt);
          var nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
          var kept = nodes.filter(function (n) {
            var types = getTypes(n);
            if (types.some(function (t) { return CORE[t]; }) && !canonical(n)) return false;
            return true;
          }).map(function (n) { return keepFaq(n, text, false); }).filter(Boolean);
          var faqs = kept.filter(isFaq);
          var canonFaq = faqs.filter(function (n) { return String(n['@id'] || '').indexOf('#faq') !== -1; })[0];
          if (canonFaq) kept = kept.filter(function (n) { return !isFaq(n) || n === canonFaq; });
          else if (faqs.length > 1) kept = kept.filter(function (n) { return !isFaq(n) || n === faqs[0]; });
          if (!kept.length) { el.remove(); return; }
          if (Array.isArray(json['@graph'])) {
            json['@graph'] = kept;
            el.textContent = JSON.stringify(json);
          } else {
            el.textContent = JSON.stringify(kept[0]);
          }
        } catch (e) {}
      });
    }
    run();
    document.addEventListener('DOMContentLoaded', run);
    window.addEventListener('load', function () { setTimeout(run, 800); });
  }

  function inject(id, data) {
    if (!data || typeof data !== 'object') return;
    var el = document.getElementById(id);
    if (el) el.remove();
    var s = document.createElement('script');
    s.type = 'application/ld+json';
    s.id = id;
    s.textContent = JSON.stringify(data);
    document.head.appendChild(s);
  }

  function dropOtherJsonLd(typeName, keepId) {
    document.querySelectorAll('script[type="application/ld+json"], script[data-type="application/ld+json"]').forEach(function (el) {
      if (el.id === keepId) return;
      var txt = (el.textContent || '').trim();
      if (!txt) return;
      try {
        var json = JSON.parse(txt);
        var nodes = Array.isArray(json['@graph']) ? json['@graph'] : [json];
        var kept = nodes.filter(function (n) { return getTypes(n).indexOf(typeName) === -1; });
        if (!kept.length) { el.remove(); return; }
        if (Array.isArray(json['@graph'])) {
          json['@graph'] = kept;
          el.textContent = JSON.stringify(json);
        } else {
          el.textContent = JSON.stringify(kept[0]);
        }
      } catch (e) {}
    });
  }

  function filterFaq(data) {
    if (!data) return { json: null, before: 0, after: 0, reason: 'no-faq-file' };
    var nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
    var faq = nodes.filter(isFaq)[0];
    if (!faq) return { json: null, before: 0, after: 0, reason: 'not-faqpage' };
    var me = faq.mainEntity;
    var qs = Array.isArray(me) ? me : (me ? [me] : []);
    var before = qs.length;
    var text = visText();
    var vis = qs.filter(function (q) { return qVisible(q, text); });
    window.__AR_FAQ_DROP = {
      url: location.href.split('#')[0],
      before: before,
      after: vis.length,
      reason: vis.length ? (vis.length < before ? 'hidden-questions-removed' : 'all-visible') : 'no-visible-questions'
    };
    if (!vis.length) return { json: null, before: before, after: 0, reason: window.__AR_FAQ_DROP.reason };
    faq.mainEntity = vis;
    return { json: data, before: before, after: vis.length, reason: window.__AR_FAQ_DROP.reason };
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }

  installSuppressor();
  var base = 'https://schema.alanranger.com/';

  if (path === '/blog-on-photography') {
    fetchJson(base + 'blog-schema.json').then(function (j) { if (j) inject('arp-blog-index-schema', j); });
    return;
  }

  var slug = path.split('/').pop();
  if (!slug) return;
  var kinds = [
    { kind: 'schema', file: slug + '_schema.json' },
    { kind: 'blogposting', file: slug + '_blogposting.json' },
    { kind: 'howto', file: slug + '_howto.json' },
    { kind: 'image', file: slug + '_image.json' },
    { kind: 'breadcrumb', file: slug + '_breadcrumb.json' }
  ];
  kinds.forEach(function (k) {
    fetchJson(base + k.file).then(function (j) {
      if (!j) return;
      var id = 'arp-schema-' + slug + '-' + k.kind;
      inject(id, j);
      if (k.kind === 'howto') dropOtherJsonLd('HowTo', id);
    });
  });
  fetchJson(base + slug + '_faq.json').then(function (j) {
    var f = filterFaq(j);
    if (!f.json) return;
    var id = 'arp-schema-' + slug + '-faq';
    inject(id, f.json);
    dropOtherJsonLd('FAQPage', id);
  });
  window.addEventListener('load', function () {
    setTimeout(function () {
      var faqId = 'arp-schema-' + slug + '-faq';
      var howId = 'arp-schema-' + slug + '-howto';
      if (document.getElementById(faqId)) dropOtherJsonLd('FAQPage', faqId);
      if (document.getElementById(howId)) dropOtherJsonLd('HowTo', howId);
    }, 900);
  });
})();
