import { describe, it, expect, vi } from 'vitest'
import { observable, runInAction, reaction } from 'mobx'
import { shallowRef, readonly } from 'vue'
import { setupTest, triggerCleanup, cleanupFns } from './test-utils'

// Import useTransform after test-utils to ensure Vue mock is set up
import { useTransform } from '.'

setupTest()

describe('useTransform', () => {
  describe('Initialization', () => {
    it('returns transformed initial value', () => {
      const store = observable({ count: 10 })
      const result = useTransform(() => store.count, (value) => value * 2)

      expect(result.value).toBe(20)
    })

    it('transform receives correct value', () => {
      const store = observable({ text: 'hello' })
      const mockTransform = vi.fn((value: string) => value.toUpperCase())

      useTransform(() => store.text, mockTransform)

      expect(mockTransform).toHaveBeenCalledWith('hello')
      expect(mockTransform).toHaveBeenCalledTimes(1)
    })
  })

  describe('Reactivity', () => {
    it('updates with transformed value', () => {
      const store = observable({ count: 5 })
      const result = useTransform(() => store.count, (value) => value * 3)

      expect(result.value).toBe(15)

      runInAction(() => {
        store.count = 10
      })

      expect(result.value).toBe(30)
    })

    it('transform called on each change', () => {
      const store = observable({ count: 1 })
      const mockTransform = vi.fn((value: number) => value + 100)

      const result = useTransform(() => store.count, mockTransform)

      expect(mockTransform).toHaveBeenCalledTimes(1) // Initial call

      runInAction(() => {
        store.count = 2
      })

      expect(mockTransform).toHaveBeenCalledTimes(2) // Called again on change
      expect(mockTransform).toHaveBeenLastCalledWith(2)
      expect(result.value).toBe(102)
    })

    it('handles identity transform', () => {
      const store = observable({ count: 42 })
      const result = useTransform(() => store.count, (v) => v)

      expect(result.value).toBe(42)

      runInAction(() => {
        store.count = 100
      })

      expect(result.value).toBe(100)
    })

    it('batches updates', () => {
      const store = observable({ count: 0 })

      // Track transform calls and effect calls
      const transformSpy = vi.fn((value: number) => value * 2)
      const effectSpy = vi.fn()

      // Manually create what useTransform does, but with effect spying
      const reactive = shallowRef<number>(transformSpy(store.count))
      const dispose = reaction(
        () => store.count,
        (value: number) => {
          effectSpy(value) // Track each effect call
          reactive.value = transformSpy(value)
        },
        { fireImmediately: false }
      )

      cleanupFns.push(dispose)
      const result = readonly(reactive)

      expect(result.value).toBe(0) // Initial: 0 * 2 = 0
      expect(transformSpy).toHaveBeenCalledTimes(1) // Initial call
      expect(effectSpy).toHaveBeenCalledTimes(0) // No effect calls yet

      runInAction(() => {
        store.count = 1
        store.count = 2
        store.count = 3
      })

      // Should only update once to final value due to MobX batching
      expect(result.value).toBe(6) // Final: 3 * 2 = 6
      expect(effectSpy).toHaveBeenCalledTimes(1) // Only one effect call
      expect(effectSpy).toHaveBeenCalledWith(3) // Called with final selector value
      expect(transformSpy).toHaveBeenCalledTimes(2) // Initial + one reactive call
      expect(transformSpy).toHaveBeenLastCalledWith(3) // Transform called with final value

      // Clean up
      dispose()
    })
  })

  describe('Transform Function', () => {
    it('supports type transformation', () => {
      const store = observable({ count: 123 })
      const result = useTransform(() => store.count, (value: number): string => value.toString())

      expect(result.value).toBe('123')
      expect(typeof result.value).toBe('string')

      runInAction(() => {
        store.count = 456
      })

      expect(result.value).toBe('456')
    })

    it('handles complex transforms', () => {
      const store = observable({ items: [1, 2, 3, 4, 5] })
      const result = useTransform(
        () => store.items,
        (items) => items.filter(n => n % 2 === 0).map(n => n * 10)
      )

      expect(result.value).toEqual([20, 40])

      runInAction(() => {
        store.items = [2, 4, 6, 8]
      })

      expect(result.value).toEqual([20, 40, 60, 80])
    })

    it('transform receives fresh value', () => {
      const store = observable({ count: 0 })
      const receivedValues: number[] = []

      useTransform(() => store.count, (value) => {
        receivedValues.push(value)
        return value
      })

      runInAction(() => { store.count = 1 })
      runInAction(() => { store.count = 2 })

      expect(receivedValues).toEqual([0, 1, 2])
    })
  })

  describe('Cleanup', () => {
    it('disposes reaction on unmount', () => {
      const store = observable({ count: 0 })
      const result = useTransform(() => store.count, (v) => v * 2)

      expect(result.value).toBe(0)

      triggerCleanup()

      runInAction(() => {
        store.count = 10
      })

      expect(result.value).toBe(0) // Should not update after disposal
    })

    it('transform not called after unmount', () => {
      const store = observable({ count: 1 })
      const mockTransform = vi.fn((v: number) => v * 2)

      useTransform(() => store.count, mockTransform)

      expect(mockTransform).toHaveBeenCalledTimes(1)

      triggerCleanup()

      runInAction(() => {
        store.count = 2
      })

      expect(mockTransform).toHaveBeenCalledTimes(1) // Should not be called again
    })
  })

  describe('Edge Cases', () => {
    it('transform returning null/undefined', () => {
      const store = observable({ text: 'hello' })
      const result = useTransform(() => store.text, () => null)

      expect(result.value).toBe(null)

      const result2 = useTransform(() => store.text, () => undefined)
      expect(result2.value).toBe(undefined)
    })

    it('transform throwing error', () => {
      const store = observable({ count: 0 })

      // Test that error during initial transform throws immediately
      expect(() => {
        useTransform(() => store.count, () => {
          throw new Error('Transform error')
        })
      }).toThrow('Transform error')

      // Test error handling during reactive updates
      // Since MobX reactions catch and log errors rather than throwing,
      // we need to test differently for reactive updates
      const store2 = observable({ value: 1 })
      const errorSpy = vi.fn()
      const originalConsoleError = console.error
      console.error = errorSpy

      const problematicTransform = vi.fn((value: number) => {
        if (value > 5) {
          throw new Error('Value too large')
        }
        return value * 2
      })

      try {
        const result = useTransform(() => store2.value, problematicTransform)
        expect(result.value).toBe(2) // Initial value works

        runInAction(() => {
          store2.value = 3
        })
        expect(result.value).toBe(6) // Transform works for valid values

        // This will trigger an error in the reaction, which MobX catches and logs
        runInAction(() => {
          store2.value = 10
        })

        // The transform should have been called with the problematic value
        expect(problematicTransform).toHaveBeenLastCalledWith(10)

        // MobX should have logged an error about the uncaught exception
        // (The value should remain at the last successful transform result)
        expect(result.value).toBe(6) // Should remain at last valid value

      } finally {
        console.error = originalConsoleError
      }
    })
  })
})
