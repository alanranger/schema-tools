#!/usr/bin/env node
/**
 * Build Desktop App Script
 * Properly expands LOCALAPPDATA environment variable for Windows
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Get LOCALAPPDATA path (works on Windows)
const localAppData = process.env.LOCALAPPDATA || 
                     process.env.APPDATA?.replace('\\Roaming', '\\Local') ||
                     path.join(process.env.HOME || process.env.USERPROFILE || '', 'AppData', 'Local');

const outputDir = path.join(localAppData, 'SchemaTools');

console.log(`📁 Building to: ${outputDir}`);

// Build command
const buildCommand = `electron-packager "${projectRoot}" SchemaTools --platform=win32 --arch=x64 --out="${outputDir}" --overwrite`;

try {
  console.log('🔨 Starting build...');
  execSync(buildCommand, { 
    stdio: 'inherit',
    cwd: projectRoot,
    shell: true
  });
  console.log(`\n✅ Build complete! App saved to: ${outputDir}\\SchemaTools-win32-x64\\SchemaTools.exe`);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}

