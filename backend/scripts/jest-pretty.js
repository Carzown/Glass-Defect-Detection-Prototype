// Wrapper to run backend Jest and replace the summary line with capitalized labels
const { spawn } = require('child_process');

const GREEN = '\u001b[32m';
const RESET = '\u001b[39m';
const ANSI_RE = /\u001b\[[0-9;]*m/g;
let lastSummary = null;

function run() {
  const child = spawn('npx', ['jest', '--runInBand'], { shell: true });
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
    if (buf.length) processLine(buf);
    if (errBuf.length) processLine(errBuf);
    // Ensure the very last line printed is the highlighted summary
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
    lastSummary = pretty; // store to print at the end
    process.stdout.write(pretty);
  } else {
    process.stdout.write(line);
  }
}

run();
