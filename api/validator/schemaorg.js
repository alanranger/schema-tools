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
    // Schema.org validator shows this in various formats, try multiple patterns
    const patterns = [
      // Pattern 1: "0 ERRORS 0 WARNINGS 5 ITEMS" (most common)
      /(\d+)\s+ERRORS?\s+(\d+)\s+WARNINGS?\s+(\d+)\s+ITEMS?/i,
      // Pattern 2: "0 ERRORS, 0 WARNINGS, 5 ITEMS" (with commas)
      /(\d+)\s+ERRORS?,\s*(\d+)\s+WARNINGS?,\s*(\d+)\s+ITEMS?/i,
      // Pattern 3: Separate elements (e.g., in different tags)
      /(\d+)\s*ERRORS?/i,
      /(\d+)\s*WARNINGS?/i,
      /(\d+)\s*ITEMS?/i
    ];
    
    let errorCount = 0;
    let warningCount = 0;
    let itemCount = 0;
    
    // Try the combined pattern first
    const summaryMatch = html.match(/(\d+)\s+ERRORS?\s+(\d+)\s+WARNINGS?\s+(\d+)\s+ITEMS?/i);
    
    if (summaryMatch) {
      errorCount = parseInt(summaryMatch[1], 10);
      warningCount = parseInt(summaryMatch[2], 10);
      itemCount = parseInt(summaryMatch[3], 10);
    } else {
      // Fallback: try to find individual counts
      const errorMatch = html.match(/(\d+)\s+ERRORS?/i);
      const warningMatch = html.match(/(\d+)\s+WARNINGS?/i);
      const itemMatch = html.match(/(\d+)\s+ITEMS?/i);
      
      if (errorMatch) errorCount = parseInt(errorMatch[1], 10);
      if (warningMatch) warningCount = parseInt(warningMatch[1], 10);
      if (itemMatch) itemCount = parseInt(itemMatch[1], 10);
    }
    
    // Determine status based on actual counts
    if (errorCount > 0) {
      status = 'failed';
      // Try to extract error messages
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
    } else if (warningCount > 0) {
      status = 'warnings';
      // Try to extract warning messages
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
    } else {
      // 0 errors and 0 warnings = passed
      status = 'passed';
    }
    
    // Debug logging (remove in production if needed)
    console.log(`Schema.org parsing: errors=${errorCount}, warnings=${warningCount}, items=${itemCount}, status=${status}`);
    
    // If we found item count but couldn't determine status, and there are items, it's likely passed
    if (status === 'passed' && itemCount === 0 && html.match(/no\s+structured\s+data/i)) {
      status = 'failed';
      errors.push('No structured data found on page');
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

