import path from 'path'

export const E2E_DB_PATH = path.resolve(__dirname, '../../.e2e-test.db')

export const E2E_AUTH = {
  username: 'testuser',
  password: 'testpass123',
  passwordHash: '$2b$10$z0rEew3QLGyjSs0gSDRqouN4FBccLYDU8slZn96SMY4bMKgJXbBz2',
  jwtSecret: 'test-secret-key-for-e2e-testing-only',
}
