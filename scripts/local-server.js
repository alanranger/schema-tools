/**
 * Local Server Bridge
 * Lightweight Express bridge between browser UI and Python executor
 * 
 * Usage:
 *   node scripts/local-server.js
 *   or
 *   npm run start-local
 */

import express from "express";
import { spawn, execSync } from "child_process";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const START_PORT = 8000;
const MAX_PORT_ATTEMPTS = 10; // Try ports 8000-8009

const TASK_MAP = {
  clean: "clean",
  fetch: "fetch",
  merge: "merge",
  schema: "schema",
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Local executor server is running" });
});

// Exit endpoint - gracefully stop the server
app.get("/exit", (req, res) => {
  res.json({ status: "shutting down", message: "Local executor stopping..." });
  console.log("🛑 Shutdown requested via /exit endpoint");
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// Task execution endpoint
app.get("/run", (req, res) => {
  const task = req.query.task;
  
  if (!task) {
    return res.status(400).send("❌ Missing task parameter\n");
  }
  
  if (!TASK_MAP[task]) {
    return res.status(400).send(`❌ Invalid task: ${task}\nAvailable tasks: ${Object.keys(TASK_MAP).join(", ")}\n`);
  }

  console.log(`📥 Received task request: ${task}`);
  
  // Set headers for streaming response
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  // Change to project root directory
  const projectRoot = path.resolve(__dirname, "..");
  
  // Spawn Python process
  const py = spawn("python", ["scripts/run-local-task.py", "--task", task], {
    cwd: projectRoot,
    shell: false,
    env: {
      ...process.env,
      PYTHONIOENCODING: "utf-8",
    },
  });

  // Stream stdout to response
  py.stdout.on("data", (data) => {
    const output = data.toString();
    res.write(output);
    console.log(`[${task}] ${output.trim()}`);
  });

  // Stream stderr to response
  py.stderr.on("data", (data) => {
    const error = data.toString();
    res.write(`ERROR: ${error}`);
    console.error(`[${task}] ERROR: ${error.trim()}`);
  });

  // Handle process completion
  py.on("close", (code) => {
    if (code === 0) {
      res.end(`\n✅ Task '${task}' complete (exit code ${code})\n`);
    } else {
      res.end(`\n❌ Task '${task}' failed (exit code ${code})\n`);
    }
    console.log(`[${task}] Process finished with exit code ${code}`);
  });

  // Handle process errors
  py.on("error", (error) => {
    const errorMsg = `❌ Failed to start task '${task}': ${error.message}\n`;
    res.end(errorMsg);
    console.error(`[${task}] Process error:`, error);
  });

  // Handle client disconnect
  req.on("close", () => {
    if (!py.killed) {
      py.kill("SIGTERM");
      console.log(`[${task}] Client disconnected, terminating process`);
    }
  });
});

// Function to start server on first available port
async function startServerOnAvailablePort() {
  const fs = await import('fs');
  let currentPort = START_PORT;
  let attempts = 0;
  
  while (attempts < MAX_PORT_ATTEMPTS) {
    try {
      const server = app.listen(currentPort, () => {
        console.log(`⚡ Local executor running at http://localhost:${currentPort}`);
        console.log(`📋 Available tasks: ${Object.keys(TASK_MAP).join(", ")}`);
        console.log(`💡 Health check: http://localhost:${currentPort}/health`);
        
        if (currentPort !== START_PORT) {
          console.log(`ℹ️ Port ${START_PORT} was in use, using port ${currentPort} instead`);
        }
        
        // Write port to a file so client can discover it
        const portFile = path.join(__dirname, '..', 'inputs-files', 'workflow', '.server-port');
        try {
          const portDir = path.dirname(portFile);
          if (!fs.existsSync(portDir)) {
            fs.mkdirSync(portDir, { recursive: true });
          }
          fs.writeFileSync(portFile, currentPort.toString(), 'utf-8');
        } catch (e) {
          // Ignore if we can't write the file
          console.log(`⚠️ Could not write port file: ${e.message}`);
        }
      });
      
      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // Port is in use, try next one
          attempts++;
          currentPort++;
          if (attempts >= MAX_PORT_ATTEMPTS) {
            console.error(`❌ Failed to start server: Could not find available port after ${MAX_PORT_ATTEMPTS} attempts`);
            console.error(`\n💡 Solutions:`);
            console.error(`   1. Close any other instances of this app`);
            console.error(`   2. Close any other applications using ports ${START_PORT}-${START_PORT + MAX_PORT_ATTEMPTS - 1}`);
            console.error(`   3. Restart your computer`);
            process.exit(1);
          }
          // Try next port
          startServerOnAvailablePort();
        } else {
          console.error(`❌ Server error: ${err.message}`);
          process.exit(1);
        }
      });
      
      // Successfully started
      return;
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        currentPort++;
        if (attempts >= MAX_PORT_ATTEMPTS) {
          console.error(`❌ Failed to start server: Could not find available port after ${MAX_PORT_ATTEMPTS} attempts`);
          console.error(`\n💡 Solutions:`);
          console.error(`   1. Close any other instances of this app`);
          console.error(`   2. Close any other applications using ports ${START_PORT}-${START_PORT + MAX_PORT_ATTEMPTS - 1}`);
          console.error(`   3. Restart your computer`);
          process.exit(1);
        }
        // Continue to next iteration
        continue;
      } else {
        console.error(`❌ Server error: ${err.message}`);
        process.exit(1);
      }
    }
  }
}

// Start the server
startServerOnAvailablePort();

