// Lightweight local controller to spawn the Python backend on demand
// Runs alongside CRA during development. Exposes:
//  - POST /start  => starts Python (if not already) and waits for /health = ok
//  - POST /stop   => stops Python (best effort)
//  - GET  /health => status of controller + python process

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const PY_HOST = 'localhost';
const PY_PORT = 5000;
const CTRL_PORT = process.env.LOCAL_API_PORT || 5050;

let pythonProc = null;
let lastStartCmd = null;

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

function checkBackendHealth(timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.request({
      host: PY_HOST,
      port: PY_PORT,
      path: '/health',
      method: 'GET',
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ ok: res.statusCode === 200, json });
        } catch {
          resolve({ ok: false });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

async function waitForHealthy(maxWaitMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const { ok, json } = await checkBackendHealth();
    if (ok && json && json.model_loaded) return { ok: true, json };
    await sleep(500);
  }
  return { ok: false };
}

function resolvePythonScript() {
  // server.js is in react-glass/local-api; project root is two levels up
  const projectRoot = path.resolve(__dirname, '..', '..');
  const script = path.join(projectRoot, 'App', 'app.py');
  return { projectRoot, script };
}

function spawnPython() {
  const { projectRoot, script } = resolvePythonScript();
  const commands = [];
  if (process.env.BACKEND_PYTHON) commands.push(process.env.BACKEND_PYTHON);
  commands.push('python', 'py', 'python3');

  let attempted = [];
  let child = null;
  for (const cmd of commands) {
    try {
      const args = cmd === 'py' ? ['-3', script] : [script];
      child = spawn(cmd, args, { cwd: projectRoot, stdio: 'inherit', shell: false });
      lastStartCmd = `${cmd} ${args.join(' ')}`;
      break;
    } catch (e) {
      attempted.push(cmd);
    }
  }
  if (!child) {
    throw new Error(`Failed to spawn Python. Tried: ${attempted.join(', ')}`);
  }
  child.on('exit', (code, signal) => {
    console.log(`[local-api] Python process exited code=${code} signal=${signal}`);
    pythonProc = null;
  });
  return child;
}

app.get('/health', async (_req, res) => {
  const backend = await checkBackendHealth();
  res.json({
    controller: 'ok',
    pythonRunning: !!pythonProc,
    pythonCmd: lastStartCmd,
    backend: backend.ok ? backend.json : null,
  });
});

app.post('/start', async (_req, res) => {
  // If backend already healthy, nothing to do
  const pre = await checkBackendHealth();
  if (pre.ok && pre.json && pre.json.model_loaded) {
    return res.json({ started: false, alreadyRunning: true, backend: pre.json });
  }

  if (!pythonProc) {
    try {
      pythonProc = spawnPython();
      console.log('[local-api] Spawned Python backend:', lastStartCmd);
    } catch (e) {
      console.error('[local-api] Error spawning Python:', e);
      return res.status(500).json({ error: String(e) });
    }
  } else {
    console.log('[local-api] Python already spawned; waiting for health');
  }

  const healthy = await waitForHealthy();
  if (!healthy.ok) {
    return res.status(504).json({ error: 'Backend did not become healthy in time' });
  }
  return res.json({ started: true, backend: healthy.json });
});

app.post('/stop', async (_req, res) => {
  try {
    if (pythonProc) {
      const p = pythonProc;
      pythonProc = null;
      p.kill('SIGTERM');
      setTimeout(() => p.kill('SIGKILL'), 3000);
    }
    res.json({ stopped: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(CTRL_PORT, () => {
  console.log(`[local-api] Controller listening on http://localhost:${CTRL_PORT}`);
});
