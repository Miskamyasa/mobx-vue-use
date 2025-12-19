import { describe, it, expect, vi } from 'vitest'
import { observable, runInAction, reaction } from 'mobx'
import { shallowRef, readonly } from 'vue'
import { setupTest, triggerCleanup, cleanupFns } from './test-utils'

// Import useReaction after test-utils to ensure Vue mock is set up
import { useReaction } from './mobx-vue-use'

setupTest()

describe('useReaction', () => {
  describe('Initialization', () => {
    it('returns initial value', () => {
      const store = observable({ count: 42 })
      const result = useReaction(() => store.count)

      expect(result.value).toBe(42)
    })

    it('returns ShallowRef', () => {
      const store = observable({ data: { nested: 'value' } })
      const result = useReaction(() => store.data)

      // ShallowRef means it's reactive but doesn't deeply watch
      expect(result.value).toStrictEqual(store.data)
      // The result should behave like a ref (has .value property accessible)
      expect(result.value).toBeDefined()
      expect(typeof result.value).toBe('object')
    })

    it('returns readonly ref', () => {
      const store = observable({ count: 10 })
      const result = useReaction(() => store.count)

      // Should show warning when trying to mutate (readonly behavior is enforced in development mode)
      const originalWarn = console.warn
      const warnSpy = vi.fn()
      console.warn = warnSpy

      try {
        // @ts-expect-error - Testing runtime readonly behavior
        result.value = 20
        // In production, readonly might not throw but show warning
        expect(warnSpy).toHaveBeenCalled()
      } finally {
        console.warn = originalWarn
      }
    })
  })

  describe('Reactivity', () => {
    it('updates on observable change', () => {
      const store = observable({ count: 0 })
      const result = useReaction(() => store.count)

      expect(result.value).toBe(0)

      runInAction(() => {
        store.count = 10
      })

      expect(result.value).toBe(10)
    })

    it('batches updates', () => {
      const store = observable({ count: 0 })

      // Track effect calls by creating a custom reaction that we can spy on
      const effectSpy = vi.fn()

      // Manually create what useReaction does, but with effect spying
      const reactive = shallowRef<number>(store.count)
      const dispose = reaction(
        () => store.count,
        (value: number) => {
          effectSpy(value) // Track each effect call
          reactive.value = value
        },
        { fireImmediately: false }
      )

      cleanupFns.push(dispose) // Register for cleanup like our mock does
      const result = readonly(reactive)

      expect(result.value).toBe(0)
      expect(effectSpy).toHaveBeenCalledTimes(0) // No effect calls yet

      runInAction(() => {
        store.count = 1
        store.count = 2
        store.count = 3
      })

      // Should only update once to final value due to MobX batching
      expect(result.value).toBe(3)
      expect(effectSpy).toHaveBeenCalledTimes(1) // Only one effect call
      expect(effectSpy).toHaveBeenCalledWith(3) // Called with final value

      // Clean up
      dispose()
    })

    it('handles primitive values', () => {
      const numberStore = observable({ value: 42 })
      const stringStore = observable({ value: 'hello' })
      const boolStore = observable({ value: true })

      const numberResult = useReaction(() => numberStore.value)
      const stringResult = useReaction(() => stringStore.value)
      const boolResult = useReaction(() => boolStore.value)

      expect(numberResult.value).toBe(42)
      expect(stringResult.value).toBe('hello')
      expect(boolResult.value).toBe(true)

      runInAction(() => {
        numberStore.value = 100
        stringStore.value = 'world'
        boolStore.value = false
      })

      expect(numberResult.value).toBe(100)
      expect(stringResult.value).toBe('world')
      expect(boolResult.value).toBe(false)
    })

    it('handles object values', () => {
      const store = observable({ data: { name: 'John', age: 30 } })
      const result = useReaction(() => store.data)

      expect(result.value).toEqual({ name: 'John', age: 30 })

      const newData = { name: 'Jane', age: 25 }
      runInAction(() => {
        store.data = newData
      })

      expect(result.value).toStrictEqual(newData)
    })

    it('handles array values', () => {
      const store = observable({ items: [1, 2, 3] })
      const result = useReaction(() => store.items)

      expect(result.value).toEqual([1, 2, 3])

      runInAction(() => {
        store.items = [4, 5, 6]
      })

      expect(result.value).toEqual([4, 5, 6])
    })
  })

  describe('Cleanup', () => {
    it('disposes reaction on unmount', () => {
      const store = observable({ count: 0 })
      const result = useReaction(() => store.count)

      expect(result.value).toBe(0)

      // Simulate component unmounting
      triggerCleanup()

      runInAction(() => {
        store.count = 10
      })

      // Should not update after disposal
      expect(result.value).toBe(0)
    })

    it('no updates after unmount', () => {
      const store = observable({ count: 5 })
      const result = useReaction(() => store.count)

      expect(result.value).toBe(5)

      runInAction(() => {
        store.count = 10
      })
      expect(result.value).toBe(10)

      // Dispose
      triggerCleanup()

      runInAction(() => {
        store.count = 20
      })

      // Should remain at last value before disposal
      expect(result.value).toBe(10)
    })
  })

  describe('Edge Cases', () => {
    it('handles null/undefined', () => {
      const store = observable({ value: null as string | null | undefined })
      const result = useReaction(() => store.value)

      expect(result.value).toBe(null)

      runInAction(() => {
        store.value = undefined
      })

      expect(result.value).toBe(undefined)

      runInAction(() => {
        store.value = 'not null'
      })

      expect(result.value).toBe('not null')
    })

    it('handles selector throwing', () => {
      const store = observable({ shouldThrow: false, count: 0 })

      expect(() => {
        useReaction(() => {
          if (store.shouldThrow) {
            throw new Error('Selector error')
          }
          return store.count
        })
      }).not.toThrow()
    })
  })

  describe('Lifecycle Integration', () => {
    it('properly integrates with Vue component lifecycle simulation', () => {
      const store = observable({ count: 0 })

      // Simulate a component setup phase
      let componentResult: any = null

      // Override the onUnmounted mock to track component lifecycle
      const originalCleanupFns = [...cleanupFns]

      // Clear existing cleanup functions for this test
      cleanupFns.length = 0

      // Simulate component mounting
      componentResult = useReaction(() => store.count)

      expect(componentResult.value).toBe(0)
      expect(cleanupFns).toHaveLength(1) // Should have registered one cleanup function

      // Test reactivity works
      runInAction(() => {
        store.count = 42
      })
      expect(componentResult.value).toBe(42)

      // Simulate component unmounting by calling the cleanup functions
      const cleanupFunction = cleanupFns[0]
      if (cleanupFunction) {
        cleanupFunction() // This is what Vue would call on unmount
      }

      // Verify cleanup happened - observable changes should not update the result
      const valueBeforeChange = componentResult.value
      runInAction(() => {
        store.count = 100
      })

      expect(componentResult.value).toBe(valueBeforeChange) // Should not update after cleanup

      // Restore original cleanup functions for other tests
      cleanupFns.length = 0
      cleanupFns.push(...originalCleanupFns)
    })
  })
})
