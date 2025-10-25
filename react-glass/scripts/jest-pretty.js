// Wrapper to run CRA tests and replace the Jest "Tests: X passed, Y total" summary
// with "Tests: X Passed, Y Total" while retaining green coloring.
const { spawn } = require('child_process');

const GREEN = '\u001b[32m';
const RESET = '\u001b[39m';
const ANSI_RE = /\u001b\[[0-9;]*m/g; // strip ANSI for matching only
let lastSummary = null;

function run() {
  const args = ['test', '--watchAll=false'];
  const child = spawn('react-scripts', args, { shell: true });

  let buf = '';
  child.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx + 1);
      buf = buf.slice(idx + 1);
      processLine(line);
    }
  });
  let errBuf = '';
  child.stderr.on('data', (chunk) => {
    errBuf += chunk.toString();
    let idx;
    while ((idx = errBuf.indexOf('\n')) >= 0) {
      const line = errBuf.slice(0, idx + 1);
      errBuf = errBuf.slice(idx + 1);
      processLine(line);
    }
  });
  child.on('close', (code) => {
    // flush remainder
    if (buf.length) processLine(buf);
    if (errBuf.length) processLine(errBuf);
    // Ensure last line shown is the highlighted tests summary
    if (lastSummary) {
      process.stdout.write(lastSummary);
    }
    process.exit(code);
  });
}

function processLine(line) {
  const plain = line.replace(ANSI_RE, '');
  const m = plain.match(/^Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
  if (m) {
    const passed = m[1];
    const total = m[2];
    const pretty = `Tests: ${GREEN}${passed} Passed, ${total} Total${RESET}\n`;
    lastSummary = pretty; // store to reprint at end
    process.stdout.write(pretty);
  } else {
    process.stdout.write(line);
  }
}

run();
