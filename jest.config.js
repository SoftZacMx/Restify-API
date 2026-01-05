module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@middy|@aws-sdk)/)',
  ],
  moduleNameMapper: {
    '^@middy/core$': '<rootDir>/tests/mocks/@middy/core.js',
    '^@middy/http-json-body-parser$': '<rootDir>/tests/mocks/@middy/http-json-body-parser.js',
    '^@middy/http-error-handler$': '<rootDir>/tests/mocks/@middy/http-error-handler.js',
    '^@middy/http-event-normalizer$': '<rootDir>/tests/mocks/@middy/http-event-normalizer.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@core/(.*)$': '<rootDir>/src/core/$1',
    '^@handlers/(.*)$': '<rootDir>/src/handlers/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};

