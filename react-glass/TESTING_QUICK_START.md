# Dashboard Test Suite - Quick Start Guide

## Installation

### 1. Install Dependencies
```bash
cd react-glass
npm install
```

This installs:
- Testing framework (Jest)
- React Testing Library
- Babel for JSX transpilation
- CSS module mocking
- DOM environment

### 2. Verify Installation
```bash
npm test -- --version
```

Should output Jest version (e.g., `29.7.0`).

## Running Tests

### Basic Test Run
```bash
npm test
```
Press `a` to run all tests.

### Watch Mode (Recommended for Development)
```bash
npm run test:watch
```

Features:
- Auto-runs tests when files change
- Press `o` to run only changed tests
- Press `p` to filter by filename
- Press `t` to filter by test name
- Press `q` to quit

### Coverage Report
```bash
npm run test:coverage
```

Generates HTML report in `coverage/` directory.

## Test Structure

### Files Created

```
react-glass/
├── src/
│   ├── pages/
│   │   ├── Dashboard.js              # Component (existing)
│   │   └── Dashboard.test.js          # NEW: 80+ test cases
│   └── setupTests.js                  # NEW: Test environment setup
├── jest.config.js                     # NEW: Jest configuration
├── .babelrc                           # NEW: Babel configuration
├── __mocks__/
│   └── fileMock.js                    # NEW: Mock for static assets
└── TEST_SUITE_README.md               # NEW: Detailed documentation
```

## What Gets Tested

### 1. Component Rendering (7 tests)
✅ Dashboard renders without errors
✅ Sidebar displays correctly
✅ Video preview section exists
✅ Defects panel section exists
✅ Placeholder text shows when idle

### 2. Detection Control (5 tests)
✅ Start Detection button functionality
✅ Stop Detection button functionality
✅ Socket events emitted correctly
✅ Socket connection management
✅ Client identification

### 3. Pause/Resume (4 tests)
✅ Pause button appears during detection
✅ Resume button appears when paused
✅ Correct socket events emitted
✅ State transitions work correctly

### 4. Live Streaming (3 tests)
✅ Frame data displays
✅ Waiting for stream message shown
✅ Live indicator displays

### 5. Defect Management (5 tests)
✅ Defects added from socket events
✅ Time formatting correct
✅ List limited to 20 items
✅ Defect labels display

### 6. CSV Operations (6 tests)
✅ CSV download with proper headers
✅ CSV upload and parsing
✅ Header row skipping
✅ Button state management

### 7. Clear Defects (7 tests)
✅ Confirmation modal opens
✅ Defects cleared on confirm
✅ Detection stopped when clearing
✅ Modal can be cancelled

### 8. Image Modal (6 tests)
✅ Modal opens on image click
✅ Modal closes correctly
✅ Navigation between images works
✅ Image URLs displayed

### 9. Logout (4 tests)
✅ User sign-out called
✅ Session cleared
✅ LocalStorage managed correctly

### 10. Error Handling (2 tests)
✅ Connection errors handled
✅ Detection stops on error

### 11. Additional Tests (5 tests)
✅ Socket events registered
✅ Component cleanup on unmount
✅ Accessibility attributes present

## Key Test Examples

### Test 1: Starting Detection
```bash
npm run test:watch
# Type 't' to filter tests
# Type 'Start Detection'
# See the test run and pass
```

**What it tests:**
- Button text changes from "Start Detection" to "Stop Detection"
- Socket.IO emits `dashboard:start` event
- Socket connects to backend
- Socket identifies as 'dashboard' client

### Test 2: CSV Upload
```bash
npm run test:watch
# Type 't' to filter by 'CSV'
```

**What it tests:**
- CSV file parsing
- Header row detection and skipping
- Defect extraction from CSV
- Dynamic list updating
- Button state management

### Test 3: Clear Defects with Confirmation
```bash
npm run test:watch
# Type 't' to filter by 'Clear'
```

**What it tests:**
- Confirmation modal appears
- Defects are cleared
- Detection stops when clearing
- Modal can be cancelled
- Button states update

## Monitoring Test Progress

