const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let localServer;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: false, // Allow localhost connections
      preload: path.join(__dirname, "preload.js"), // Load preload script
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
  });

  // Development: Open DevTools (comment out for production)
  // mainWindow.webContents.openDevTools();
}

function startLocalServer() {
  const serverPath = path.join(__dirname, "scripts", "local-server.js");
  console.log("⚙️ Launching local executor bridge...");
  console.log(`   Server path: ${serverPath}`);

  localServer = spawn("node", [serverPath], {
    stdio: "inherit",
    shell: true,
    cwd: __dirname,
  });

  localServer.on("error", (err) => {
    console.error("❌ Failed to start local server:", err);
    if (mainWindow) {
      mainWindow.webContents.send("server-error", err.message);
    }
  });

  localServer.on("exit", (code) => {
    console.log(`🛑 Local server exited with code ${code}`);
  });

  // Give server a moment to start before loading the window
  setTimeout(() => {
    console.log("✅ Local executor bridge ready");
  }, 1000);
}

app.whenReady().then(() => {
  // Start local executor first
  startLocalServer();

  // Create window after a brief delay to ensure server is starting
  setTimeout(() => {
    createWindow();
  }, 500);

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

