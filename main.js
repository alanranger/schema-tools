import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import fs from "fs";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let localServer;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    title: "Alan Ranger Schema Tools v1.5.3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false,
      webSecurity: false, // Allow localhost connections
    },
    show: false, // Don't show until ready
  });

  mainWindow.loadFile("index.html");

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (localServer) {
      console.log("🧹 Stopping local executor...");
      localServer.kill();
    }
  });
}

app.whenReady().then(async () => {
  // Start local executor first
  const serverPath = path.join(__dirname, "scripts", "local-server.js");
  console.log("⚙️ Starting local executor...");
  console.log(`   Server path: ${serverPath}`);
  console.log(`   Working directory: ${__dirname}`);
  
  let serverStarted = false;
  let serverError = null;
  let serverOutput = [];
  
  // Check if server file exists
  if (!fs.existsSync(serverPath)) {
    const error = `Server file not found: ${serverPath}`;
    console.error(`❌ ${error}`);
    serverError = new Error(error);
    createWindow();
    return;
  }
  
  // On Windows with shell: true, use command string format to properly handle paths with spaces
  // On Unix, use array format
  const isWindows = process.platform === 'win32';
  
  if (isWindows) {
    // Windows: Pass as single command string with quoted path
    localServer = spawn(`node "${serverPath}"`, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    });
  } else {
    // Unix/Linux/Mac: Use array format
    localServer = spawn("node", [serverPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      cwd: __dirname,
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV || 'production',
      },
    });
  }

  // Helper to send logs to renderer (only after window is ready)
  const sendServerLog = (type, message) => {
    console.log(`[Server ${type}] ${message}`);
    // Queue messages if window not ready yet, send immediately if ready
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
      mainWindow.webContents.send('server-log', { type, message });
    }
  };

  // Capture server stdout
  localServer.stdout.on('data', (data) => {
    const output = data.toString();
    serverOutput.push({ type: 'stdout', data: output });
    sendServerLog('stdout', output.trim());
  });

  // Capture server stderr
  localServer.stderr.on('data', (data) => {
    const output = data.toString();
    serverOutput.push({ type: 'stderr', data: output });
    sendServerLog('stderr', output.trim());
  });

  localServer.on("error", (err) => {
    console.error("❌ Failed to start local server:", err);
    serverError = err;
    if (mainWindow) {
      mainWindow.webContents.send("server-error", {
        error: err.message,
        output: serverOutput,
      });
    }
  });

  localServer.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`🛑 Local server exited with error code ${code}`);
      console.error(`   Last output:`, serverOutput.slice(-5));
      serverError = new Error(`Server exited with code ${code}`);
      if (mainWindow) {
        mainWindow.webContents.send("server-error", {
          error: `Server exited with code ${code}`,
          output: serverOutput,
        });
      }
    } else {
      console.log(`🛑 Local server exited with code ${code}`);
    }
  });

  // Check if server started successfully
  localServer.on("spawn", () => {
    serverStarted = true;
    sendServerLog('info', '✅ Local server process spawned');
  });

  // Verify server is actually listening by checking health endpoint
  const checkServerHealth = () => {
    return new Promise((resolve) => {
      const req = http.get('http://localhost:8000/health', (res) => {
        if (res.statusCode === 200) {
          console.log("✅ Local server is responding on port 8000");
          resolve(true);
        } else {
          resolve(false);
        }
        res.on('data', () => {}); // Consume response
        res.on('end', () => {});
      });
      
      req.on('error', () => {
        // Server not ready yet, this is expected initially
        resolve(false);
      });
      
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  };

  // Give server time to start, then verify it's running
  setTimeout(async () => {
    const isHealthy = await checkServerHealth();
    
    if (serverError) {
      console.error("⚠️ Local server failed to start - app will continue but automation may not work");
      console.error("   Error:", serverError.message);
      console.error("   Server output:", serverOutput);
      sendServerLog('error', `⚠️ Local server failed to start: ${serverError.message}`);
      if (serverOutput.length > 0) {
        sendServerLog('error', `Server output: ${serverOutput.slice(-3).map(o => o.data.trim()).join('; ')}`);
      }
    } else if (isHealthy) {
      console.log("✅ Local executor bridge ready and responding");
      sendServerLog('success', '✅ Local executor bridge ready and responding on port 8000');
    } else if (serverStarted) {
      console.warn("⚠️ Local server spawned but not responding on port 8000");
      console.warn("   This may be normal if the server is still starting...");
      console.warn("   Server output:", serverOutput.slice(-3));
      sendServerLog('warning', '⚠️ Local server spawned but not responding on port 8000');
      if (serverOutput.length > 0) {
        sendServerLog('info', `Last output: ${serverOutput.slice(-3).map(o => o.data.trim()).join('; ')}`);
      }
    } else {
      console.warn("⚠️ Local server status unclear - app will continue");
      sendServerLog('warning', '⚠️ Local server status unclear - app will continue');
    }
    
    // Create window after server status check
    createWindow();
    
    // Send queued messages after window is ready
    mainWindow.webContents.once('did-finish-load', () => {
      // Send any queued server output
      serverOutput.slice(-10).forEach(output => {
        sendServerLog(output.type, output.data.trim());
      });
    });
  }, 2000); // Increased timeout to 2 seconds

  app.on("activate", () => {
    // On macOS re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  // Quit app (except on macOS where apps typically stay active)
  if (process.platform !== "darwin") {
    if (localServer) {
      console.log("🧹 Shutting down local executor...");
      localServer.kill("SIGTERM");
    }
    app.quit();
  }
});

app.on("before-quit", () => {
  // Gracefully shutdown local server before quitting
  if (localServer) {
    console.log("🧹 Shutting down local executor...");
    localServer.kill("SIGTERM");
  }
});

// IPC handler for building desktop app
ipcMain.handle('build-desktop', async () => {
  return new Promise((resolve, reject) => {
    console.log("🔨 Starting desktop build...");
    
    const buildProcess = spawn("npm", ["run", "build:desktop"], {
      cwd: __dirname,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    buildProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output.trim());
      if (mainWindow) {
        mainWindow.webContents.send('build-progress', { type: 'stdout', data: output });
      }
    });

    buildProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      console.error(output.trim());
      if (mainWindow) {
        mainWindow.webContents.send('build-progress', { type: 'stderr', data: output });
      }
    });

    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log("✅ Desktop build completed successfully");
        if (mainWindow) {
          mainWindow.webContents.send('build-complete', { 
            success: true, 
            message: 'Build completed successfully!',
            output: stdout 
          });
        }
        resolve({ success: true, output: stdout });
      } else {
        const error = `Build failed with exit code ${code}`;
        console.error(`❌ ${error}`);
        if (mainWindow) {
          mainWindow.webContents.send('build-error', { 
            error: error,
            stderr: stderr,
            stdout: stdout 
          });
        }
        reject(new Error(error));
      }
    });

    buildProcess.on('error', (err) => {
      console.error("❌ Build process error:", err);
      if (mainWindow) {
        mainWindow.webContents.send('build-error', { error: err.message });
      }
      reject(err);
    });
  });
});

