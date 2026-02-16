const { spawn } = require('child_process');
let backendProc = null;

function startBackendOnce() {
  if (backendProc && !backendProc.killed) return;
  const cwd = process.cwd().replace(/Frontend$/, 'backend');
  backendProc = spawn('node', ['server.js'], { cwd, env: { ...process.env }, stdio: 'inherit' });
  backendProc.on('exit', (code) => {
    backendProc = null;
    console.log(`[proxy] backend exited with code ${code}`);
  });
}

module.exports = function(app) {
  // Dev helper: start backend when frontend calls this endpoint
  app.use('/__start_backend', (req, res) => {
    try {
      startBackendOnce();
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  });
};

