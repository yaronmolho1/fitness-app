import '@testing-library/jest-dom/vitest'

// Radix UI components (e.g. Checkbox) use ResizeObserver, which jsdom lacks
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// jsdom lacks matchMedia — stub it for responsive hooks
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-only'
process.env.AUTH_USERNAME = 'testuser'
process.env.AUTH_PASSWORD_HASH = '$2b$10$placeholder'
process.env.JWT_EXPIRES_IN = '7d'
process.env.DATABASE_URL = ':memory:'
