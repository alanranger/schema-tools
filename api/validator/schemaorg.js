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
    // - Success: contains "No errors found" or similar success messages
    // - Warnings: contains warning messages
    // - Errors: contains error messages or validation failures
    
    let status = 'passed';
    const errors = [];
    const warnings = [];

    // Check for errors (common patterns in Schema.org validator HTML)
    const errorPatterns = [
      /error/i,
      /validation failed/i,
      /no structured data found/i,
      /invalid/i,
      /failed to parse/i
    ];

    // Check for warnings
    const warningPatterns = [
      /warning/i,
      /recommendation/i,
      /suggestion/i
    ];

    // Check for success indicators
    const successPatterns = [
      /no errors found/i,
      /valid/i,
      /success/i
    ];

    // Simple heuristic: count error vs warning vs success indicators
    let errorCount = 0;
    let warningCount = 0;
    let successCount = 0;

    errorPatterns.forEach(pattern => {
      const matches = html.match(new RegExp(pattern, 'gi'));
      if (matches) errorCount += matches.length;
    });

    warningPatterns.forEach(pattern => {
      const matches = html.match(new RegExp(pattern, 'gi'));
      if (matches) warningCount += matches.length;
    });

    successPatterns.forEach(pattern => {
      const matches = html.match(new RegExp(pattern, 'gi'));
      if (matches) successCount += matches.length;
    });

    // Determine status based on counts
    if (errorCount > 0) {
      status = 'failed';
      // Try to extract error messages (simple extraction)
      const errorMatches = html.match(/<[^>]*error[^>]*>([^<]+)<\/[^>]*>/gi);
      if (errorMatches) {
        errorMatches.slice(0, 5).forEach(match => {
          const text = match.replace(/<[^>]*>/g, '').trim();
          if (text && text.length < 200) errors.push(text);
        });
      }
    } else if (warningCount > 0) {
      status = 'warnings';
      // Try to extract warning messages
      const warningMatches = html.match(/<[^>]*warning[^>]*>([^<]+)<\/[^>]*>/gi);
      if (warningMatches) {
        warningMatches.slice(0, 5).forEach(match => {
          const text = match.replace(/<[^>]*>/g, '').trim();
          if (text && text.length < 200) warnings.push(text);
        });
      }
    } else if (successCount > 0) {
      status = 'passed';
    } else {
      // If we can't determine, default to warnings (conservative)
      status = 'warnings';
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

