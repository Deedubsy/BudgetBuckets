// Jest test setup file
// Mock global objects and Firebase for unit testing

// Mock Firebase globals for tests that import Firebase modules
global.firebase = {
  app: jest.fn(() => ({ name: 'test-app' })),
  firestore: jest.fn(),
  auth: jest.fn()
};

// Mock Firestore methods
const mockFirestore = {
  collection: jest.fn(() => mockFirestore),
  doc: jest.fn(() => mockFirestore),
  get: jest.fn(),
  set: jest.fn(),
  add: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  where: jest.fn(() => mockFirestore),
  orderBy: jest.fn(() => mockFirestore),
  limit: jest.fn(() => mockFirestore)
};

global.firebase.firestore.mockReturnValue(mockFirestore);

// Mock console methods to reduce test noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock performance for performance tests
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn()
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Suppress JSDOM navigation warnings
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Not implemented: navigation')) return;
  originalError(...args);
};

// Suppress DOM-related warnings in tests
global.requestAnimationFrame = jest.fn(cb => setTimeout(cb, 0));
global.cancelAnimationFrame = jest.fn();