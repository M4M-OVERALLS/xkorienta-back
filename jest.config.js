const nextJest = require('next/jest')

const createJestConfig = nextJest({
    // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
    dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],

    // Test environment
    testEnvironment: 'node',

    // Module name mapper for absolute imports
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
    },

    // Test patterns
    testMatch: [
        '**/__tests__/**/*.spec.ts',
        '**/__tests__/**/*.test.ts',
    ],

    // Coverage
    collectCoverageFrom: [
        'src/**/*.{js,jsx,ts,tsx}',
        '!src/**/*.d.ts',
        '!src/**/*.stories.{js,jsx,ts,tsx}',
        '!src/**/__tests__/**',
    ],

    coverageThresholds: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70,
        },
    },

    // Transform
    transform: {
        '^.+\\.(ts|tsx)$': ['@swc/jest', {
            jsc: {
                transform: {
                    react: {
                        runtime: 'automatic',
                    },
                },
            },
        }],
    },

    // Module file extensions
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

    // Ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/.next/',
    ],

    // Timeout
    testTimeout: 30000,
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)
