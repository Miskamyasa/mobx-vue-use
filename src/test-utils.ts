import { beforeEach, afterEach, vi } from 'vitest'

// Mock Vue's onUnmounted to capture cleanup functions
export const cleanupFns: (() => void)[] = []

// Centralized Vue mock - import this file to get the mock setup
vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: (fn: () => void) => cleanupFns.push(fn)
  }
})

// Helper to trigger cleanup (simulate component unmounting)
export const triggerCleanup = () => {
  cleanupFns.forEach(fn => fn())
  cleanupFns.length = 0
}

// Wait helper for async tests
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Retry helper for flaky async operations
export const retry = async (fn: () => Promise<void> | void, attempts = 3, delay = 50): Promise<void> => {
  for (let i = 0; i < attempts; i++) {
    try {
      await fn()
      return
    } catch (error) {
      if (i === attempts - 1) throw error
      await waitFor(delay)
    }
  }
}

// Setup function to be called in test files
export const setupTest = () => {
  beforeEach(() => {
    cleanupFns.length = 0
  })
  
  afterEach(() => {
    // Automatically trigger cleanup after each test to dispose reactions/autoruns
    triggerCleanup()
  })
}