# Test Setup Verification Checklist

## Pre-Installation Verification

- [ ] Node.js installed (check with `node --version`, requires 14+)
- [ ] npm installed (check with `npm --version`, requires 6+)
- [ ] Git initialized in project (optional, for version control)
- [ ] react-glass directory accessible

## Installation Verification

Run after `npm install`:

### Package Installation
- [ ] jest installed: `npm list jest`
- [ ] @testing-library/react installed: `npm list @testing-library/react`
- [ ] @testing-library/jest-dom installed: `npm list @testing-library/jest-dom`
- [ ] babel-jest installed: `npm list babel-jest`
- [ ] @babel/preset-react installed: `npm list @babel/preset-react`

### Configuration Files
- [ ] jest.config.js exists in project root
- [ ] .babelrc exists in project root
- [ ] setupTests.js exists in src/ directory
- [ ] __mocks__/fileMock.js exists

### Test Files
- [ ] src/pages/Dashboard.test.js exists (600+ lines)
- [ ] Test file contains 80+ test cases

## NPM Scripts Verification

Run `npm run` to list available scripts:

- [ ] `test` script available
- [ ] `test:watch` script available
- [ ] `test:coverage` script available

### Test Each Script

#### Test 1: Basic Test Run
```bash
npm test
```
Expected output:
- [ ] Jest version shown
- [ ] Test file found
- [ ] Tests run (should be green ✓)
- [ ] Summary shows: "Tests: 80 passed, 80 total"
- [ ] No errors in console

#### Test 2: Watch Mode
```bash
npm run test:watch
```
Expected behavior:
- [ ] "Watch Mode" message appears
- [ ] Tests run automatically
- [ ] Can press 'o' to run only changed
- [ ] Can press 'p' to filter by filename
- [ ] Can press 'q' to quit
- [ ] Can press 'a' to run all

#### Test 3: Coverage Report
```bash
npm run test:coverage
```
Expected output:
- [ ] Coverage report generated
- [ ] Statements, Branches, Functions, Lines shown
- [ ] coverage/ directory created
- [ ] coverage/lcov-report/index.html can be opened

## Mocking Verification

### Socket.IO Mock
- [ ] io() returns mock socket
- [ ] socket.emit() is jest.fn()
- [ ] socket.on() is jest.fn()
- [ ] socket.disconnect() is jest.fn()

### Supabase Mock
- [ ] supabase.from() returns mock query
- [ ] supabase.channel() returns mock channel
- [ ] supabase.removeChannel() is jest.fn()
- [ ] signOutUser() is jest.fn()

### Component Mock
- [ ] Sidebar component mocked
- [ ] CSS modules mocked via identity-obj-proxy
- [ ] File imports mocked via fileMock.js

## Test Execution Verification

### Component Rendering Tests
Run individual test:
```bash
npm test -- --testNamePattern="should render Dashboard"
```
- [ ] Tests pass (green ✓)
- [ ] No errors or warnings
- [ ] Execution time shown (typically <100ms)

### Detection Control Tests
```bash
npm test -- --testNamePattern="Detection Control"
```
- [ ] All 5 tests pass
- [ ] Socket.emit mocks verified
- [ ] No timeout errors

### CSV Operations Tests
```bash
npm test -- --testNamePattern="CSV"
```
- [ ] All 6 tests pass
- [ ] File mocking works correctly
- [ ] Upload/download functionality verified

### Modal Tests
```bash
npm test -- --testNamePattern="Modal"
```
- [ ] Image modal tests pass
- [ ] Confirmation modal tests pass
- [ ] Modal interactions work correctly

### Socket Events Tests
```bash
npm test -- --testNamePattern="Socket Events"
```
- [ ] Event handlers registered
- [ ] 3 event types verified
- [ ] No unhandled promise rejections

## Environment Variables Verification

