// Temporary smoke test route for Google Search Console auth
// GET /api/gsc-smoke
// Verifies GSC auth and env vars are configured correctly

const { google } = require('googleapis');

module.exports = async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check required environment variables
  const requiredEnvs = ['GOOGLE_CLIENT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'GOOGLE_SEARCH_PROPERTY'];
  const missing = requiredEnvs.filter(env => !process.env[env]);

  if (missing.length > 0) {
    return res.status(400).json({
      ok: false,
      error: 'missing_env',
      missing: missing
    });
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const property = process.env.GOOGLE_SEARCH_PROPERTY;

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

    // Call Search Console API: list sites
    const response = await searchconsole.sites.list({});

    const sites = response.data.siteEntry || [];
    const siteUrls = sites.map(site => site.siteUrl || '');
    const foundProperty = siteUrls.includes(property);

    // Return success response
    return res.status(200).json({
      ok: true,
      property: property,
      foundProperty: foundProperty,
      sitesCount: sites.length,
      sitesSample: siteUrls.slice(0, 5)
    });

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
    } else if (statusCode === 404) {
      errorResponse.error = 'not_found';
      errorResponse.detail = 'API endpoint not found';
    }

    return res.status(200).json(errorResponse);
  }
};

