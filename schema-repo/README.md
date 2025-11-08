# Alan Ranger Schema Hosting

Public repository hosting structured data (JSON-LD) for alanranger.com Squarespace pages.

## Files

- `lessons-schema.json` → `/beginners-photography-lessons`
- `workshops-schema.json` → `/photographic-workshops-near-me`

## Hosting

- **GitHub Pages**: https://alanranger.github.io/alanranger-schema/
- **Custom Domain**: https://schema.alanranger.com/
- **Auto-sync**: Enabled via GitHub Actions

## Usage

### Squarespace Integration

Add these script tags to your Squarespace page header code:

**For Courses Page** (`/beginners-photography-lessons`):
```html
<!-- Lessons Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/lessons-schema.json">
</script>
```

**For Workshops Page** (`/photographic-workshops-near-me`):
```html
<!-- Workshops Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/workshops-schema.json">
</script>
```

### Auto-Sync

Schema files are automatically synced from the local Event Schema Generator tool via GitHub Actions. When you export schema JSON files, they are automatically pushed to this repository and deployed to GitHub Pages.

## Validation

Validate hosted JSON files with:
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

## Repository Structure

```
alanranger-schema/
├── public/
│   ├── lessons-schema.json
│   └── workshops-schema.json
├── .github/
│   └── workflows/
│       └── update-schema.yml
├── CNAME
└── README.md
```

## DNS Configuration

Add a CNAME record at your DNS provider:

```
schema CNAME alanranger.github.io
```

Wait for DNS propagation (usually 5-30 minutes).

