/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

const mongoose = require('mongoose');

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsole = global.console;

beforeAll(() => {
  global.console = {
    ...originalConsole,
    // Uncomment to suppress logs during tests
    // log: jest.fn(),
    // info: jest.fn(),
    // warn: jest.fn(),
    // error: jest.fn(),
  };
});

afterAll(() => {
  global.console = originalConsole;
});

// Clean up database connections after each test
afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    // Clean up test collections
    const collections = ['users', 'studentdatas', 'pendingusers'];
    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.collection(collectionName).deleteMany({});
      } catch (error) {
        // Ignore collection not found errors
      }
    }
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});