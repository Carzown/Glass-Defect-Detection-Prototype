# Dashboard Component Test Suite

This document provides comprehensive information about the Jest test suite for the Dashboard component in the Glass Defect Detection application.

## Overview

The test suite includes **80+ test cases** covering all major functionality of the Dashboard component, including:
- Component rendering and initialization
- Detection control (start/stop)
- Pause/resume functionality
- Live frame streaming
- Defect list management
- CSV upload/download operations
- Modal interactions
- Logout functionality
- Error handling
- Accessibility

## Test Coverage

### Test Categories

#### 1. **Component Rendering** (7 tests)
- Verifies the component renders without errors
- Checks sidebar, video, and defects panel sections
- Validates placeholder text when not detecting
- Confirms empty state messaging

#### 2. **Detection Control** (5 tests)
- Start/stop detection button state changes
- Socket.IO events emission (`dashboard:start`, `dashboard:stop`)
- Client identification with `client:hello` event
- Socket disconnection on stop

#### 3. **Pause/Resume Detection** (4 tests)
- Pause button visibility during detection
- Socket.IO events for pause/resume
- Button state transitions
- Detection state management

#### 4. **Frame Streaming** (3 tests)
- Live frame display from `stream:frame` events
- "Waiting for stream..." placeholder
- Live indicator visibility

#### 5. **Defect List Management** (5 tests)
- Adding defects from socket events
- Time formatting (HH:MM:SS)
- Maximum 20-item limit enforcement
- Glass Defect label display

#### 6. **CSV Operations** (6 tests)
- CSV header generation
- Download button state management
- Download triggering
- CSV file upload with header detection
- Header row skipping
- Upload button disabling during detection

#### 7. **Clear Defects** (7 tests)
- Clear button state management
- Confirmation modal opening
- Defect clearing on confirmation
- Detection stopping when clearing
- Modal cancellation
- Item count display in confirmation

#### 8. **Image Modal** (6 tests)
- Modal opening on image link click
- Modal closing
- Next/previous image navigation
- Image URL display
- Navigation clamping at boundaries

#### 9. **Logout** (4 tests)
- Sign out user call
- Session storage clearing
- localStorage email management
- "Remember Me" functionality

#### 10. **Admin Role Check** (1 test)
- Admin user redirection

#### 11. **Helper Functions** (1 test)
- Time formatting validation

#### 12. **Socket Events** (3 tests)
- Connect event handler registration
- Disconnect event handler registration
- Device status event handler registration

#### 13. **Error Handling** (2 tests)
- Camera error display on connection failure
- Detection stop on error

#### 14. **Cleanup** (2 tests)
- Socket disconnection on unmount
- Supabase channel removal

#### 15. **Accessibility** (2 tests)
- Button ARIA labels and classes
- Image alt text

## Setup and Installation

### Prerequisites
- Node.js 14+ and npm
- React 18.2.0
- React Router 7.9.4

### Install Testing Dependencies

```bash
npm install
```

This installs all required dependencies including:
- `@testing-library/react` - React component testing utilities
- `@testing-library/jest-dom` - Custom Jest matchers
- `@testing-library/user-event` - User interaction simulation
- `jest` - Test runner
- `jest-environment-jsdom` - DOM environment for Jest
- `babel-jest` - Babel transformer for Jest
- `identity-obj-proxy` - CSS module mocking

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

Watch mode automatically re-runs tests when files change, useful during development.

### Generate Coverage Report
```bash
npm run test:coverage
```

This generates a coverage report showing:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

Current coverage thresholds: **70%** for all metrics

## Test File Structure

### Main Test File
```
src/pages/Dashboard.test.js          # 600+ lines of comprehensive tests
```

### Configuration Files
```
jest.config.js                        # Jest configuration
src/setupTests.js                     # Test environment setup
__mocks__/fileMock.js                # File import mocking
```

## Mocking Strategy

### Socket.IO Mocking
```javascript
mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn(),
};
io.mockReturnValue(mockSocket);
```

### Supabase Mocking
```javascript
supabaseModule.supabase = {
  from: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnValue({
      gte: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
  channel: jest.fn().mockReturnValue(mockChannel),
  removeChannel: jest.fn(),
};
```

### Component Mocking
- Sidebar component mocked for isolation
- CSS modules mocked via `identity-obj-proxy`

## Test Patterns

### 1. Event Simulation
```javascript
fireEvent.click(startButton);
await waitFor(() => {
  expect(mockSocket.emit).toHaveBeenCalledWith('dashboard:start', {});
});
```

### 2. Async Operations
```javascript
await waitFor(() => {
  expect(screen.getByText('Scratch')).toBeInTheDocument();
});
```

### 3. Socket Event Handlers
```javascript
const frameHandler = mockSocket.on.mock.calls.find(
  call => call[0] === 'stream:frame'
)?.[1];

if (frameHandler) {
  frameHandler({
    dataUrl: 'data:image/jpeg;base64,test',
    defects: [{ type: 'Scratch' }],
    time: new Date().toISOString(),
  });
}
```

