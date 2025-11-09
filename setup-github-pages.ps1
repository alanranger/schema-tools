# PowerShell setup script for GitHub Pages schema hosting repository

$REPO_NAME = "alanranger-schema"
$REPO_URL = "https://github.com/alanranger/${REPO_NAME}.git"

Write-Host "Setting up GitHub Pages schema hosting repository..." -ForegroundColor Cyan

# Check if repository already exists locally
if (Test-Path $REPO_NAME) {
    Write-Host "Repository directory already exists. Removing..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $REPO_NAME
}

# Create repository directory
New-Item -ItemType Directory -Path $REPO_NAME -Force | Out-Null
Set-Location $REPO_NAME

# Initialize git repository
git init
git remote add origin $REPO_URL 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Remote already exists or will be added manually" -ForegroundColor Gray
}

# Create directory structure
New-Item -ItemType Directory -Path "public" -Force | Out-Null
New-Item -ItemType Directory -Path ".github\workflows" -Force | Out-Null

# Copy files from parent directory
if (Test-Path "..\schema-repo\README.md") {
    Copy-Item "..\schema-repo\README.md" -Force
    Write-Host "Copied README.md" -ForegroundColor Green
} else {
    Write-Host "README.md not found in schema-repo/" -ForegroundColor Yellow
}

if (Test-Path "..\schema-repo\CNAME") {
    Copy-Item "..\schema-repo\CNAME" -Force
    Write-Host "Copied CNAME" -ForegroundColor Green
} else {
    "schema.alanranger.com" | Out-File -FilePath "CNAME" -Encoding utf8
    Write-Host "Created CNAME" -ForegroundColor Green
}

if (Test-Path "..\schema-repo\.gitignore") {
    Copy-Item "..\schema-repo\.gitignore" -Force
    Write-Host "Copied .gitignore" -ForegroundColor Green
} else {
    $gitignoreContent = "node_modules/`ntmp/`nbuild/`n.cursor-cache/`n*.log`n.DS_Store"
    $gitignoreContent | Out-File -FilePath ".gitignore" -Encoding utf8
    Write-Host "Created .gitignore" -ForegroundColor Green
}

# Copy GitHub Actions workflow
if (Test-Path "..\.github\workflows\update-schema.yml") {
    Copy-Item "..\.github\workflows\update-schema.yml" ".github\workflows\" -Force
    Write-Host "Copied GitHub Actions workflow" -ForegroundColor Green
} else {
    Write-Host "GitHub Actions workflow not found" -ForegroundColor Yellow
}

# Copy existing schema files or create placeholders
if (Test-Path "..\outputs\lessons-schema.json") {
    Copy-Item "..\outputs\lessons-schema.json" "public\" -Force
    Write-Host "Copied lessons-schema.json" -ForegroundColor Green
} else {
    '{"@context":"https://schema.org","@graph":[]}' | Out-File -FilePath "public\lessons-schema.json" -Encoding utf8
    Write-Host "Created placeholder lessons-schema.json" -ForegroundColor Yellow
}

if (Test-Path "..\outputs\workshops-schema.json") {
    Copy-Item "..\outputs\workshops-schema.json" "public\" -Force
    Write-Host "Copied workshops-schema.json" -ForegroundColor Green
} else {
    '{"@context":"https://schema.org","@graph":[]}' | Out-File -FilePath "public\workshops-schema.json" -Encoding utf8
    Write-Host "Created placeholder workshops-schema.json" -ForegroundColor Yellow
}

# Stage all files
git add .

# Check if there are changes to commit
$status = git status --porcelain
if ($status) {
    git commit -m "Initial commit - Add schema JSON files for Squarespace + GitHub Pages setup"
    Write-Host "Committed initial files" -ForegroundColor Green
} else {
    Write-Host "No changes to commit" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Repository setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Create the repository on GitHub: https://github.com/new" -ForegroundColor White
Write-Host "   - Name: $REPO_NAME" -ForegroundColor Gray
Write-Host "   - Description: Public repository hosting structured data (JSON-LD) for alanranger.com Squarespace pages" -ForegroundColor Gray
Write-Host "   - Visibility: Public" -ForegroundColor Gray
Write-Host "   - DO NOT initialize with README (we already have one)" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Push to GitHub:" -ForegroundColor White
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Enable GitHub Pages:" -ForegroundColor White
Write-Host "   - Go to Settings -> Pages" -ForegroundColor Gray
Write-Host "   - Source: Deploy from branch" -ForegroundColor Gray
Write-Host "   - Branch: main" -ForegroundColor Gray
Write-Host '   - Folder: /(root)' -ForegroundColor Gray
Write-Host ""
Write-Host '4. Configure DNS:' -ForegroundColor White
Write-Host '   - Add CNAME record: schema -> alanranger.github.io' -ForegroundColor Gray
Write-Host '   - Wait for propagation (5-30 minutes)' -ForegroundColor Gray
Write-Host ""
Write-Host '5. Verify:' -ForegroundColor White
Write-Host '   - https://schema.alanranger.com/lessons-schema.json' -ForegroundColor Gray
Write-Host '   - https://schema.alanranger.com/workshops-schema.json' -ForegroundColor Gray

