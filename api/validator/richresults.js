// Google Rich Results validator via URL Inspection API
// POST /api/validator/richresults
// Body: { "url": "https://..." }
// Optional query: ?force=1 to bypass cache

import { google } from 'googleapis';

// Simple in-memory cache (24h TTL)
const cache = new Map();

function getCacheKey(url) {
  return `richresults:${url}`;
}

function getCached(url) {
  const key = getCacheKey(url);
  const cached = cache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  const ttl = 24 * 60 * 60 * 1000; // 24 hours
  
  if (age > ttl) {
    cache.delete(key);
    return null;
  }
  
  return cached.data;
}

function setCache(url, data) {
  const key = getCacheKey(url);
  cache.set(key, {
    timestamp: Date.now(),
    data: data
  });
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  const force = req.query.force === '1';

  // Validate input
  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      ok: false,
      error: 'missing_url',
      detail: 'Missing or invalid url in request body'
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({
      ok: false,
      error: 'invalid_url',
      detail: 'Invalid URL format'
    });
  }

  // Check cache unless force=1
  if (!force) {
    const cached = getCached(url);
    if (cached) {
      return res.status(200).json({
        ...cached,
        cached: true
      });
    }
  }

  // Check required environment variables
  const requiredEnvs = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SEARCH_PROPERTY'];
  const missing = requiredEnvs.filter(env => !process.env[env]);

  if (missing.length > 0) {
    return res.status(500).json({
      ok: false,
      error: 'missing_env',
      missing: missing
    });
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const siteUrl = process.env.GOOGLE_SEARCH_PROPERTY;

  try {
    // Build JWT auth client
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/webmasters']
    });

    // Initialize Search Console API
    const searchconsole = google.searchconsole({
      version: 'v1',
      auth: auth
    });

    // Call URL Inspection API
    const response = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: url,
        siteUrl: siteUrl,
        languageCode: 'en-GB'
      }
    });

    const inspectionResult = response.data.inspectionResult || {};
    const indexStatusResult = inspectionResult.indexStatusResult || {};
    const richResultsResult = inspectionResult.richResultsResult || {};

    // Extract verdict
    const verdict = indexStatusResult.verdict || 'NEUTRAL';

    // Extract rich result types
    const detectedItems = richResultsResult.detectedItems || [];
    const types = detectedItems.map(item => item.richResultType || '').filter(Boolean);

    // Extract issues (up to 5)
    const issues = [];
    detectedItems.forEach(item => {
      const blocks = item.items || [];
      blocks.forEach(block => {
        const itemIssues = block.issues || [];
        itemIssues.forEach(issue => {
          const severity = issue.severity || '';
          const message = issue.message || '';
          if (message && issues.length < 5) {
            issues.push(`${severity ? severity + ': ' : ''}${message}`);
          }
        });
      });
    });

    // Map verdict to status
    let status = 'unknown';
    switch (verdict) {
      case 'PASS':
        status = 'eligible';
        break;
      case 'PARTIAL':
        status = 'warnings';
        break;
      case 'FAIL':
        status = 'ineligible';
        break;
      default:
        status = 'unknown';
    }

    // Build report URL
    const reportUrl = `https://search.google.com/test/rich-results?url=${encodeURIComponent(url)}`;

    const result = {
      ok: true,
      status: status,
      verdict: verdict,
      types: types,
      issues: issues.slice(0, 5),
      reportUrl: reportUrl,
      cached: false
    };

    // Cache the result
    setCache(url, result);

    return res.status(200).json(result);

  } catch (error) {
    // Handle API errors
    const statusCode = error.code || error.response?.status || 500;
    let errorResponse = {
      ok: false,
      error: 'gapi_error',
      detail: error.message || 'Unknown error'
    };

    if (statusCode === 403) {
      errorResponse.error = 'not_authorized';
      errorResponse.detail = 'Service account not authorized for Search Console API';
    } else if (statusCode === 404 || statusCode === 400) {
      errorResponse.error = 'outside_property';
      errorResponse.detail = 'URL is outside the configured Search Console property';
    }

    return res.status(200).json(errorResponse);
  }
}

