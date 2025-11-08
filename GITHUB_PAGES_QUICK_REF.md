# GitHub Pages Schema Hosting - Quick Reference

## Repository URLs

- **GitHub Repository**: https://github.com/alanranger/alanranger-schema
- **GitHub Pages (default)**: https://alanranger.github.io/alanranger-schema/
- **Custom Domain**: https://schema.alanranger.com/

## Schema File URLs

- **Lessons Schema**: https://schema.alanranger.com/lessons-schema.json
- **Workshops Schema**: https://schema.alanranger.com/workshops-schema.json

## Squarespace Script Tags

### Courses Page (`/beginners-photography-lessons`)
```html
<!-- Lessons Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/lessons-schema.json">
</script>
```

### Workshops Page (`/photographic-workshops-near-me`)
```html
<!-- Workshops Schema -->
<script type="application/ld+json"
        src="https://schema.alanranger.com/workshops-schema.json">
</script>
```

## Update Workflow

1. Export schema from Event Schema Generator (downloads JSON)
2. Copy to repository:
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
4. GitHub Actions auto-deploys (or trigger manually in Actions tab)

## Validation

- **Google Rich Results**: https://search.google.com/test/rich-results
- **Schema.org Validator**: https://validator.schema.org/

## DNS Configuration

```
Type: CNAME
Name: schema
Value: alanranger.github.io
TTL: 3600
```

## Troubleshooting

- **DNS not working?** Wait 5-30 minutes, check with `nslookup schema.alanranger.com`
- **Pages not updating?** Check Actions tab for workflow errors
- **Schema not loading?** Verify script tag syntax and check browser console