### First Run Output Example
```
PASS  src/pages/Dashboard.test.js
  Dashboard Component
    Component Rendering
      ✓ should render Dashboard component without crashing (45ms)
      ✓ should render sidebar with navigation items (32ms)
      ✓ should render detection preview section (28ms)
      ...
    
    Detection Control
      ✓ should change button text when starting detection (52ms)
      ✓ should emit dashboard:start event when starting (48ms)
      ...

Test Suites: 1 passed, 1 total
Tests:       80 passed, 80 total
Snapshots:   0 total
Time:        12.456 s
```

### Common Test Results

**✓ PASS** - Test executed successfully
**✕ FAIL** - Test assertion failed
**⊙ SKIP** - Test skipped (use `test.skip()`)
**◐ PENDING** - Test not yet implemented

## Debugging Failed Tests

### 1. Run Single Test
```bash
npm test -- --testNamePattern="should emit dashboard:start"
```

### 2. Print DOM State
Add to test:
```javascript
screen.debug();
```

### 3. Check Mock Calls
```javascript
console.log(mockSocket.emit.mock.calls);
console.log(mockSocket.on.mock.calls);
```

### 4. Increase Timeout
```javascript
test('test name', async () => {
  // test code
}, 15000); // 15 second timeout
```

## Coverage Report

### Generate Coverage
```bash
npm run test:coverage
```

### View Report
Opens in browser automatically or view at:
```
coverage/lcov-report/index.html
```

### Coverage Requirements (jest.config.js)
- Statements: 70%
- Branches: 70%
- Functions: 70%
- Lines: 70%

## Continuous Integration

### For GitHub Actions
Add `.github/workflows/test.yml`:
```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
```

## Environment Setup

### Required Node Version
- Node 14+ recommended
- Node 18+ preferred
- Check with: `node --version`

### Required npm Version
- npm 6+ 
- Check with: `npm --version`

### Verify Setup
```bash
npm test -- --listTests
```

Should list: `src/pages/Dashboard.test.js`

## Troubleshooting

### "Jest not found"
```bash
npm install jest --save-dev
npm install
```

### "Cannot find module @testing-library/react"
```bash
npm install @testing-library/react @testing-library/jest-dom --save-dev
```

### "Babel not configured"
```bash
npm install @babel/preset-env @babel/preset-react --save-dev
```

### Tests timeout
Increase in jest.config.js:
```javascript
testTimeout: 10000, // 10 seconds
```

### "window is not defined"
Already fixed in setupTests.js. If issue persists, verify:
```javascript
// In jest.config.js
testEnvironment: 'jsdom', // ← This is required
```

## Performance Tips

### Run Specific Test File
```bash
npm test src/pages/Dashboard.test.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="CSV"
```

### Skip Slow Tests
```javascript
test.skip('slow test', () => {
  // Test is skipped
});
```

### Run in Parallel
```bash
npm test -- --maxWorkers=4
```

## Integration with IDE

### VS Code
Install extensions:
- "Jest" by firsttris
- "Test Explorer UI" by Hbenl

Then:
1. Open test file
2. Click "Debug" above test
3. Tests run with breakpoints

### Running on Save
In `.vscode/settings.json`:
```json
{
  "runOnSave.commands": [
    {
      "match": ".*.test.js$",
      "command": "npm test -- ${file}"
    }
  ]
}
```

## Pre-commit Hooks (Optional)

### Setup Husky
```bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "npm test"
```

Now tests run before each git commit.

## Next Steps

### 1. Run Initial Tests
```bash
npm test
```

### 2. Review Coverage
```bash
npm run test:coverage
```

### 3. Add More Tests
Follow test patterns in Dashboard.test.js to add tests for:
- New features
- Bug fixes
- Edge cases

### 4. Integrate with CI/CD
Add test running to your deployment pipeline.

## Documentation References

- **TEST_SUITE_README.md** - Complete test documentation
- **Jest Docs** - https://jestjs.io/
- **React Testing Library** - https://testing-library.com/react
- **Dashboard.test.js** - Actual test implementations

## Quick Commands Reference

| Command | Purpose |
|---------|---------|
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm test -- --testNamePattern="keyword"` | Run specific tests |
| `npm test -- --maxWorkers=1` | Run tests sequentially |

## Support

For detailed information, see `TEST_SUITE_README.md` in the project root.

---

**Created:** November 2024  
**Test Count:** 80+ comprehensive tests  
**Coverage Threshold:** 70%  
**Framework:** Jest + React Testing Library