// IPC handler for opening the built exe
ipcMain.handle('open-exe', async (event, exePath) => {
  try {
    await shell.openPath(exePath);
    return { success: true };
  } catch (error) {
    console.error("Failed to open exe:", error);
    throw error;
  }
});

// IPC handler for getting the exe path
ipcMain.handle('get-exe-path', async () => {
  // Use LOCALAPPDATA environment variable (standard Windows app data location)
  const localAppData = process.env.LOCALAPPDATA || process.env.APPDATA || path.join(process.env.HOME || process.env.USERPROFILE || '', 'AppData', 'Local');
  const exePath = path.join(localAppData, 'SchemaTools', 'SchemaTools-win32-x64', 'SchemaTools.exe');
  
  // Check if file exists
  if (fs.existsSync(exePath)) {
    return exePath;
  }
  
  // Fallback to old dist location (for backwards compatibility)
  const oldPath = path.join(__dirname, 'dist', 'SchemaTools-win32-x64', 'SchemaTools.exe');
  if (fs.existsSync(oldPath)) {
    return oldPath;
  }
  
  return exePath; // Return expected path even if not found yet
});

// IPC handler for opening DevTools (Electron console)
ipcMain.handle('open-devtools', async () => {
  if (mainWindow) {
    mainWindow.webContents.openDevTools();
    return { success: true };
  }
  return { success: false, error: 'Window not available' };
});

