# GitHub Pages Schema Hosting Setup Guide

This guide will help you set up automated schema hosting via GitHub Pages.

## Prerequisites

- GitHub account (alanranger)
- Access to DNS settings for alanranger.com
- Git installed locally

## Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `alanranger-schema`
3. Description: `Public repository hosting structured data (JSON-LD) for alanranger.com Squarespace pages`
4. Visibility: **Public**
5. Initialize with: **README** (optional, we'll replace it)
6. Click **Create repository**

## Step 2: Clone and Setup Repository

```bash
# Clone the new repository
git clone https://github.com/alanranger/alanranger-schema.git
cd alanranger-schema

# Create directory structure
mkdir -p public .github/workflows

# Copy files from schema-repo folder
cp ../schema-repo/README.md .
cp ../schema-repo/CNAME .
cp ../schema-repo/.gitignore .

# Copy GitHub Actions workflow
cp ../.github/workflows/update-schema.yml .github/workflows/

# Copy existing schema files (if they exist)
cp ../outputs/lessons-schema.json public/ 2>/dev/null || echo "lessons-schema.json not found - will be added later"
cp ../outputs/workshops-schema.json public/ 2>/dev/null || echo "workshops-schema.json not found - will be added later"

# Create placeholder files if they don't exist
touch public/lessons-schema.json public/workshops-schema.json
echo '{"@context":"https://schema.org","@graph":[]}' > public/lessons-schema.json
echo '{"@context":"https://schema.org","@graph":[]}' > public/workshops-schema.json

# Initial commit
git add .
git commit -m "Initial commit — Add schema JSON files for Squarespace + GitHub Pages setup"
git push -u origin main
```

## Step 3: Enable GitHub Pages

1. Go to repository Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main**
4. Folder: **/(root)**
5. Click **Save**

## Step 4: Configure Custom Domain

1. In GitHub Pages settings, add custom domain: `schema.alanranger.com`
2. This will create/enable the CNAME file

## Step 5: Configure DNS

Add a CNAME record at your DNS provider (Squarespace or Cloudflare):

```
Type: CNAME
Name: schema
Value: alanranger.github.io
TTL: 3600 (or Auto)
```

Wait for DNS propagation (5-30 minutes). Verify with:
```bash
dig schema.alanranger.com CNAME
# Should return: schema.alanranger.com. CNAME alanranger.github.io.
```

## Step 6: Verify Deployment

After DNS propagates, verify URLs work:

- https://schema.alanranger.com/lessons-schema.json
- https://schema.alanranger.com/workshops-schema.json
- https://alanranger.github.io/alanranger-schema/lessons-schema.json

Files should display as JSON (not download).

## Step 7: Test Auto-Sync Workflow

1. Make a small change to `public/lessons-schema.json`
2. Commit and push:
   ```bash
   git add public/lessons-schema.json
   git commit -m "Test auto-sync"
   git push
   ```
3. Check GitHub Actions tab - workflow should run automatically
4. Verify file updates on GitHub Pages within 1-2 minutes

## Step 8: Squarespace Integration

Once URLs are live, add to Squarespace:

### For Courses Page (`/beginners-photography-lessons`):
Settings → Advanced → Code Injection → Page Header Code:
```html
<!-- Lessons Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/lessons-schema.json">
</script>
```

### For Workshops Page (`/photographic-workshops-near-me`):
Settings → Advanced → Code Injection → Page Header Code:
```html
<!-- Workshops Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/workshops-schema.json">
</script>
```

## Step 9: Validate

Test hosted schema files:

1. **Google Rich Results Test**: https://search.google.com/test/rich-results
   - Enter: `https://www.alanranger.com/beginners-photography-lessons`
   - Should detect schema from external file

2. **Schema.org Validator**: https://validator.schema.org/
   - Enter: `https://schema.alanranger.com/lessons-schema.json`
   - Should validate successfully

## Troubleshooting

### DNS Not Propagating
- Wait up to 48 hours for full propagation
- Check DNS with: `nslookup schema.alanranger.com`
- Verify CNAME record is correct

### GitHub Pages Not Updating
- Check Actions tab for workflow errors
- Ensure files are in `public/` folder
- Verify branch is `main` and Pages source is set correctly

### Schema Not Loading in Squarespace
- Verify script tag syntax is correct
- Check browser console for CORS errors
- Ensure JSON file returns `Content-Type: application/json`

## Maintenance

### Updating Schema Files

1. Export from Event Schema Generator (downloads JSON)
2. Copy to `public/` folder:
   ```bash
   cp outputs/lessons-schema.json alanranger-schema/public/
   cp outputs/workshops-schema.json alanranger-schema/public/
   ```
3. Commit and push:
   ```bash
   cd alanranger-schema
   git add public/*.json
   git commit -m "Update schema files"
   git push
   ```
4. GitHub Actions will auto-deploy (or deploy manually via Actions tab)

### Manual Workflow Trigger

If needed, manually trigger the workflow:
1. Go to Actions tab
2. Select "Update Schema Files" workflow
3. Click "Run workflow" → "Run workflow"

## Files Structure

```
alanranger-schema/
├── public/
│   ├── lessons-schema.json
│   └── workshops-schema.json
├── .github/
│   └── workflows/
│       └── update-schema.yml
├── CNAME
├── .gitignore
└── README.md
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/alanranger/alanranger-schema/issues
- Repository: https://github.com/alanranger/alanranger-schema

