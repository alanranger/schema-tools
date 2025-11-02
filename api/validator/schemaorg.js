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
    // Schema.org validator shows a summary like: "0 ERRORS 0 WARNINGS 5 ITEMS"
    // We need to extract the actual numbers, not just look for the word "error"
    
    let status = 'passed';
    const errors = [];
    const warnings = [];

    // Look for the validation summary pattern: "X ERRORS Y WARNINGS Z ITEMS"
    // This appears in the HTML as text content, often in a heading or summary div
    const summaryMatch = html.match(/(\d+)\s*ERRORS?\s*(\d+)\s*WARNINGS?\s*(\d+)\s*ITEMS?/i);
    
    if (summaryMatch) {
      const errorCount = parseInt(summaryMatch[1], 10);
      const warningCount = parseInt(summaryMatch[2], 10);
      const itemCount = parseInt(summaryMatch[3], 10);
      
      // Determine status based on actual counts
      if (errorCount > 0) {
        status = 'failed';
      } else if (warningCount > 0) {
        status = 'warnings';
      } else {
        status = 'passed';
      }
      
      // Try to extract error messages if there are errors
      if (errorCount > 0) {
        // Look for error list items or error messages in the HTML
        // Schema.org validator typically shows errors in a structured format
        const errorSectionMatch = html.match(/<[^>]*class[^>]*error[^>]*>([\s\S]*?)<\/[^>]*>/gi);
        if (errorSectionMatch) {
          errorSectionMatch.slice(0, Math.min(errorCount, 10)).forEach(match => {
            const text = match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (text && text.length < 200 && !text.match(/^\d+\s*ERRORS?$/i)) {
              errors.push(text);
            }
          });
        }
        
        // If we couldn't extract errors, at least note the count
        if (errors.length === 0 && errorCount > 0) {
          errors.push(`${errorCount} validation error${errorCount > 1 ? 's' : ''} found`);
        }
      }
      
      // Try to extract warning messages if there are warnings
      if (warningCount > 0) {
        const warningSectionMatch = html.match(/<[^>]*class[^>]*warning[^>]*>([\s\S]*?)<\/[^>]*>/gi);
        if (warningSectionMatch) {
          warningSectionMatch.slice(0, Math.min(warningCount, 10)).forEach(match => {
            const text = match.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (text && text.length < 200 && !text.match(/^\d+\s*WARNINGS?$/i)) {
              warnings.push(text);
            }
          });
        }
        
        // If we couldn't extract warnings, at least note the count
        if (warnings.length === 0 && warningCount > 0) {
          warnings.push(`${warningCount} warning${warningCount > 1 ? 's' : ''} found`);
        }
      }
    } else {
      // Fallback: Look for other indicators if summary pattern not found
      // Check for "No errors found" or similar success messages
      if (html.match(/no\s+errors?\s+found/i) || html.match(/validation\s+successful/i)) {
        status = 'passed';
      } else if (html.match(/no\s+structured\s+data/i)) {
        status = 'failed';
        errors.push('No structured data found on page');
      } else {
        // If we can't determine, default to warnings (conservative)
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

