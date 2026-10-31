/**
 * Rules for the shadow Google review matcher: place/workshop aliases, service words, name matching.
 * Curated from the 31 Oct text-vs-product check (725 reviews). "beginner" alone never counts.
 */

/** Place / workshop aliases → product slug. Order matters only for readability. */
export const PLACES = [
  ['landscape-photography-devon-hartland-quay', /hartland/],
  ['landscape-photography-workshops-anglesey', /anglesey|aglesey/],
  ['peak-district-heather-photography-workshop', /heathers|purple heather|heather (workshop|photography|moor|bloom|season|sunrise|sunset)/],
  ['landscape-peak-district-photography-workshops-derbyshire', /padley|peak district|\bthe peaks\b|\bpeaks\b|boleshill|derbyshire|curbar|stanage|burbage|mam tor/],
  ['landscape-photography-wales-photo-workshop', /\bgower\b|rhossili|three cliffs/],
  ['coastal-northumberland-photography-workshops', /northumb|bamburgh|dunstanburgh|holy island|lindisfarne/],
  ['landscape-photography-snowdonia-workshops', /snowdon|eryri|tryfan|ogwen/],
  ['wales-photography-workshop-pistyll-rhaeadr', /vyrnw|pistyll/],
  ['poppy-fields-photography-workshops', /popp(y|ies)|sunflower/],
  ['bluebell-woodlands-photography-workshops', /bluebel|blubebell/],
  ['batsford-arboretum-photography-workshops', /batsford|arboretum/],
  ['photography-workshops-lavender-fields', /lavender/],
  ['photography-workshops-chesterton-windmill', /chesterton|windmill/],
  ['fireworks-photography-workshop-kenilworth', /firework/],
  ['woodland-photography-walk-warwickshire', /woodland walk|photography walk|crackley|hay wood/],
  ['secrets-of-woodland-photography-workshop', /secrets? of (the )?woodland|woodland masterclass|secret woodland|woodland photography (day|workshop|course)/],
  ['long-exposure-photography-kenilworth', /long exposure|\ble kenilworth/],
  ['lake-district-photography-workshop', /lake district|cumbria|buttermere|derwent|ullswater|keswick|ambleside|wast ?water|borrowdale/],
  ['yorkshire-dales-photography-workshops', /yorkshire dales|\bdales\b|malham|ribblehead|aysgarth/],
  ['north-yorkshire-landscape-photography', /north yorkshire|whitby|staithes|robin hood|saltwick/],
  ['landscape-photography-workshop-norfolk', /norfolk|cromer|happisburgh/],
  ['suffolk-landscape-photography-workshops', /suffolk|southwold|dunwich|aldeburgh|walberswick/],
  ['dorset-landscape-photography-workshop', /dorset|purbeck|durdle|kimmeridge|corfe/],
  ['dartmoor-photography-landscape-workshop', /dartmoor/],
  ['exmoor-photography-workshops-lynmouth', /exmoor|lynmouth/],
  ['landscape-photography-workshops-glencoe', /glencoe|glen coe|scotland|highlands/],
  ['ireland-photography-workshops-dingle', /dingle|ireland|kerry/],
  ['long-exposure-photography-workshop-fairy-glen', /fairy glen|fairy falls/],
  ['long-exposure-photography-workshops-burnham', /burnham/],
  ['landscape-photography-workshops-nant-mill', /nant mill|dee valley/],
  ['sezincote-garden-photography-workshop', /sezincote|mughal/],
  ['garden-photography-workshop', /garden (photography|workshop)|private garden|art of garden/],
  ['christmas-photography-workshops', /christmas (workshop|photography|lights|market)/],
  ['abstract-and-macro-photography-workshops', /macro|abstract/],
  ['urban-architecture-photography-workshops-coventry', /urban|architect/]
];

/** Service words → product slug. A bare "beginner(s)" is deliberately absent. */
export const SERVICES = [
  ['lightroom-courses-for-beginners-coventry', /lightroom|editing course/],
  ['camera-sensor-clean', /sensor (clean|and mirror)|sensor clean|cleaned (my|the) sensor/],
  ['rps-mentoring-photography-course', /\brps\b|distinction|\blrps\b|\barps\b/],
  ['photography-masterclasses-coventry', /masterclass|bracketing|filters? (workshop|evening|session|masterclass)/],
  ['private-online-photography-classes-zoom', /(over|via|on) zoom|zoom (session|lesson|call|class|multi)|hr zoom|\bzooms\b/],
  ['four-private-photography-classes', /1-2-1|1:1|one[- ]to[- ]one|\b1-1\b|private (lesson|session|class|tuition)|face to face/],
  ['beginners-photography-course', /beginners? (camera |photography )?course|camera course|evening class|(3|three|5|five)[- ]week|get off auto/],
  ['intermediates-intentions-photography-project-course', /intentions/],
  ['beginners-portrait-photography-course', /portrait (course|class|workshop)/],
  ['free-online-photography-course', /academy|free online/],
  ['photography-mentoring-online-assignments', /mentoring/]
];

export const match = (rules, text) => [...new Set(rules.filter(([, re]) => re.test(text)).map(([slug]) => slug))];

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Full name; first + surname; initial + surname; a one-word name needs an exact first name of 4+ letters. */
export function nameMatches(reviewer, client) {
  const r = norm(reviewer).split(' ').filter(Boolean);
  const c = norm(client).split(' ').filter(Boolean);
  if (!r.length || !c.length) return false;
  if (r.length === 1) return r[0].length > 3 && c[0] === r[0];
  const last = r[r.length - 1];
  return c.includes(last) && (c[0] === r[0] || c[0][0] === r[0][0]);
}
