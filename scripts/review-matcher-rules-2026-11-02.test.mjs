/**
 * Matcher / checker rules from Alan's 84-flag decisions (2 Nov 2026), on today's real cases (first names only).
 *   node --test scripts/review-matcher-rules-2026-11-02.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingLabelSlugs, match, outOfSeason, SERVICES } from './lib/review-matcher-rules.mjs';
import { scoreReview, withSeason } from './shadow-review-matcher.mjs';

const HEATHER = 'peak-district-heather-photography-workshop';

test('1. booking-sheet attendees on the event dates decide it: "Heathers Peaks" is the heather workshop (Iggy, Joanne)', () => {
  assert.deepEqual(bookingLabelSlugs('Heathers Peaks'), [HEATHER], 'not heather + Peak District');
  assert.deepEqual(bookingLabelSlugs('Peak District - Padley Gorge'), ['landscape-peak-district-photography-workshops-derbyshire']);
  const bookings = [{ client: 'Iggy Losa', date: '2025-08-16', label: 'Heathers Peaks', kind: 'workshop' },
    { client: 'Joanne Tapp', date: '2025-08-17', label: 'Heathers Peaks sunrise', kind: 'workshop' }];
  assert.equal(scoreReview({ reviewer: 'Iggy Losa', date: '2025-08-19', review: 'Brilliant sunset and sunrise, thank you Alan' }, bookings).slug, HEATHER);
  assert.equal(scoreReview({ reviewer: 'Joanne Tapp', date: '2025-08-29', review: 'Lovely morning, great tips' }, bookings).slug, HEATHER);
});

test('2. season check: out of season only when Squarespace has no order for the product that year', () => {
  const batsford2018 = [{ createdOn: '2018-03-02T10:00:00Z', items: [{ slug: 'batsford-arboretum-photography-workshops', variant: 'Batsford Calendar Photography Workshops' }] }];
  assert.equal(outOfSeason({ slug: 'batsford-arboretum-photography-workshops', date: '2018-04-10', orders: batsford2018 }), false, '2018 Batsford ran year-round (orders)');
  assert.equal(outOfSeason({ slug: 'batsford-arboretum-photography-workshops', date: '2018-04-10', orders: [] }), true, 'no order that year: flagged');
  assert.equal(outOfSeason({ slug: 'photography-workshops-lavender-fields', date: '2015-01-16', orders: [] }), true, 'Jan 2015 on lavender (T Balcombe)');
  assert.equal(outOfSeason({ slug: HEATHER, date: '2016-07-25', orders: [] }), true, 'July is before the August heather (Fay)');
  assert.equal(outOfSeason({ slug: HEATHER, date: '2025-08-19', orders: [] }), false, 'in season');
  assert.equal(outOfSeason({ slug: 'beginners-photography-course', date: '2015-01-16', orders: [] }), false, 'not seasonal');
  assert.equal(outOfSeason({ slug: 'christmas-photography-workshops', date: '2016-01-10', orders: [] }), false, 'Christmas Nov–Jan wraps the year');
  assert.equal(outOfSeason({ slug: 'christmas-photography-workshops', date: '2016-04-28', orders: [] }), true, 'Emma Clift, April');
  assert.equal(outOfSeason({ slug: 'photography-workshops-lavender-fields', date: '2015-08-20', orders: [] }), false, 'lavender Jul–Aug');
  assert.equal(outOfSeason({ slug: HEATHER, date: '2015-09-05', orders: [] }), true, 'Robin: September, no 2015 Heather order');
  const held = withSeason({ slug: 'photography-workshops-lavender-fields', score: 0.8, why: 'place/workshop alias' }, { date: '2015-01-16' }, []);
  assert.equal(held.score < 0.6, true);
  assert.match(held.why, /outside its season/);
});

test('3. "Get off Auto", "beginners course", "evening class introducing the basics", "3 hours of beginners photography" → beginners course', () => {
  for (const text of ['Great course to get off auto', 'Getting off Auto at last', 'A really good beginners course',
    'An evening class introducing the basics', '3 hours of beginners photography with Alan']) {
    assert.deepEqual(match(SERVICES, text.toLowerCase()), ['beginners-photography-course'], text);
  }
});
