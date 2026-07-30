import { vi } from 'vitest';

// Mock environment variables for tests
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/toby_bookmark_test';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.JWT_ACCESS_EXPIRY_SECONDS = '900';
process.env.JWT_REFRESH_EXPIRY_SECONDS = '604800';
process.env.PORT = '3099';
process.env.CORS_ORIGIN = '*';
