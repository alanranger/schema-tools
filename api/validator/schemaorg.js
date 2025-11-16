// Vercel serverless function: Schema.org validator proxy
// GET /api/validator/schemaorg?url=<encoded-url>

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    // Decode URL
    const decodedUrl = decodeURIComponent(url);
    
    // Validate URL format
    if (!decodedUrl.startsWith('http://') && !decodedUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Fetch Schema.org validator page
    const validatorUrl = `https://validator.schema.org/?url=${encodeURIComponent(decodedUrl)}`;
    const response = await fetch(validatorUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SchemaValidator/1.0)'
      }
    });

    if (!response.ok) {
      return res.status(200).json({
        status: 'unreachable',
        errors: [],
        warnings: [],
        cached: false
      });
    }

    const html = await response.text();
    
    // Parse HTML to determine status
    // Schema.org validator shows:
    // - Success: "0 ERRORS 0 WARNINGS" or "No errors found"
    // - Warnings: "0 ERRORS X WARNINGS" (where X > 0)
    // - Errors: "X ERRORS" (where X > 0)
    
    let status = 'passed';
    const errors = [];
    const warnings = [];

    // First, check for explicit success patterns (these override everything)
    const successPatterns = [
      /0\s+ERRORS?\s+0\s+WARNINGS?/i,  // "0 ERRORS 0 WARNINGS"
      /no\s+errors?\s+found/i,          // "No errors found"
      /valid.*structured\s+data/i,      // "Valid structured data"
      /successfully\s+validated/i       // "Successfully validated"
    ];

    // Check for explicit error patterns (actual errors, not "0 ERRORS")
    const errorPatterns = [
      /[1-9]\d*\s+ERRORS?/i,            // "1 ERROR", "2 ERRORS", etc. (but not "0 ERRORS")
      /validation\s+failed/i,
      /no\s+structured\s+data\s+found/i,
      /failed\s+to\s+parse/i,
      /invalid\s+json/i
    ];

    // Check for warning patterns (but not "0 WARNINGS")
    const warningPatterns = [
      /[1-9]\d*\s+WARNINGS?/i,          // "1 WARNING", "2 WARNINGS", etc. (but not "0 WARNINGS")
      /recommendation/i,
      /suggestion/i
    ];

    // Check for success first (most specific)
    let hasSuccess = false;
    for (const pattern of successPatterns) {
      if (pattern.test(html)) {
        hasSuccess = true;
        break;
      }
    }

    // Check for actual errors (not "0 ERRORS")
    let hasErrors = false;
    for (const pattern of errorPatterns) {
      if (pattern.test(html)) {
        hasErrors = true;
        // Try to extract error messages
        const errorMatches = html.match(/<[^>]*error[^>]*>([^<]+)<\/[^>]*>/gi);
        if (errorMatches) {
          errorMatches.slice(0, 5).forEach(match => {
            const text = match.replace(/<[^>]*>/g, '').trim();
            // Only add if it's not "0 ERRORS" or similar success message
            if (text && text.length < 200 && !/^0\s+errors?/i.test(text)) {
              errors.push(text);
            }
          });
        }
        break;
      }
    }

    // Check for actual warnings (not "0 WARNINGS")
    let hasWarnings = false;
    for (const pattern of warningPatterns) {
      if (pattern.test(html)) {
        hasWarnings = true;
        // Try to extract warning messages
        const warningMatches = html.match(/<[^>]*warning[^>]*>([^<]+)<\/[^>]*>/gi);
        if (warningMatches) {
          warningMatches.slice(0, 5).forEach(match => {
            const text = match.replace(/<[^>]*>/g, '').trim();
            // Only add if it's not "0 WARNINGS" or similar success message
            if (text && text.length < 200 && !/^0\s+warnings?/i.test(text)) {
              warnings.push(text);
            }
          });
        }
        break;
      }
    }

    // Determine status (success overrides everything)
    if (hasSuccess && !hasErrors) {
      status = 'passed';
    } else if (hasErrors) {
      status = 'failed';
    } else if (hasWarnings) {
      status = 'warnings';
    } else {
      // If we can't determine, check if we found any schema types (indicates success)
      if (html.includes('@type') || html.includes('schema.org')) {
        status = 'passed';
      } else {
        // Conservative default
        status = 'warnings';
      }
    }

    // Return response
    return res.status(200).json({
      status,
      errors: errors.slice(0, 10), // Limit to 10 errors
      warnings: warnings.slice(0, 10), // Limit to 10 warnings
      cached: false
    });

  } catch (error) {
    console.error('Schema.org validator error:', error);
    return res.status(200).json({
      status: 'unreachable',
      errors: [],
      warnings: [],
      cached: false
    });
  }
}

