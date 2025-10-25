// Runs backend tests 10 times. Prints a short header BEFORE each run so the final
// line on screen remains Jest's highlighted summary from the 10th run.
const { spawnSync } = require('child_process');

for (let i = 1; i <= 10; i++) {
  process.stdout.write(`\n===== Backend test run ${i}/10 =====\n`);
  const result = spawnSync('npm', ['run', 'test:pretty', '--silent'], {
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