### 4. Modal Interactions
```javascript
const imageLink = screen.getByText('Image');
fireEvent.click(imageLink);

await waitFor(() => {
  expect(screen.getByText(/Glass Defect:/)).toBeInTheDocument();
});
```

## Key Testing Scenarios

### Defect Detection Flow
1. Click "Start Detection"
2. Socket.IO connects and emits `client:hello`
3. Server sends `stream:frame` events
4. Defects are parsed and added to list
5. List updates dynamically

### CSV Upload Flow
1. Select CSV file with defects
2. Parse headers and data rows
3. Skip header row if present
4. Add defects to list
5. Clear file input for re-upload

### Clear Defects Flow
1. Click "Clear" button
2. Confirmation modal appears
3. User confirms or cancels
4. On confirm: stop detection, clear list, close modal

### Image Modal Flow
1. Click "Image" link in defect item
2. Modal opens with defect info
3. Navigate prev/next with button limits
4. Click close button or X
5. Modal closes

## Debugging Tips

### Enable Console Logs
Add `console.log()` to test cases:
```javascript
test('should emit dashboard:start', async () => {
  renderDashboard();
  const startButton = screen.getByRole('button', { name: 'Start Detection' });
  fireEvent.click(startButton);
  console.log('Mock calls:', mockSocket.emit.mock.calls);
  // assertions...
});
```

### Check DOM State
```javascript
screen.debug(); // Prints current DOM
```

### Inspect Mock Calls
```javascript
console.log(mockSocket.emit.mock.calls);
console.log(mockSocket.on.mock.calls);
```

### Run Single Test
```bash
npm test -- --testNamePattern="should emit dashboard:start"
```

## Common Issues and Solutions

### Issue: "Cannot find module '@testing-library/react'"
**Solution:** Run `npm install` to install all dependencies

### Issue: Tests timeout
**Solution:** Increase timeout in test:
```javascript
test('test name', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Issue: "window.matchMedia is not a function"
**Solution:** Already handled in `setupTests.js`, but verify it's being loaded

### Issue: Socket events not firing
**Solution:** Verify the event handler is registered:
```javascript
const handler = mockSocket.on.mock.calls.find(call => call[0] === 'stream:frame')?.[1];
if (!handler) console.log('Handler not found. Registered events:', 
  mockSocket.on.mock.calls.map(c => c[0]));
```

## Best Practices

### 1. Use Semantic Queries
```javascript
// ✅ Good - human readable
screen.getByRole('button', { name: 'Start Detection' });

// ❌ Avoid - implementation detail
screen.getByClassName('machine-detection-button');
```

### 2. Wait for Async Operations
```javascript
// ✅ Good
await waitFor(() => {
  expect(screen.getByText('Scratch')).toBeInTheDocument();
});

// ❌ Avoid - may fail due to timing
expect(screen.getByText('Scratch')).toBeInTheDocument();
```

### 3. Clean Up After Tests
The test suite uses `beforeEach` to reset mocks and state:
```javascript
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  jest.clearAllMocks();
});
```

### 4. Test User Interactions
```javascript
// Simulate real user actions
fireEvent.click(button);
fireEvent.change(input, { target: { value: 'text' } });
```

## Extending Tests

### Add New Test Cases
1. Identify the feature to test
2. Determine test category
3. Add test case following existing patterns
4. Use semantic queries and waitFor
5. Run tests to verify

### Example Template
```javascript
test('should [action] when [condition]', async () => {
  renderDashboard();
  
  // Setup
  const element = screen.getByRole('button', { name: 'Start Detection' });
  
  // Act
  fireEvent.click(element);
  
  // Assert
  await waitFor(() => {
    expect(mockSocket.emit).toHaveBeenCalledWith('dashboard:start', {});
  });
});
```

## Performance Tips

### Run Specific Tests
```bash
npm test -- src/pages/Dashboard.test.js
```

### Run Tests Matching Pattern
```bash
npm test -- --testNamePattern="Detection Control"
```

### Update Snapshots
```bash
npm test -- -u
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
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
      - uses: codecov/codecov-action@v2
```

## Coverage Goals

Current thresholds (in `jest.config.js`):
- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

To view coverage details:
```bash
npm run test:coverage
```

Opens `coverage/lcov-report/index.html` in browser for detailed report.

## Environment Variables

The tests mock environment variables. To test with specific values, add to test:
```javascript
process.env.REACT_APP_BACKEND_URL = 'http://localhost:5000';
process.env.REACT_APP_ENABLE_SUPABASE_REALTIME = 'false';
```

## Support

For issues or questions:
1. Check the "Common Issues" section above
2. Review test file comments for specific test logic
3. Consult React Testing Library documentation: https://testing-library.com/react
4. Check Jest documentation: https://jestjs.io/

## References

- [React Testing Library Docs](https://testing-library.com/react)
- [Jest Documentation](https://jestjs.io/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
