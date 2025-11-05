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
import { spawn } from "child_process";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 8000;

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

app.listen(PORT, () => {
  console.log(`⚡ Local executor running at http://localhost:${PORT}`);
  console.log(`📋 Available tasks: ${Object.keys(TASK_MAP).join(", ")}`);
  console.log(`💡 Health check: http://localhost:${PORT}/health`);
});

