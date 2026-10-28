#!/usr/bin/env node
import { probeBlogPostLive } from './lib/blog-index-live.mjs';

const urls = [
  'https://www.alanranger.com/blog-on-photography/photography-light-review-kf-pl60b',
  'https://www.alanranger.com/blog-on-photography/lee-filter-15-percent-off'
];

for (const url of urls) {
  const probe = await probeBlogPostLive(url);
  console.log(`${probe.live ? 'LIVE' : 'skip'} ${url} (${probe.reason})`);
}
