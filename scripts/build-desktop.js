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
      
      // Check for Node processes that might have handles to the build directory
      // Only kill if they're likely related to the build process or have handles to our directory
      try {
        const nodeProcesses = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', { 
          encoding: 'utf-8',
          stdio: 'pipe'
        });
        if (nodeProcesses.trim() && nodeProcesses.includes('node.exe')) {
          const lines = nodeProcesses.trim().split('\n').filter(line => line.trim());
          const currentPid = process.pid;
          let killedCount = 0;
          
          for (const line of lines) {
            try {
              const match = line.match(/"node\.exe","(\d+)"/);
              if (match) {
                const pid = parseInt(match[1]);
                // Don't kill this build script or its parent
                if (pid !== currentPid && pid !== process.ppid) {
                  // Check if this process has handles to our target directory
                  // Use PowerShell to check for open handles (requires admin, but worth trying)
                  try {
                    const handleCheck = execSync(
                      `powershell -Command "Get-Process -Id ${pid} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path"`,
                      { encoding: 'utf-8', stdio: 'pipe', timeout: 2000 }
                    );
                    // If process path contains SchemaTools or is in the build directory, kill it
                    if (handleCheck && (handleCheck.includes('SchemaTools') || handleCheck.includes(outputDir.replace(/\\/g, '/')))) {
                      console.log(`⚠️  Found Node process (PID ${pid}) with potential handles to build directory. Closing...`);
                      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
                      killedCount++;
                    }
                  } catch (e) {
                    // If we can't check, be conservative - don't kill it
                    // This preserves MCP servers that aren't related to the build
                  }
                }
              }
            } catch (e) {
              // Ignore individual process errors
            }
          }
          if (killedCount > 0) {
            console.log(`✅ Closed ${killedCount} Node process(es) with potential file locks`);
          }
        }
      } catch (e) {
        // No node.exe processes or couldn't list them - continue
      }
      
      // Wait for processes to fully terminate and files to unlock
      console.log('⏳ Waiting for files to unlock...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
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
    
    // If we used a temp name, copy it to the final name (copy is more tolerant of locks than rename)
    if (!cleanupSuccess) {
      const tempBuiltDir = path.join(buildOutputDir, buildAppName + '-win32-x64');
      if (fs.existsSync(tempBuiltDir)) {
        // Remove final dir if it exists (with retries)
        if (fs.existsSync(finalAppDir)) {
          for (let attempt = 0; attempt < 5; attempt++) {
            try {
              fs.rmSync(finalAppDir, { recursive: true, force: true });
              console.log('✅ Removed old final directory');
              break;
            } catch (e) {
              if (attempt < 4) {
                console.log(`⚠️  Attempt ${attempt + 1} to remove old directory failed, waiting 2 seconds...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
              } else {
                console.log('⚠️  Could not remove old final directory, will try copy anyway...');
              }
            }
          }
        }
        
        // Wait a bit before attempting copy to let file handles release
        console.log('⏳ Waiting before final copy...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Copy temp to final (copy is more tolerant of locks than rename)
        // Use robocopy on Windows for better file lock handling
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            // Use copy instead of rename - copy is more tolerant of file locks
            // Copy recursively from temp to final location
            fs.cpSync(tempBuiltDir, finalAppDir, { recursive: true, force: true });
            console.log('✅ Copied temporary build to final location');
            
            // Try to remove temp directory after successful copy
            try {
              fs.rmSync(tempBuiltDir, { recursive: true, force: true });
              console.log('✅ Cleaned up temporary directory');
            } catch (e) {
              // Ignore cleanup errors
            }
            break;
          } catch (e) {
            if (attempt < 4) {
              console.log(`⚠️  Copy attempt ${attempt + 1} failed (${e.message}), waiting 3 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              throw new Error(`Failed to copy build directory after 5 attempts: ${e.message}\nThe app is available at: ${tempBuiltDir}\\SchemaTools.exe\n\n💡 Tip: Close Windows Explorer windows, Dropbox, and any processes accessing the SchemaTools folder.`);
            }
          }
        }
      }
    }
    
    console.log(`\n✅ Build complete! App saved to: ${finalAppDir}\\SchemaTools.exe`);
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    if (error.message.includes('EBUSY') || error.message.includes('locked') || error.message.includes('EPERM') || error.message.includes('permission')) {
      console.error('\n💡 Troubleshooting:');
      console.error('   1. Close ALL SchemaTools.exe and Electron processes in Task Manager');
      console.error('   2. Close any Windows Explorer windows showing the SchemaTools folder');
      console.error('   3. Close Dropbox and wait for sync to finish (if using Dropbox)');
      console.error('   4. Disable Windows Search Indexer temporarily');
      console.error('   5. Try running PowerShell as Administrator');
      console.error('   6. If the temp build exists, you can run it from:');
      console.error(`      ${outputDir}\\SchemaTools-temp-*-win32-x64\\SchemaTools.exe`);
      console.error('   7. Restart your computer if needed');
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

