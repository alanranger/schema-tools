#!/usr/bin/env node
/**
 * Build Desktop App Script
 * Properly expands LOCALAPPDATA environment variable for Windows
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Get LOCALAPPDATA path (works on Windows)
const localAppData = process.env.LOCALAPPDATA || 
                     process.env.APPDATA?.replace('\\Roaming', '\\Local') ||
                     path.join(process.env.HOME || process.env.USERPROFILE || '', 'AppData', 'Local');

const outputDir = path.join(localAppData, 'SchemaTools');
const oldAppDir = path.join(outputDir, 'SchemaTools-win32-x64');

console.log(`📁 Building to: ${outputDir}`);

// Try to kill any running instances and remove old directory (Windows only)
async function prepareBuild() {
  if (process.platform === 'win32') {
    try {
      console.log('🔍 Checking for running instances...');
      const result = execSync('tasklist /FI "IMAGENAME eq SchemaTools.exe" /FO CSV /NH', { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      if (result.trim() && result.includes('SchemaTools.exe')) {
        console.log('⚠️  Found running SchemaTools.exe instances. Attempting to close...');
        try {
          execSync('taskkill /F /IM SchemaTools.exe', { stdio: 'ignore' });
          console.log('✅ Closed running instances');
          // Wait a moment for files to unlock
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
          console.log('⚠️  Could not close instances automatically. Please close SchemaTools.exe manually.');
        }
      }
    } catch (e) {
      // No instances running or tasklist failed - continue
    }
    
    // Try to remove old directory if it exists (with retry)
    if (fs.existsSync(oldAppDir)) {
      console.log('🗑️  Removing old build directory...');
      let removed = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          fs.rmSync(oldAppDir, { recursive: true, force: true });
          removed = true;
          console.log('✅ Old directory removed');
          break;
        } catch (e) {
          if (attempt < 2) {
            console.log(`⚠️  Attempt ${attempt + 1} failed, waiting 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.log('⚠️  Could not remove old directory. It may be locked.');
            console.log('💡 Please close SchemaTools.exe and any Windows Explorer windows showing that folder.');
          }
        }
      }
    }
  }
}

// Build command
const buildCommand = `electron-packager "${projectRoot}" SchemaTools --platform=win32 --arch=x64 --out="${outputDir}" --overwrite`;

try {
  await prepareBuild();
  console.log('🔨 Starting build...');
  execSync(buildCommand, { 
    stdio: 'inherit',
    cwd: projectRoot,
    shell: true
  });
  console.log(`\n✅ Build complete! App saved to: ${outputDir}\\SchemaTools-win32-x64\\SchemaTools.exe`);
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  if (error.message.includes('EBUSY') || error.message.includes('locked')) {
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Close SchemaTools.exe if it\'s running');
    console.error('   2. Close any Windows Explorer windows showing:');
    console.error(`      ${oldAppDir}`);
    console.error('   3. Wait a few seconds and try again');
  }
  process.exit(1);
}

