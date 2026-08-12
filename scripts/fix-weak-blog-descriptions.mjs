#!/usr/bin/env node
/**
 * Repair weak/junk blog descriptions (and Lee Filters binary body) in alanranger-schema.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'alanranger-schema');

function isJunk(text) {
  if (!text) return true;
  const s = String(text);
  let ctrl = 0;
  for (let i = 0; i < Math.min(s.length, 3000); i++) {
    const c = s.charCodeAt(i);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) ctrl++;
    if (ctrl > 10) return true;
  }
  return /wf-loading|document\.documentElement|@keyframes/i.test(s);
}

function isWeak(desc, title) {
  const d = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!d || d.length < 40) return true;
  if (isJunk(d)) return true;
  const low = d.toLowerCase();
  if (low.startsWith('webpage for a blog')) return true;
  if (/1-page field checklist/i.test(d) && /alan ranger/i.test(d)) return true;
  if (/checklists?\s*alan\s*ranger/i.test(d)) return true;
  if (/^table of contents show\.?$/i.test(d)) return true;
  if (/^guest post by\b/i.test(d) && d.length < 60) return true;
  if (/^this guide removes the guesswork\.?$/i.test(d)) return true;
  return false;
}

function fromTitle(title) {
  let t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t) return 'Photography guide from Alan Ranger Photography.';
  t = t.replace(/^\d+\s+/, '');
  if (/checklist|1-?page|field checklist/i.test(t)) {
    const topic = t
      .replace(/\s*[-–—:|]?\s*1-?page.*$/i, '')
      .replace(/\s*field checklist.*$/i, '')
      .replace(/\s*checklist.*$/i, '')
      .replace(/\s*photography guide.*$/i, '')
      .trim() || t;
    return `A one-page field checklist covering ${topic} for photographers.`;
  }
  if (!/[.!?]$/.test(t)) t += '.';
  return t.length > 160 ? `${t.slice(0, 157).trim()}...` : t;
}

function firstGoodSentence(body, title) {
  if (!body || isJunk(body) || body.length < 80) return '';
  const cleaned = String(body)
    .replace(/Table of Contents Show/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = cleaned.split(/(?<=[.!?])\s+/);
  for (const p of parts) {
    const s = p.trim();
    if (s.length < 50 || s.length > 180) continue;
    if (/^(back|cart|sign|search|menu|home|blog|alan ranger\s+\d)/i.test(s)) continue;
    if (title && s.toLowerCase() === String(title).toLowerCase()) continue;
    if (isWeak(s, title)) continue;
    return /[.!?]$/.test(s) ? s : `${s}.`;
  }
  return '';
}

const MANUAL = {
  'lee-filter-15-percent-off':
    'Lee Filters 15 percent off for Alan Ranger Photography clients. A client deal on quality landscape filters.',
  'how-to-take-long-exposure-photos':
    'A beginner guide to long exposure photography covering ND filters, tripod setup, camera settings, and creative motion effects.',
  'are-camera-uv-filters-worth-it':
    'Are camera UV filters worth it? A practical look at the pros, cons, and when a UV filter still makes sense.',
  'know-your-camera-filters':
    'A professional guide to camera filters, covering ND, polarising, and graduated filters and when to use each.',
  'learn-photography-how':
    'Learn photography with deliberate practice: why 10,000 hours matters less than focused, guided improvement.',
  'lightroom-classic-latest-version-whats-new':
    'What is new in Lightroom Classic 13.3, including key editing, organisational, and workflow updates.',
  'become-a-photographer-on-campus':
    'How to establish yourself as a photographer on campus, from building a portfolio to finding paid work.',
  'partner-to-jaguar-land-rover-training':
    'Jaguar Land Rover photography training with Alan Ranger Photography: invest in your team and visual skills.',
  'photography-tips-10-things-to-know':
    'Ten photography tips I wish I knew earlier, covering exposure, composition, and practical shooting habits.',
  'product-photography-warwickshire':
    'Product photography in Warwickshire: a complete 2026 guide to lighting, setup, and commercial image quality.',
  'recommended-travel-lightweight-tripods':
    'Recommended lightweight travel tripods for photographers who need stability without the bulk.',
  'the-studies-to-become-a-professional-photographer':
    'The studies and skills needed to become a professional photographer, from technique to business basics.',
  'what-is-framing-in-photography':
    'What framing in photography really means: a craft approach to composing stronger, clearer images.',
  'street-photography-guide':
    'A one-page field checklist covering street photography for photographers.'
};

let fixed = 0;
const files = fs.readdirSync(root).filter((n) => n.endsWith('_blogposting.json'));
for (const name of files) {
  const slug = name.slice(0, -'_blogposting.json'.length);
  const bpPath = path.join(root, name);
  const bp = JSON.parse(fs.readFileSync(bpPath, 'utf8'));
  const title = bp.headline || bp.name || slug;
  let changed = false;

  if (isJunk(bp.articleBody) || (slug === 'lee-filter-15-percent-off' && String(bp.articleBody || '').length > 50000)) {
    bp.articleBody = MANUAL[slug] || fromTitle(title);
    bp.wordCount = String(bp.articleBody).split(/\s+/).filter(Boolean).length;
    changed = true;
  }

  if (isWeak(bp.description, title) || MANUAL[slug]) {
    const next =
      MANUAL[slug] ||
      firstGoodSentence(bp.articleBody, title) ||
      fromTitle(title);
    if (next !== bp.description) {
      bp.description = next;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(bpPath, `${JSON.stringify(bp, null, 2)}\n`, 'utf8');
    fixed += 1;
  }

  // Mirror description onto WebPage schema when present
  const schemaPath = path.join(root, `${slug}_schema.json`);
  if (fs.existsSync(schemaPath)) {
    const sc = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    if (isWeak(sc.description, title) || MANUAL[slug] || changed) {
      sc.description = bp.description || fromTitle(title);
      fs.writeFileSync(schemaPath, `${JSON.stringify(sc, null, 2)}\n`, 'utf8');
    }
  }

  // HowTo description if weak
  const howtoPath = path.join(root, `${slug}_howto.json`);
  if (fs.existsSync(howtoPath)) {
    const ht = JSON.parse(fs.readFileSync(howtoPath, 'utf8'));
    if (isWeak(ht.description, title) || isJunk(ht.description)) {
      ht.description = bp.description || fromTitle(title);
      fs.writeFileSync(howtoPath, `${JSON.stringify(ht, null, 2)}\n`, 'utf8');
    }
  }
}

console.log(JSON.stringify({ scanned: files.length, blogpostingsFixed: fixed }, null, 2));
