/**
 * event-page-loader.js — https://schema.alanranger.com/loaders/event-page-loader.js
 * Option D (2026-10-27): ARP Event Loader v1.1. No WebPage stub.
 * Paste the one-line script tag into the workshops (and lessons) collection header.
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

  var path = (location.pathname || '/').replace(/\/+$/, '').toLowerCase() || '/';
  var isHub = path === '/photographic-workshops-near-me' || path === '/beginners-photography-lessons';
  var isEvent = isHub ||
    path.indexOf('/photographic-workshops-near-me/') === 0 ||
    path.indexOf('/beginners-photography-lessons/') === 0;
  if (!isEvent) return;

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
  function installSuppressor() {
    if (window.__AR_CORE_SUPPRESSOR_V21__) return;
    window.__AR_CORE_SUPPRESSOR_V21__ = true;
    var CORE = { Event: 1, Product: 1, Organization: 1, LocalBusiness: 1, WebSite: 1, WebPage: 1, BreadcrumbList: 1, Place: 1, Service: 1 };
    var SUFFIX = ['#org', '#website', '#webpage', '#breadcrumbs', '#event', '#product', '#faq', '#person', '#service'];
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
          }).map(function (n) {
            if (!isFaq(n)) return n;
            var me = n.mainEntity;
            var qs = Array.isArray(me) ? me : (me ? [me] : []);
            var vis = qs.filter(function (q) { return qVisible(q, text); });
            if (!vis.length) return null;
            n.mainEntity = vis;
            return n;
          }).filter(Boolean);
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

  installSuppressor();
  if (isHub) return;

  fetch('https://schema.alanranger.com/events-manifest.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (manifest) {
      var entries = (manifest && manifest.entries) || [];
      var entry = entries.filter(function (e) { return String(e.pathKey || '').toLowerCase() === path; })[0];
      if (!entry && path.split('/').pop()) {
        var slug = path.split('/').pop();
        entry = entries.filter(function (e) { return String(e.slug || '').toLowerCase() === slug; })[0];
      }
      if (!entry || !entry.schemaFileName) return;
      var base = 'https://schema.alanranger.com/';
      return fetch(base + entry.schemaFileName, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (schema) {
          if (schema) inject('ar-github-event-schema', schema);
          if (!entry.faqFileName) return;
          return fetch(base + entry.faqFileName, { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (faq) {
              if (faq && String(faq['@type'] || '').toLowerCase() === 'faqpage') inject('ar-github-event-faq', faq);
            });
        });
    })
    .catch(function () {});
})();