### .env Configuration
If using custom environment:
- [ ] REACT_APP_BACKEND_URL set (optional, defaults to http://localhost:5000)
- [ ] REACT_APP_SUPABASE_URL set (optional)
- [ ] REACT_APP_SUPABASE_ANON_KEY set (optional)
- [ ] REACT_APP_ENABLE_SUPABASE_REALTIME set (optional)

Check with:
```bash
npm test -- --testNamePattern="should emit client:hello"
```

## Performance Verification

### Test Execution Time
```bash
npm test -- --verbose
```
- [ ] Total execution time < 30 seconds
- [ ] Individual test time < 500ms
- [ ] No memory leaks in watch mode

### Watch Mode Performance
```bash
npm run test:watch
```
- [ ] Rerun after file change < 5 seconds
- [ ] Watch mode doesn't consume excessive CPU
- [ ] Memory stable over time

## Coverage Verification

```bash
npm run test:coverage
```

Check coverage/coverage-summary.json or HTML report:
- [ ] Statements: >= 70%
- [ ] Branches: >= 70%
- [ ] Functions: >= 70%
- [ ] Lines: >= 70%

If below threshold:
- [ ] Check coverage/lcov-report/index.html
- [ ] Identify untested code paths
- [ ] Add test cases for uncovered lines

## Documentation Verification

Files should exist and be complete:
- [ ] TEST_IMPLEMENTATION_SUMMARY.md exists (500+ lines)
- [ ] TEST_SUITE_README.md exists (400+ lines)
- [ ] TESTING_QUICK_START.md exists (300+ lines)
- [ ] All files contain clear examples
- [ ] All files have complete instructions

### Documentation Completeness
- [ ] Installation steps clear
- [ ] Running tests documented
- [ ] Test patterns explained
- [ ] Mocking strategy documented
- [ ] Debugging tips provided
- [ ] Troubleshooting section complete
- [ ] CI/CD integration examples included

## IDE Integration Verification (Optional)

### VS Code Verification
If using VS Code:
- [ ] Jest extension installed (optional but recommended)
- [ ] Test Explorer shows test cases
- [ ] Can click on test to run
- [ ] Can set breakpoints in tests
- [ ] Debug output visible

### Command Palette
Press Ctrl+Shift+P in VS Code:
- [ ] Can run "Jest: Run All Tests"
- [ ] Can run "Jest: Run Tests in File"
- [ ] Can run "Jest: Debug Test"

## Error Handling Verification

### Common Issues Resolved
- [ ] No "Cannot find module" errors
- [ ] No "jest not found" errors
- [ ] No "window is not defined" errors
- [ ] No "Cannot find @testing-library" errors
- [ ] No "Babel not configured" errors

Test each error scenario:
```bash
# Remove jest and reinstall
npm remove jest
npm install jest --save-dev

# Run tests again
npm test
```
- [ ] Tests still run correctly

## Cleanup Verification

### After Test Run
- [ ] No leftover temp files
- [ ] coverage/ directory created only when requested
- [ ] No hanging processes after npm test finishes
- [ ] Terminal responsive after test completion

Check with:
```bash
npm test
# Wait for completion
# Press Ctrl+C if needed
# Check process list: tasklist (Windows) or ps aux (Linux/Mac)
```
- [ ] No node processes still running
- [ ] No jest processes still running

## Final Verification Steps

### Complete Test Run
```bash
npm test
```
Final checklist:
- [ ] All tests pass (green ✓)
- [ ] Test count: 80+
- [ ] No skipped tests (unless intentional)
- [ ] No pending tests
- [ ] Execution time reasonable (< 30s)
- [ ] No console errors or warnings
- [ ] Summary shows success

### Coverage Report
```bash
npm run test:coverage
```
Final checklist:
- [ ] Coverage thresholds met
- [ ] HTML report generated
- [ ] Can open and view coverage details
- [ ] No uncovered critical paths

### Documentation Review
- [ ] Opened TESTING_QUICK_START.md
- [ ] Opened TEST_SUITE_README.md
- [ ] All instructions clear and accurate
- [ ] All commands work as documented

## Troubleshooting Checklist

If tests don't pass, check:

### Installation Issues
- [ ] Ran `npm install` successfully
- [ ] No npm errors in output
- [ ] node_modules/ directory exists
- [ ] package-lock.json generated

### Configuration Issues
- [ ] jest.config.js valid JSON
- [ ] .babelrc valid JSON
- [ ] setupTests.js has no syntax errors
- [ ] All config files in correct locations

### Test Issues
- [ ] Dashboard.test.js not modified
- [ ] No syntax errors in test file
- [ ] Mocks set up before each test
- [ ] Mocks cleared after each test

### Socket/Supabase Issues
- [ ] Mocks properly imported
- [ ] Mock functions reset in beforeEach
- [ ] Socket.IO library available
- [ ] Supabase library available

## Recommended IDE Extensions

### VS Code (Optional)
- [ ] "Jest" by firsttris
- [ ] "Test Explorer UI" by Hbenl
- [ ] "ES7+ React/Redux/React-Native snippets" (helpful)
- [ ] "Error Lens" (helpful)

Install from Extensions marketplace (Ctrl+Shift+X)

## Verification Summary

Complete this section when everything is verified:

- [ ] All installation checks passed
- [ ] All script checks passed
- [ ] All 80+ tests passing
- [ ] Coverage thresholds met
- [ ] Documentation complete
- [ ] No errors or warnings
- [ ] IDE integration working (if using)
- [ ] Ready for development

## Next Steps After Verification

1. ✅ Run `npm run test:watch` for development
2. ✅ Add new tests as features are developed
3. ✅ Monitor coverage with `npm run test:coverage`
4. ✅ Integrate with CI/CD pipeline
5. ✅ Share test suite with team

## Support Contacts

For issues:
1. Check TESTING_QUICK_START.md "Troubleshooting" section
2. Check TEST_SUITE_README.md "Common Issues" section
3. Review test code and inline comments
4. Check Jest documentation: https://jestjs.io/
5. Check React Testing Library: https://testing-library.com/react

## Sign-Off

- [ ] Date: _______________
- [ ] Verified by: _______________
- [ ] All checks passed: Yes / No
- [ ] Ready for use: Yes / No

---

**Verification Completed:** ______________  
**Notes:** ________________________________________________________________
