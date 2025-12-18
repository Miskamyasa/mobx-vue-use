import { onUnmounted, readonly,  shallowRef, type DeepReadonly, type ShallowRef } from 'vue'
import { reaction, autorun } from 'mobx'

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

export function useAutorun<T>(selector: () => T): DeepReadonly<ShallowRef<T>> {
  const reactive = shallowRef<T>(selector())

  const dispose = autorun(() => {
    reactive.value = selector()
  })

  onUnmounted(dispose)

  return readonly(reactive)
}
