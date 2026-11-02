import test from 'node:test';
import assert from 'node:assert/strict';
import { emailMatches, isMine, minimalOrder, orderEvidence, orderNumberIn, variantDate } from './lib/squarespace-orders.mjs';
import { scoreReviewWithOrders, bucket } from './shadow-review-matcher.mjs';

const order = (n, created, slug, variant, extra = {}) => ({ orderNumber: n, createdOn: created, names: ['Jane Example'], emailLocal: 'jane.exa', notes: [],
  items: [{ productId: 'p', productName: slug, slug, variant }], ...extra });
const homes = new Set(['yorkshire-dales-photography-workshops', 'lake-district-photography-workshop', 'four-private-photography-classes', 'photography-mentoring-online-assignments']);

test('email local part matches a run-together Google name; short parts never match', () => {
  assert.equal(emailMatches('Janeexample', 'jane.exa'), true);
  assert.equal(emailMatches('Jane Example', 'jane.exa'), true);
  assert.equal(emailMatches('Jo', 'jo'), false);
  assert.equal(emailMatches('Bob Smith', 'jane.exa'), false);
});

test('Alan 2 Nov: an order counts only on surname, email local part or order number — never the first name alone', () => {
  const o = { orderNumber: '2042', names: ['Mike Example'], emailLocal: 'mikeexa' };
  assert.equal(isMine({ reviewer: 'Mike', review: 'Great day' }, { ...o, emailLocal: 'zzzzzz' }), false, 'first name only (the Mike 2023-11 case)');
  assert.equal(isMine({ reviewer: 'Mike Example', review: 'Great day' }, o), true, 'surname matches');
  assert.equal(isMine({ reviewer: 'M Example', review: 'Great day' }, o), true, 'initial + surname');
  assert.equal(isMine({ reviewer: 'Mike Other', review: 'Great day' }, o), false, 'different surname');
  assert.equal(isMine({ reviewer: 'Mikeexample', review: 'Great day' }, { ...o, names: ['Someone Else'] }), true, 'email local part');
  assert.equal(isMine({ reviewer: 'Mike', review: 'Loved it, order #2042 was easy' }, { ...o, names: ['Someone Else'], emailLocal: 'zzzzzz' }), true, 'order number in the text');
  assert.equal(orderNumberIn('ref 120421', '2042'), false, 'part of a longer number does not count');
});

test('minimal order keeps only the email local part (no address, phone or full email)', () => {
  const m = minimalOrder({ orderNumber: '1', createdOn: '2026-01-01', customerEmail: 'jane.exa@example.com', billingAddress: { firstName: 'Jane', lastName: 'Example', address1: '1 Road', phone: '07' },
    formSubmission: [{ label: 'First Name', value: 'Jane' }, { label: 'Surname', value: 'Example' }, { label: 'Mobile Number', value: '07' }], lineItems: [] });
  assert.equal(m.emailLocal, 'jane.exa');
  assert.ok(!JSON.stringify(m).includes('example.com') && !JSON.stringify(m).includes('1 Road') && !JSON.stringify(m).includes('"07"'));
});

test('event date: from variant text, year inferred from the order date when missing', () => {
  assert.equal(new Date(variantDate('Sat 23 Oct 2027 - 9:30', '2026-01-01')).toISOString().slice(0, 10), '2027-10-23');
  assert.equal(new Date(variantDate('Wed 1st Mar Coventry', '2023-01-18')).toISOString().slice(0, 10), '2023-03-01');
  assert.equal(new Date(variantDate('Mon 29th Jan', '2023-11-20')).toISOString().slice(0, 10), '2024-01-29');
  assert.equal(variantDate('4 x 2hr sessions', '2023-01-01'), null);
});

test('order evidence: an event after the review, or long before it, is set aside', () => {
  const review = { reviewer: 'Jane Example', date: '2026-05-02', review: 'Great trip' };
  assert.deepEqual(orderEvidence(review, [order(1, '2026-01-10', 'yorkshire-dales-photography-workshops', 'Thu 16 Apr 2026')], homes).slugs, ['yorkshire-dales-photography-workshops']);
  assert.deepEqual(orderEvidence(review, [order(2, '2026-01-10', 'lake-district-photography-workshop', 'Fri 22 Jan 2027')], homes).eventAfterReview, ['#2 lake-district-photography-workshop']);
  assert.equal(orderEvidence(review, [order(3, '2025-06-01', 'lake-district-photography-workshop', 'Sat 14 Jun 2025')], homes), null, '10 months before: not this review');
});

const bookings = (label, date) => [{ client: 'Jane Example', date, label, kind: 'workshop' }];

test('transfer trap: the text names X, the order is Y — only a booking-sheet / order-notes transfer lets X through; otherwise hold', () => {
  const review = { reviewer: 'Jane Example', date: '2026-05-02', review: 'Wonderful days in the Lake District' };
  const orders = [order(10, '2026-01-10', 'yorkshire-dales-photography-workshops', 'Thu 16 Apr 2026')];
  const held = scoreReviewWithOrders(review, [], orders, homes);
  assert.ok(held.score < 0.6 && /no transfer/.test(held.why), 'no transfer found: hold');
  const moved = scoreReviewWithOrders(review, bookings('lake district', '2026-04-20'), orders, homes);
  assert.equal(moved.slug, 'lake-district-photography-workshop');
  assert.equal(moved.transfer, 'booking sheet');
  const noted = scoreReviewWithOrders(review, [], [order(11, '2026-01-10', 'yorkshire-dales-photography-workshops', 'Thu 16 Apr 2026', { notes: ['moved to Lake District'] })], homes);
  assert.equal(noted.transfer, 'order notes');
});

test('order product used when the text is silent and the date fits; undated orders hold unless the booking sheet agrees; no-review products say nothing', () => {
  const review = { reviewer: 'Jane Example', date: '2026-05-02', review: 'Brilliant, learned loads' };
  assert.equal(scoreReviewWithOrders(review, [], [order(20, '2026-01-10', 'yorkshire-dales-photography-workshops', 'Thu 16 Apr 2026')], homes).score, 0.88);
  const undated = [order(21, '2026-03-01', 'four-private-photography-classes', '4 x 2hr sessions')];
  assert.ok(scoreReviewWithOrders(review, [], undated, homes).score < 0.6);
  assert.equal(scoreReviewWithOrders(review, [{ client: 'Jane Example', date: '2026-04-01', label: '1-2-1 private lesson', kind: 'txn' }], undated, homes).score, 0.97);
  assert.equal(scoreReviewWithOrders(review, [], [order(22, '2026-03-01', 'monthly-online-photography-mentoring', '£20 per month')], homes).slug !== 'monthly-online-photography-mentoring', true);
  assert.equal(bucket('held (Alan decided a product)'), 'held');
  assert.equal(bucket('agrees (held; Alan chose business level)'), 'agree');
  assert.equal(bucket('disagrees (same family)'), 'disagree');
});