// IPC handler for saving schema to alanranger-schema folder and deploying
ipcMain.handle('save-and-deploy-schema', async (event, { fileName, jsonContent }) => {
  return new Promise((resolve, reject) => {
    try {
      // Use actual project path (not __dirname which points to AppData in built app)
      // Check if we're in a built app (AppData path) or development (project folder)
      const isBuiltApp = __dirname.includes('AppData') || __dirname.includes('SchemaTools-win32-x64');
      const projectRoot = isBuiltApp 
        ? 'G:\\Dropbox\\alan ranger photography\\Website Code\\Schema Tools'
        : __dirname;
      
      const schemaRepoPath = path.join(projectRoot, 'alanranger-schema');
      const filePath = path.join(schemaRepoPath, fileName);
      
      // Ensure directory exists
      if (!fs.existsSync(schemaRepoPath)) {
        reject(new Error(`Schema repository folder not found: ${schemaRepoPath}`));
        return;
      }
      
      // Write JSON file
      fs.writeFileSync(filePath, jsonContent, 'utf-8');
      console.log(`✅ Saved schema file: ${filePath}`);
      
      // Git operations - stage, commit, and push
      const commitMessage = `Update ${fileName}`;
      const gitCommands = [
        { cmd: 'git', args: ['add', fileName], desc: 'Stage file' },
        { cmd: 'git', args: ['commit', '-m', commitMessage], desc: 'Commit changes' },
        { cmd: 'git', args: ['push'], desc: 'Push to GitHub' }
      ];
      
      let currentStep = 0;
      const runNextCommand = () => {
        if (currentStep >= gitCommands.length) {
          resolve({ 
            success: true, 
            message: `✅ Schema saved and deployed successfully!`,
            filePath: filePath,
            fileName: fileName
          });
          return;
        }
        
        const { cmd, args, desc } = gitCommands[currentStep];
        console.log(`🔄 Git: ${desc}...`);
        
        // Use shell: false for git commands to ensure proper argument handling
        // This prevents commit messages from being interpreted as pathspecs
        const gitProcess = spawn(cmd, args, {
          cwd: schemaRepoPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        gitProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        gitProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        gitProcess.on('close', (code) => {
          // Check if stderr contains only warnings (not actual errors)
          const hasOnlyWarnings = stderr && (
            stderr.includes('LF will be replaced by CRLF') ||
            stderr.includes('CRLF will be replaced by LF') ||
            stderr.includes('warning:')
          ) && !stderr.toLowerCase().includes('error:') && !stderr.toLowerCase().includes('fatal:');
          
          if (code === 0 || (code === 1 && hasOnlyWarnings)) {
            // Success, or exit code 1 with only warnings (which is OK)
            if (hasOnlyWarnings) {
              console.log(`⚠️ Git: ${desc} completed with warnings (ignored)`);
            } else {
              console.log(`✅ Git: ${desc} completed`);
            }
            currentStep++;
            runNextCommand();
          } else {
            // For commit, code 1 might mean "nothing to commit" - that's OK
            if (currentStep === 1 && code === 1 && stderr.includes('nothing to commit')) {
              console.log(`ℹ️ Git: No changes to commit (file unchanged)`);
              currentStep++;
              runNextCommand();
            } else {
              const error = `Git ${desc} failed with code ${code}: ${stderr || stdout}`;
              console.error(`❌ ${error}`);
              reject(new Error(error));
            }
          }
        });
        
        gitProcess.on('error', (err) => {
          const error = `Git ${desc} error: ${err.message}`;
          console.error(`❌ ${error}`);
          reject(new Error(error));
        });
      };
      
      // Start git operations
      runNextCommand();
      
    } catch (error) {
      console.error('❌ Error saving/deploying schema:', error);
      reject(error);
    }
  });
});

// IPC handler for batch deploying multiple schema files
ipcMain.handle('batch-deploy-schemas', async (event, { files }) => {
  return new Promise((resolve, reject) => {
    try {
      // Use actual project path
      const isBuiltApp = __dirname.includes('AppData') || __dirname.includes('SchemaTools-win32-x64');
      const projectRoot = isBuiltApp 
        ? 'G:\\Dropbox\\alan ranger photography\\Website Code\\Schema Tools'
        : __dirname;
      
      const schemaRepoPath = path.join(projectRoot, 'alanranger-schema');
      
      // Ensure directory exists
      if (!fs.existsSync(schemaRepoPath)) {
        reject(new Error(`Schema repository folder not found: ${schemaRepoPath}`));
        return;
      }

      // Write all files first
      const fileNames = [];
      for (const file of files) {
        const filePath = path.join(schemaRepoPath, file.fileName);
        fs.writeFileSync(filePath, file.jsonContent, 'utf-8');
        fileNames.push(file.fileName);
        console.log(`✅ Saved schema file: ${filePath}`);
      }

      // Git operations - stage all files, commit once, push once
      const commitMessage = `Update ${fileNames.length} product schema files`;
      const gitCommands = [
        { cmd: 'git', args: ['add', ...fileNames], desc: 'Stage all files' },
        { cmd: 'git', args: ['commit', '-m', commitMessage], desc: 'Commit changes' },
        { cmd: 'git', args: ['push'], desc: 'Push to GitHub' }
      ];
      
      let currentStep = 0;
      const runNextCommand = () => {
        if (currentStep >= gitCommands.length) {
          resolve({ 
            success: true, 
            message: `✅ ${fileNames.length} schema files saved and deployed successfully!`,
            fileCount: fileNames.length
          });
          return;
        }
        
        const { cmd, args, desc } = gitCommands[currentStep];
        console.log(`🔄 Git: ${desc}...`);
        
        // Use shell: false for git commands to ensure proper argument handling
        // This prevents commit messages from being interpreted as pathspecs
        const gitProcess = spawn(cmd, args, {
          cwd: schemaRepoPath,
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let stdout = '';
        let stderr = '';
        
        gitProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        gitProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        gitProcess.on('close', (code) => {
          // Check if stderr contains only warnings (not actual errors)
          const hasOnlyWarnings = stderr && (
            stderr.includes('LF will be replaced by CRLF') ||
            stderr.includes('CRLF will be replaced by LF') ||
            stderr.includes('warning:')
          ) && !stderr.toLowerCase().includes('error:') && !stderr.toLowerCase().includes('fatal:');
          
          if (code === 0 || (code === 1 && hasOnlyWarnings)) {
            // Success, or exit code 1 with only warnings (which is OK)
            if (hasOnlyWarnings) {
              console.log(`⚠️ Git: ${desc} completed with warnings (ignored)`);
            } else {
              console.log(`✅ Git: ${desc} completed`);
            }
            currentStep++;
            runNextCommand();
          } else {
            // For commit, code 1 might mean "nothing to commit" - that's OK
            if (currentStep === 1 && code === 1 && stderr.includes('nothing to commit')) {
              console.log(`ℹ️ Git: No changes to commit (files unchanged)`);
              currentStep++;
              runNextCommand();
            } else {
              const error = `Git ${desc} failed with code ${code}: ${stderr || stdout}`;
              console.error(`❌ ${error}`);
              reject(new Error(error));
            }
          }
        });
        
        gitProcess.on('error', (err) => {
          const error = `Git ${desc} error: ${err.message}`;
          console.error(`❌ ${error}`);
          reject(new Error(error));
        });
      };
      
      // Start git operations
      runNextCommand();
      
    } catch (error) {
      console.error('❌ Error batch deploying schemas:', error);
      reject(error);
    }
  });
});

// IPC handler for reading files
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, content };
  } catch (error) {
    console.error('❌ Error reading file:', error);
    throw error;
  }
});

// IPC handler for writing files
ipcMain.handle('write-file', async (event, { filePath, content }) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('❌ Error writing file:', error);
    throw error;
  }
});

