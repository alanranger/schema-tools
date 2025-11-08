#!/bin/bash
# Setup script for GitHub Pages schema hosting repository

set -e

REPO_NAME="alanranger-schema"
REPO_URL="https://github.com/alanranger/${REPO_NAME}.git"

echo "🚀 Setting up GitHub Pages schema hosting repository..."

# Check if repository already exists locally
if [ -d "$REPO_NAME" ]; then
    echo "⚠️  Repository directory already exists. Removing..."
    rm -rf "$REPO_NAME"
fi

# Create repository directory
mkdir -p "$REPO_NAME"
cd "$REPO_NAME"

# Initialize git repository
git init
git remote add origin "$REPO_URL" || echo "Remote already exists"

# Create directory structure
mkdir -p public .github/workflows

# Copy files from parent directory
if [ -f "../schema-repo/README.md" ]; then
    cp ../schema-repo/README.md .
else
    echo "⚠️  README.md not found in schema-repo/"
fi

if [ -f "../schema-repo/CNAME" ]; then
    cp ../schema-repo/CNAME .
else
    echo "schema.alanranger.com" > CNAME
fi

if [ -f "../schema-repo/.gitignore" ]; then
    cp ../schema-repo/.gitignore .
else
    cat > .gitignore << EOF
node_modules/
tmp/
build/
.cursor-cache/
*.log
.DS_Store
EOF
fi

# Copy GitHub Actions workflow
if [ -f "../.github/workflows/update-schema.yml" ]; then
    cp ../.github/workflows/update-schema.yml .github/workflows/
else
    echo "⚠️  GitHub Actions workflow not found"
fi

# Copy existing schema files or create placeholders
if [ -f "../outputs/lessons-schema.json" ]; then
    cp ../outputs/lessons-schema.json public/
    echo "✅ Copied lessons-schema.json"
else
    echo '{"@context":"https://schema.org","@graph":[]}' > public/lessons-schema.json
    echo "⚠️  Created placeholder lessons-schema.json"
fi

if [ -f "../outputs/workshops-schema.json" ]; then
    cp ../outputs/workshops-schema.json public/
    echo "✅ Copied workshops-schema.json"
else
    echo '{"@context":"https://schema.org","@graph":[]}' > public/workshops-schema.json
    echo "⚠️  Created placeholder workshops-schema.json"
fi

# Stage all files
git add .

# Check if there are changes to commit
if git diff --staged --quiet; then
    echo "ℹ️  No changes to commit"
else
    git commit -m "Initial commit — Add schema JSON files for Squarespace + GitHub Pages setup"
    echo "✅ Committed initial files"
fi

echo ""
echo "✅ Repository setup complete!"
echo ""
echo "Next steps:"
echo "1. Create the repository on GitHub: https://github.com/new"
echo "   - Name: $REPO_NAME"
echo "   - Description: Public repository hosting structured data (JSON-LD) for alanranger.com Squarespace pages"
echo "   - Visibility: Public"
echo "   - DO NOT initialize with README (we already have one)"
echo ""
echo "2. Push to GitHub:"
echo "   cd $REPO_NAME"
echo "   git push -u origin main"
echo ""
echo "3. Enable GitHub Pages:"
echo "   - Go to Settings → Pages"
echo "   - Source: Deploy from branch"
echo "   - Branch: main"
echo "   - Folder: /(root)"
echo ""
echo "4. Configure DNS:"
echo "   - Add CNAME record: schema → alanranger.github.io"
echo "   - Wait for propagation (5-30 minutes)"
echo ""
echo "5. Verify:"
echo "   - https://schema.alanranger.com/lessons-schema.json"
echo "   - https://schema.alanranger.com/workshops-schema.json"

