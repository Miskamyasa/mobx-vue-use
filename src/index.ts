import { onUnmounted, readonly, shallowRef, type DeepReadonly, type ShallowRef } from 'vue'
import { reaction, autorun } from 'mobx'

/**
 * Creates a readonly Vue ref that reactively tracks a MobX observable value.
 * Uses MobX's `reaction` to detect changes in the selector and updates the ref accordingly.
 * Automatically disposes the reaction when the component is unmounted.
 *
 * @template T The type of the tracked value
 *
 * @param selector A function that returns the current value from MobX observables
 * @returns A readonly shallow ref containing the tracked value
 *
 * @example
 * // Track a single observable property
 * const userName = useReaction(() => userStore.name)
 *
 * @example
 * // Track a derived value from observables
 * const isLoggedIn = useReaction(() => userStore.currentUser !== null)
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useReaction } from '@/composables/mobx'
 * import { userStore } from '@/stores/user'
 *
 * const userName = useReaction(() => userStore.name)
 * const isAdmin = useReaction(() => userStore.role === 'admin')
 * </script>
 *
 * <template>
 *   <div>
 *     <p>Welcome, {{ userName }}</p>
 *     <AdminPanel v-if="isAdmin" />
 *   </div>
 * </template>
 * ```
 */
export function useReaction<T>(selector: () => T): DeepReadonly<ShallowRef<T>> {
  const reactive = shallowRef<T>(selector())

  const dispose = reaction(
    selector,
    (value) => {
      reactive.value = value
    },
    { fireImmediately: false }
  )

  onUnmounted(dispose)

  return readonly(reactive)
}

/**
 * Creates a readonly Vue ref that reactively tracks a MobX observable value and applies a transformation.
 * Similar to {@link useReaction}, but allows transforming the observed value before storing it.
 * Automatically disposes the reaction when the component is unmounted.
 *
 * @template T The type of the source value from the selector
 * @template E The type of the transformed value
 *
 * @param selector A function that returns the current value from MobX observables
 * @param transform A function that transforms the selected value into the desired format
 * @returns A readonly shallow ref containing the transformed value
 *
 * @example
 * // Transform a list into its length
 * const itemCount = useTransform(() => store.items, (items) => items.length)
 *
 * @example
 * // Map an object to a specific shape
 * const userDisplay = useTransform(
 *   () => store.currentUser,
 *   (user) => ({ label: user.name, id: user.id })
 * )
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useTransform } from '@/composables/mobx'
 * import { cartStore } from '@/stores/cart'
 *
 * const itemCount = useTransform(() => cartStore.items, (items) => items.length)
 * const formattedTotal = useTransform(
 *   () => cartStore.total,
 *   (total) => `$${total.toFixed(2)}`
 * )
 * </script>
 *
 * <template>
 *   <div class="cart-summary">
 *     <span>{{ itemCount }} items</span>
 *     <span>Total: {{ formattedTotal }}</span>
 *   </div>
 * </template>
 * ```
 */
export function useTransform<T, E>(selector: () => T, transform: (value: T) => E): DeepReadonly<ShallowRef<E>> {
  const reactive = shallowRef<E>(transform(selector()))

  const dispose = reaction(
    selector,
    (value) => {
      reactive.value = transform(value)
    },
    { fireImmediately: false }
  )

  onUnmounted(dispose)

  return readonly(reactive)
}

/**
 * Creates a readonly Vue ref that automatically tracks all MobX observables accessed in the selector.
 * Uses MobX's `autorun` which automatically detects dependencies, unlike {@link useReaction}
 * which only tracks the selector's return value for changes.
 * Automatically disposes the autorun when the component is unmounted.
 *
 * @template T The type of the tracked value
 *
 * @param selector A function that accesses MobX observables and returns a value
 * @returns A readonly shallow ref containing the tracked value
 *
 * @example
 * // Track multiple observables - updates when any accessed observable changes
 * const summary = useAutorun(() => `${store.count} items worth ${store.totalPrice}`)
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAutorun } from '@/composables/mobx'
 * import { projectStore } from '@/stores/project'
 *
 * // Re-computes whenever any accessed observable changes,
 * // even if the resulting string happens to be the same
 * const statusMessage = useAutorun(() => {
 *   const { tasks, completedCount } = projectStore
 *   return `${completedCount}/${tasks.length} tasks completed`
 * })
 * </script>
 *
 * <template>
 *   <div class="project-status">
 *     <p>{{ statusMessage }}</p>
 *   </div>
 * </template>
 * ```
 *
 * @see {@link useReaction} for tracking only when the selector's return value changes
 */
export function useAutorun<T>(selector: () => T): DeepReadonly<ShallowRef<T>> {
  const reactive = shallowRef<T>(selector())

  const dispose = autorun(() => {
    reactive.value = selector()
  })

  onUnmounted(dispose)

  return readonly(reactive)
}
