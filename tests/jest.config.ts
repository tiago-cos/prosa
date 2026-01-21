/** @type {import('ts-jest').JestConfigWithTsJest} */
import type { Config } from 'jest';
import dotenv from 'dotenv';

dotenv.config({ path: 'config/.env.local' });
dotenv.config({ path: 'config/.env' });

const config: Config = {
  preset: 'ts-jest',
  resolver: 'ts-jest-resolver',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  globalSetup: './jest.setup.ts',
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true }]
  }
};

export default config;
