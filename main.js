import { app, BrowserWindow } from "electron";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let localServer;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    title: "Alan Ranger Schema Tools v1.5.0",
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

app.whenReady().then(() => {
  // Start local executor first
  const serverPath = path.join(__dirname, "scripts", "local-server.js");
  console.log("⚙️ Starting local executor...");
  console.log(`   Server path: ${serverPath}`);
  
  let serverStarted = false;
  let serverError = null;
  
  localServer = spawn("node", [serverPath], {
    stdio: "inherit",
    shell: true,
    cwd: __dirname,
  });

  localServer.on("error", (err) => {
    console.error("❌ Failed to start local server:", err);
    serverError = err;
    if (mainWindow) {
      mainWindow.webContents.send("server-error", err.message);
    }
  });

  localServer.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`🛑 Local server exited with error code ${code}`);
      serverError = new Error(`Server exited with code ${code}`);
    } else {
      console.log(`🛑 Local server exited with code ${code}`);
    }
  });

  // Check if server started successfully
  localServer.on("spawn", () => {
    serverStarted = true;
    console.log("✅ Local server process spawned");
  });

  // Give server a moment to start before loading the window
  setTimeout(() => {
    if (serverError) {
      console.error("⚠️ Local server failed to start - app will continue but automation may not work");
      console.error("   Error:", serverError.message);
    } else if (serverStarted) {
      console.log("✅ Local executor bridge ready");
    } else {
      console.warn("⚠️ Local server status unclear - app will continue");
    }
    createWindow();
  }, 1500);

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

