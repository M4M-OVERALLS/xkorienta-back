/**
 * Jest Setup File
 *
 * Agent 3 - Expert TDD
 * Configuration globale pour tous les tests
 */

import { TextDecoder, TextEncoder } from "util";

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock environment variables
process.env.TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "mongodb://localhost:27017/Xkorienta-test";
process.env.TEST_API_URL = process.env.TEST_API_URL || "http://localhost:3001";
// NODE_ENV est read-only dans les types TS stricts — on utilise defineProperty
Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  writable: true,
  configurable: true,
});

// Extend Jest matchers (optionnel)
// import '@testing-library/jest-dom';

// Mock console methods for cleaner test output (optionnel)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// };

// Setup timeout for all tests
jest.setTimeout(10000); // 10 seconds

// Mock NextAuth (si nécessaire)
jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}));

// Mock Next.js router (si nécessaire)
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn(),
  useSearchParams: jest.fn(),
}));

console.log("✅ Jest setup complete");
