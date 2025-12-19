import { describe, it, expect, vi } from 'vitest'
import { observable, runInAction, computed, autorun } from 'mobx'
import { shallowRef, readonly } from 'vue'
import { setupTest, triggerCleanup, cleanupFns, waitFor, retry } from './test-utils'

// Import hooks after test-utils to ensure Vue mock is set up
import { useAutorun, useReaction } from './mobx-vue-use'

setupTest()

describe('useAutorun', () => {
  describe('Initialization', () => {
    it('returns initial value', () => {
      const store = observable({ count: 25 })
      const result = useAutorun(() => store.count)

      expect(result.value).toBe(25)
    })

    it('autorun runs immediately', () => {
      const store = observable({ count: 0 })
      const mockSelector = vi.fn(() => store.count)

      useAutorun(mockSelector)

      // Should be called twice: once for initial value, once for autorun
      expect(mockSelector).toHaveBeenCalledTimes(2)
    })
  })

  describe('Reactivity', () => {
    it('updates on any accessed observable', () => {
      const store = observable({ a: 1, b: 2 })
      const result = useAutorun(() => store.a + store.b)

      expect(result.value).toBe(3)

      runInAction(() => {
        store.a = 10
      })

      expect(result.value).toBe(12)

      runInAction(() => {
        store.b = 20
      })

      expect(result.value).toBe(30)
    })

    it('tracks nested observable access', () => {
      const store = observable({
        user: { profile: { name: 'John' } }
      })

      const result = useAutorun(() => store.user.profile.name)

      expect(result.value).toBe('John')

      runInAction(() => {
        store.user.profile.name = 'Jane'
      })

      expect(result.value).toBe('Jane')
    })

    it('re-tracks on each run', () => {
      const store = observable({ useA: true, a: 1, b: 2 })
      const result = useAutorun(() => store.useA ? store.a : store.b)

      expect(result.value).toBe(1)

      // Change b - should not update since selector is not accessing b
      runInAction(() => {
        store.b = 100
      })
      expect(result.value).toBe(1)

      // Change a - should update
      runInAction(() => {
        store.a = 50
      })
      expect(result.value).toBe(50)

      // Switch to b
      runInAction(() => {
        store.useA = false
      })
      expect(result.value).toBe(100)

      // Now changing a should not update, but changing b should
      runInAction(() => {
        store.a = 999
      })
      expect(result.value).toBe(100)

      runInAction(() => {
        store.b = 200
      })
      expect(result.value).toBe(200)
    })

    it('batches updates', () => {
      const store = observable({ count: 0 })

      // Track autorun effect calls
      const effectSpy = vi.fn()

      // Manually create what useAutorun does, but with effect spying
      const reactive = shallowRef<number>(store.count)
      const dispose = autorun(() => {
        effectSpy(store.count) // Track each autorun call
        reactive.value = store.count
      })

      cleanupFns.push(dispose)
      const result = readonly(reactive)

      expect(result.value).toBe(0)
      expect(effectSpy).toHaveBeenCalledTimes(1) // Initial autorun call

      runInAction(() => {
        store.count = 1
        store.count = 2
        store.count = 3
      })

      // Should only update once to final value due to MobX batching
      expect(result.value).toBe(3)
      expect(effectSpy).toHaveBeenCalledTimes(2) // Initial + one batched update
      expect(effectSpy).toHaveBeenLastCalledWith(3) // Called with final value

      // Clean up
      dispose()
    })
  })

  describe('Difference from useReaction', () => {
    it('tracks all accessed observables', () => {
      const store = observable({ x: 1, y: 2, z: 3 })

      const autorunResult = useAutorun(() => store.x + store.y + store.z)
      const reactionResult = useReaction(() => store.x + store.y + store.z)

      expect(autorunResult.value).toBe(6)
      expect(reactionResult.value).toBe(6)

      // Both should update when any observed value changes
      runInAction(() => {
        store.z = 10
      })

      expect(autorunResult.value).toBe(13)
      expect(reactionResult.value).toBe(13)
    })

    it('no explicit dependency declaration', () => {
      const store = observable({ count: 5 })

      // useAutorun automatically tracks all accessed observables
      const result = useAutorun(() => store.count * 2)

      expect(result.value).toBe(10)

      runInAction(() => {
        store.count = 15
      })

      expect(result.value).toBe(30)
    })
  })

  describe('Cleanup', () => {
    it('disposes autorun on unmount', () => {
      const store = observable({ count: 0 })
      const result = useAutorun(() => store.count)

      expect(result.value).toBe(0)

      triggerCleanup()

      runInAction(() => {
        store.count = 10
      })

      expect(result.value).toBe(0) // Should not update after disposal
    })

    it('no updates after unmount', () => {
      const store = observable({ count: 7 })
      const result = useAutorun(() => store.count)

      expect(result.value).toBe(7)

      runInAction(() => {
        store.count = 14
      })
      expect(result.value).toBe(14)

      triggerCleanup()

      runInAction(() => {
        store.count = 21
      })

      expect(result.value).toBe(14) // Should remain at last value
    })
  })

  describe('Edge Cases', () => {
    it('selector with conditional observable access', () => {
      const store = observable({
        showA: true,
        a: { value: 10 },
        b: { value: 20 }
      })

      const result = useAutorun(() => {
        return store.showA ? store.a.value : store.b.value
      })

      expect(result.value).toBe(10)

      // Change b.value - should not trigger update since we're looking at a
      runInAction(() => {
        store.b.value = 100
      })
      expect(result.value).toBe(10)

      // Switch to b
      runInAction(() => {
        store.showA = false
      })
      expect(result.value).toBe(100)

      // Now changes to a should not trigger, but b should
      runInAction(() => {
        store.a.value = 999
      })
      expect(result.value).toBe(100)

      runInAction(() => {
        store.b.value = 200
      })
      expect(result.value).toBe(200)
    })

    it('handles computed values', () => {
      const store = observable({
        firstName: 'John',
        lastName: 'Doe'
      })

      // Create an actual MobX computed value
      const fullName = computed(() => `${store.firstName} ${store.lastName}`)

      // Use useAutorun to track the computed value
      const result = useAutorun(() => fullName.get())

      expect(result.value).toBe('John Doe')

      runInAction(() => {
        store.firstName = 'Jane'
      })

      expect(result.value).toBe('Jane Doe')

      runInAction(() => {
        store.lastName = 'Smith'
      })

      expect(result.value).toBe('Jane Smith')

      // Verify that the computed is only calculated when accessed
      // by checking that useAutorun properly tracks the computed dependency
      const computedCallCount = vi.fn()
      const trackedComputed = computed(() => {
        computedCallCount()
        return `${store.firstName} ${store.lastName}`.toUpperCase()
      })

      const result2 = useAutorun(() => trackedComputed.get())
      expect(computedCallCount).toHaveBeenCalledTimes(2) // Once for initial value, once for autorun

      runInAction(() => {
        store.firstName = 'Bob'
      })

      expect(result2.value).toBe('BOB SMITH')
      expect(computedCallCount).toHaveBeenCalledTimes(3) // Called again due to change
    })
  })

  describe('Integration Tests', () => {
    it('multiple composables same observable', () => {
      const store = observable({ count: 0 })

      const reaction1 = useReaction(() => store.count)
      const autorun1 = useAutorun(() => store.count + 100)

      expect(reaction1.value).toBe(0)
      expect(autorun1.value).toBe(100)

      runInAction(() => {
        store.count = 5
      })

      expect(reaction1.value).toBe(5)
      expect(autorun1.value).toBe(105)
    })

    it('composables with different observables', () => {
      const store1 = observable({ a: 1 })
      const store2 = observable({ b: 2 })

      const result1 = useAutorun(() => store1.a)
      const result2 = useAutorun(() => store2.b)

      expect(result1.value).toBe(1)
      expect(result2.value).toBe(2)

      runInAction(() => {
        store1.a = 10
      })

      expect(result1.value).toBe(10)
      expect(result2.value).toBe(2) // Should not change

      runInAction(() => {
        store2.b = 20
      })

      expect(result1.value).toBe(10) // Should not change
      expect(result2.value).toBe(20)
    })

    it('works with Vue computed', { timeout: 2000 }, async () => {
      const { computed } = await import('vue')
      const store = observable({ count: 10 })

      const autorunResult = useAutorun(() => store.count)
      const computedResult = computed(() => autorunResult.value * 3)

      expect(computedResult.value).toBe(30)

      runInAction(() => {
        store.count = 20
      })

      // Use retry for potentially flaky computed updates
      await retry(async () => {
        expect(autorunResult.value).toBe(20)
        expect(computedResult.value).toBe(60)
      })
    })

    it('works with Vue watch', { timeout: 2000 }, async () => {
      const { watch, nextTick } = await import('vue')
      const store = observable({ count: 5 })

      const autorunResult = useAutorun(() => store.count)
      const watchedValues: number[] = []

      watch(autorunResult, (newValue) => {
        watchedValues.push(newValue)
      })

      runInAction(() => {
        store.count = 10
      })

      // Wait for Vue to process the watch callback with retry
      await retry(async () => {
        await nextTick()
        expect(watchedValues).toContain(10)
      })

      runInAction(() => {
        store.count = 15
      })

      await retry(async () => {
        await nextTick()
        await waitFor(10) // Additional wait for watch processing
        expect(watchedValues).toEqual([10, 15])
      })
    })

    it('nested component unmounting', () => {
      const store = observable({ count: 0 })

      // Simulate multiple components using the same store
      const originalCleanupFns = [...cleanupFns]
      cleanupFns.length = 0

      // Parent component
      const parent = useAutorun(() => store.count)

      // Child component 1
      const child1 = useAutorun(() => store.count * 2)

      // Child component 2 (nested deeper)
      const child2 = useAutorun(() => store.count + 10)

      expect(cleanupFns).toHaveLength(3) // Three cleanup functions registered

      runInAction(() => {
        store.count = 5
      })

      expect(parent.value).toBe(5)
      expect(child1.value).toBe(10)
      expect(child2.value).toBe(15)

      // Simulate child1 unmounting first (partial cleanup)
      const child1Cleanup = cleanupFns[1]
      if (child1Cleanup) {
        child1Cleanup()
        cleanupFns.splice(1, 1) // Remove from active cleanup list
      }

      runInAction(() => {
        store.count = 8
      })

      // Parent and child2 should still update, child1 should not
      expect(parent.value).toBe(8)
      expect(child1.value).toBe(10) // Remains at old value
      expect(child2.value).toBe(18)

      // Simulate all remaining components unmounting
      cleanupFns.forEach(cleanup => cleanup())
      cleanupFns.length = 0

      runInAction(() => {
        store.count = 100
      })

      // All should remain at previous values after cleanup
      expect(parent.value).toBe(8)
      expect(child1.value).toBe(10)
      expect(child2.value).toBe(18)

      // Restore original cleanup functions for other tests
      cleanupFns.push(...originalCleanupFns)
    })
  })
})
