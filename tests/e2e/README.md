# Google OAuth Authentication Tests

This directory contains comprehensive end-to-end tests for Google OAuth authentication flows in the Budget Buckets application.

## Overview

The tests are designed to verify:
- Google sign-in button functionality and UI behavior
- Authentication flow initiation and network requests
- Error handling for various OAuth failure scenarios
- User experience for both new and existing users
- Content Security Policy compliance
- Accessibility features
- Cross-browser compatibility

## Test Structure

```
tests/e2e/
├── google-auth.spec.js          # Core Google OAuth UI and behavior tests
├── google-auth-flows.spec.js    # Complete authentication flow tests
├── helpers/
│   └── auth-helpers.js          # Test utilities and mocking helpers
└── README.md                    # This documentation
```

## Test Categories

### 1. Core Authentication Tests (`google-auth.spec.js`)

- **UI Tests**: Button visibility, styling, and accessibility
- **Network Tests**: Firebase auth requests and API calls
- **Error Handling**: Popup blocking, network failures, user cancellation
- **CSP Compliance**: Content Security Policy validation
- **Integration Tests**: Firebase initialization and configuration

### 2. Complete Flow Tests (`google-auth-flows.spec.js`)

- **Existing User Login**: Full authentication flow for returning users
- **New User Registration**: Account creation and plan selection flow
- **Error Recovery**: Network failure recovery and retry logic
- **Security Validation**: CSP compliance and configuration security
- **Accessibility Testing**: Keyboard navigation and ARIA attributes

## Test Helpers

The `helpers/auth-helpers.js` file provides utilities for mocking Google OAuth flows:

### GoogleAuthTestHelper
- `mockSuccessfulGoogleAuth()` - Simulate successful authentication
- `mockPopupBlocked()` - Test popup blocker scenarios
- `mockPopupClosedByUser()` - Test user cancellation
- `mockNetworkFailure()` - Test network error handling
- `mockExistingUserAuth()` - Simulate returning user login
- `mockNewUserAuth()` - Simulate new user registration

### FirebaseTestHelper
- `verifyFirebaseInit()` - Check Firebase initialization
- `mockFirestoreDoc()` - Mock Firestore document operations
- `monitorAuthStateChanges()` - Track authentication state changes

### TestEnvironmentHelper
- `setupTestEnvironment()` - Configure test environment
- `waitForPageReady()` - Wait for full page initialization
- `isEmulatorEnvironment()` - Detect Firebase emulator usage

## Running the Tests

### Prerequisites

1. Ensure the server is running on port 8081:
   ```bash
   PORT=8081 npm run dev
   ```

2. Install Playwright browsers (if not already installed):
   ```bash
   npx playwright install
   ```

### Test Commands

```bash
# Run all Google OAuth tests
npm run test:e2e

# Run with browser UI for debugging
npm run test:e2e:ui

# Run in headed mode to see browser
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/google-auth.spec.js

# Run specific test suite
npx playwright test tests/e2e/google-auth.spec.js --grep "Google OAuth Authentication"

# Run tests in specific browser
npx playwright test --project=chromium tests/e2e/google-auth.spec.js
```

### Debugging Tests

```bash
# Run in debug mode
npx playwright test --debug tests/e2e/google-auth.spec.js

# Generate test report
npx playwright show-report

# Record trace for failed tests
npx playwright test --trace on tests/e2e/google-auth.spec.js
```

## Test Environment

### Local Development
- Tests run against `http://localhost:8081`
- Uses Firebase emulator if configured
- Mocks OAuth flows to avoid external dependencies

### CI/CD Environment
- Tests use headless browsers
- Retries failed tests automatically
- Generates screenshots and videos on failure

## Mocking Strategy

Since real Google OAuth requires external authentication, these tests use sophisticated mocking:

1. **JavaScript Mocking**: Override Firebase Auth methods in the browser context
2. **Network Interception**: Monitor and modify network requests using Playwright
3. **State Simulation**: Mock authentication state changes and user data
4. **Error Injection**: Simulate various failure scenarios

## Example Usage

```javascript
import { GoogleAuthTestHelper } from './helpers/auth-helpers.js';

test('successful Google login', async ({ page }) => {
  // Setup mock authentication
  await GoogleAuthTestHelper.mockExistingUserAuth(page, {
    email: 'user@gmail.com',
    plan: 'Plus'
  });
  
  // Monitor auth messages
  const authMessages = GoogleAuthTestHelper.monitorAuthMessages(page);
  
  // Perform authentication
  await page.locator('#googleSignInBtn').click();
  
  // Verify success
  expect(authMessages.some(msg => 
    msg.text.includes('Google sign-in successful')
  )).toBe(true);
});
```

## Test Data

Tests use realistic but safe mock data:
- Email addresses: `testuser@gmail.com`, `newuser@gmail.com`
- User IDs: Generated with timestamp to avoid conflicts
- Names: Generic test names like "Test User", "John Doe"
- Photos: Mock Google profile photo URLs

## Limitations

1. **Real OAuth**: Tests cannot verify actual Google OAuth server responses
2. **Popup Windows**: Real popup behavior may differ from mocked scenarios  
3. **Network Timing**: Actual network latency is not simulated
4. **Browser Differences**: Some OAuth behaviors are browser-specific

## Troubleshooting

### Common Issues

1. **Firebase Not Initialized**
   ```
   Error: window.firebase is undefined
   ```
   Solution: Ensure `waitForPageReady()` is called before test actions

2. **CSP Violations**
   ```
   Content Security Policy directive violated
   ```
   Solution: Check that server CSP includes all required Google domains

3. **Button Not Found**
   ```
   Element #googleSignInBtn not visible
   ```
   Solution: Verify login page loads correctly and button exists

4. **Mock Not Applied**
   ```
   Real OAuth popup opens instead of mock
   ```
   Solution: Ensure `addInitScript()` is called before navigating to page

### Debug Tips

1. Use `page.pause()` to inspect page state during test
2. Add `console.log()` statements in `addInitScript()` callbacks
3. Monitor network requests with `page.on('request')`
4. Check browser console messages with `page.on('console')`

## Contributing

When adding new Google OAuth tests:

1. Use the existing helper utilities in `auth-helpers.js`
2. Follow the naming convention: `test('should do something')`
3. Include both positive and negative test cases
4. Add appropriate timeouts for async operations
5. Document any new mock scenarios

## Security Considerations

- Tests use mock data only - no real user credentials
- OAuth flows are simulated to prevent external API calls
- Test data is isolated and doesn't persist
- CSP violations are monitored to ensure security compliance

## Future Improvements

1. **Real OAuth Testing**: Integration with Firebase Auth emulator
2. **Performance Testing**: Measure auth flow performance
3. **Visual Regression**: Screenshot comparison for auth UI
4. **Mobile Testing**: Touch interactions and mobile OAuth flows