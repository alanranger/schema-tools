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

// IMPORTANT: Avoid packaging previous packaged builds into the next build.
// If we include ./dist (which contains prior SchemaTools-win32-x64), the packaged
// app ends up with nested paths like:
//   resources/app/dist/SchemaTools-win32-x64/resources/app/...
// This can bloat builds and cause startup issues on Windows.
const ignorePatterns = [
  '^/dist($|/)',
  '^/outputs($|/)',
  '^/release($|/)',
  '^/html - tools($|/)',
  '^/\\.git($|/)',
];
const ignoreArgs = ignorePatterns.map(p => `--ignore="${p}"`).join(' ');

function runRoboCopyMirror(src, dest) {
  // robocopy exit codes: 0-7 are success (copied, extra files deleted, etc.)
  // 8+ indicates failure.
  const cmd = `robocopy "${src}" "${dest}" /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP`;
  try {
    execSync(cmd, { stdio: 'ignore', shell: true });
  } catch (e) {
    const code = typeof e?.status === 'number' ? e.status : 999;
    if (code <= 7) return; // treat as success
    throw e;
  }
}

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

  // IMPORTANT:
  // Do NOT build into outputDir directly. electron-packager --overwrite tries to delete
  // existing folders, which regularly fails on Windows due to file locks (Explorer/AV/etc).
  // Instead, always build into a fresh temp out folder, then mirror-copy into finalAppDir.
  const appName = 'SchemaTools'; // keep exe name stable: SchemaTools.exe
  const buildOutDir = path.join(outputDir, `build-temp-${Date.now()}`);
  fs.mkdirSync(buildOutDir, { recursive: true });

  // Always build to a new directory (no need for cleanupOldDirectory).
  const buildCommand = `electron-packager "${projectRoot}" ${appName} --platform=win32 --arch=x64 --out="${buildOutDir}" --overwrite ${ignoreArgs}`;
  
  try {
    console.log('🔨 Starting build...');
    execSync(buildCommand, { 
      stdio: 'inherit',
      cwd: projectRoot,
      shell: true
    });

    // Mirror-copy build into the stable final folder (keeps shortcuts working).
    const builtDir = path.join(buildOutDir, `${appName}-win32-x64`);
    if (!fs.existsSync(builtDir)) {
      throw new Error(`Expected build output folder not found: ${builtDir}`);
    }

    // Wait a bit before attempting copy to let file handles release
    console.log('⏳ Waiting before final copy...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (process.platform === 'win32') {
          runRoboCopyMirror(builtDir, finalAppDir);
        } else {
          fs.rmSync(finalAppDir, { recursive: true, force: true });
          fs.cpSync(builtDir, finalAppDir, { recursive: true, force: true });
        }
        console.log('✅ Copied build to final location');

        // Cleanup: remove any old temp-named exe lingering in final folder (from prior builds)
        try {
          if (process.platform === 'win32' && fs.existsSync(finalAppDir)) {
            for (const file of fs.readdirSync(finalAppDir)) {
              if (/^SchemaTools-temp-.*\.exe$/i.test(file)) {
                try { fs.rmSync(path.join(finalAppDir, file), { force: true }); } catch {}
              }
            }
          }
        } catch {}

        // Cleanup temp output directory (best effort)
        try { fs.rmSync(buildOutDir, { recursive: true, force: true }); } catch {}
        break;
      } catch (e) {
        if (attempt < 4) {
          console.log(`⚠️  Copy attempt ${attempt + 1} failed (${e.message}), waiting 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        } else {
          throw new Error(
            `Failed to copy build directory after 5 attempts: ${e.message}\n` +
            `The app is available at: ${builtDir}\\SchemaTools.exe\n\n` +
            `💡 Tip: Close Windows Explorer windows and any processes accessing the SchemaTools folder.`
          );
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

