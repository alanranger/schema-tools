#!/usr/bin/env node
/**
 * Build Desktop App Script
 * Properly expands LOCALAPPDATA environment variable for Windows
 * 
 * ⚠️ CRITICAL: This script builds the PACKAGED Electron app from SOURCE files.
 * 
 * IMPORTANT WORKFLOW:
 * 1. Source files are in project root (index.html, main.js, preload.js, etc.)
 * 2. This script uses electron-packager to copy ALL source files to:
 *    %LOCALAPPDATA%\SchemaTools\SchemaTools-win32-x64\resources\app\
 * 3. User runs the packaged .exe, NOT the source files directly
 * 
 * MANDATORY: After ANY source code changes, user MUST run this build script
 * to update the packaged app. Changes to source files do NOT automatically
 * appear in the running packaged app.
 * 
 * See readme.md and handover-cursor-ai.md for full documentation.
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
const tempAppDir = path.join(outputDir, 'SchemaTools-win32-x64.temp.' + Date.now());
const finalAppDir = path.join(outputDir, 'SchemaTools-win32-x64');

console.log(`📁 Building to: ${outputDir}`);

// Kill only Electron and SchemaTools processes that might be locking files
async function killLockingProcesses() {
  if (process.platform === 'win32') {
    try {
      console.log('🔍 Checking for Electron/SchemaTools processes that might lock files...');
      const processes = ['electron.exe', 'SchemaTools.exe'];
      
      // Only kill Electron and SchemaTools processes (not all Node processes)
      // This avoids killing MCP servers and other unrelated Node processes
      for (const proc of processes) {
        try {
          const result = execSync(`tasklist /FI "IMAGENAME eq ${proc}" /FO CSV /NH`, { 
            encoding: 'utf-8',
            stdio: 'pipe'
          });
          if (result.trim() && result.includes(proc)) {
            console.log(`⚠️  Found ${proc} processes. Closing...`);
            try {
              execSync(`taskkill /F /IM ${proc}`, { stdio: 'ignore' });
              console.log(`✅ Closed ${proc}`);
            } catch (e) {
              // Ignore if already closed or permission denied
            }
          }
        } catch (e) {
          // Process not found - continue
        }
      }
      
      // Wait for processes to fully terminate and files to unlock
      console.log('⏳ Waiting for files to unlock...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      // Continue anyway
    }
  }
}

// Try to remove old directory if it exists
async function cleanupOldDirectory() {
  if (process.platform === 'win32' && fs.existsSync(oldAppDir)) {
    console.log('🗑️  Attempting to remove old build directory...');
    
    // Try rename first (works even if files are locked)
    const renamedDir = oldAppDir + '.old.' + Date.now();
    try {
      fs.renameSync(oldAppDir, renamedDir);
      console.log('✅ Renamed old directory (will delete later)');
      
      // Try to delete renamed directory in background
      setTimeout(async () => {
        for (let i = 0; i < 5; i++) {
          try {
            fs.rmSync(renamedDir, { recursive: true, force: true });
            console.log('✅ Cleaned up old renamed directory');
            break;
          } catch (e) {
            if (i < 4) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
      }, 10000);
      return true;
    } catch (renameError) {
      console.log('⚠️  Could not rename old directory');
    }
    
    // If rename failed, try direct deletion
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        fs.rmSync(oldAppDir, { recursive: true, force: true });
        console.log('✅ Old directory removed');
        return true;
      } catch (e) {
        if (attempt < 2) {
          console.log(`⚠️  Attempt ${attempt + 1} failed, waiting 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
    
    console.log('⚠️  Could not remove old directory. Will use temporary name for build.');
    return false;
  }
  return true;
}

// Build command - use temporary directory name to avoid conflicts
async function build() {
  await killLockingProcesses();
  const cleanupSuccess = await cleanupOldDirectory();
  
  // Use a temporary directory name if cleanup failed
  const buildOutputDir = cleanupSuccess ? outputDir : outputDir;
  const buildAppName = cleanupSuccess ? 'SchemaTools' : `SchemaTools-temp-${Date.now()}`;
  
  const buildCommand = `electron-packager "${projectRoot}" ${buildAppName} --platform=win32 --arch=x64 --out="${buildOutputDir}" --overwrite`;
  
  try {
    console.log('🔨 Starting build...');
    execSync(buildCommand, { 
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true
    });
    
    // If we used a temp name, rename it to the final name
    if (!cleanupSuccess) {
      const tempBuiltDir = path.join(buildOutputDir, buildAppName + '-win32-x64');
      if (fs.existsSync(tempBuiltDir)) {
        // Remove final dir if it exists
        if (fs.existsSync(finalAppDir)) {
          try {
            fs.rmSync(finalAppDir, { recursive: true, force: true });
          } catch (e) {
            // Ignore
          }
        }
        // Rename temp to final
        fs.renameSync(tempBuiltDir, finalAppDir);
        console.log('✅ Renamed temporary build to final location');
      }
    }
    
    console.log(`\n✅ Build complete! App saved to: ${finalAppDir}\\SchemaTools.exe`);
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    if (error.message.includes('EBUSY') || error.message.includes('locked')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Close ALL Node.js and Electron processes in Task Manager');
      console.error('   2. Close any Windows Explorer windows');
      console.error('   3. Disable Windows Search Indexer temporarily');
      console.error('   4. Try running as Administrator');
      console.error('   5. Restart your computer if needed');
    }
    process.exit(1);
  }
}

try {
  await build();
} catch (error) {
  console.error('\n❌ Unexpected error:', error.message);
  process.exit(1);
}

