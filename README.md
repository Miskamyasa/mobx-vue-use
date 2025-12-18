# mobx-vue-use

Vue 3 Composition API utilities for MobX integration. Bridges MobX observables with Vue's reactivity system via composable hooks.

## Development

```bash
pnpm install
pnpm build   # tsup: ESM/CJS bundles + d.ts
pnpm test    # vitest
```

Package manager: pnpm (workspace enabled).

## Compatibility

- **Vue 3 Composition API only** — not compatible with Vue 2 or Options API
- **Peer dependencies required** — install `mobx` (>= 6.0.0) and `vue` (>= 3.0.0) at the app level

## Installation

```bash
npm install mobx-vue-use
# or
pnpm add mobx-vue-use
# or
yarn add mobx-vue-use
```

## Usage

All hooks return a **shallow, readonly ref** (`DeepReadonly<ShallowRef<T>>`). The ref cannot be mutated directly and does not deeply track nested object changes—only the top-level reference is reactive.

### `useReaction`

Tracks a MobX observable via `reaction()` and returns a readonly Vue ref that updates when the observed value changes.

`fireImmediately: false` is used internally; the initial value comes from the selector call before the reaction starts listening.

```typescript
import { observable, runInAction } from 'mobx'
import { useReaction } from 'mobx-vue-use'

const store = observable({ count: 0 })

// In a Vue component setup
const count = useReaction(() => store.count)

console.log(count.value) // 0

runInAction(() => {
  store.count = 10
})

console.log(count.value) // 10
```

### `useTransform`

Like `useReaction`, but applies a transform function to the observed value.

Also uses `fireImmediately: false`; the first value is `transform(selector())`, then subsequent updates are driven by the reaction.

```typescript
import { observable, runInAction } from 'mobx'
import { useTransform } from 'mobx-vue-use'

const store = observable({ items: [1, 2, 3, 4, 5] })

// Filter and transform the observed array
const evenDoubled = useTransform(
  () => store.items,
  (items) => items.filter(n => n % 2 === 0).map(n => n * 2)
)

console.log(evenDoubled.value) // [4, 8]

runInAction(() => {
  store.items = [2, 4, 6]
})

console.log(evenDoubled.value) // [4, 8, 12]
```

### `useAutorun`

Tracks a MobX observable via `autorun()` with automatic dependency detection. Updates when any observable accessed within the selector changes.

```typescript
import { observable, runInAction } from 'mobx'
import { useAutorun } from 'mobx-vue-use'

const store = observable({
  firstName: 'John',
  lastName: 'Doe'
})

// Automatically tracks both firstName and lastName
const fullName = useAutorun(() => `${store.firstName} ${store.lastName}`)

console.log(fullName.value) // "John Doe"

runInAction(() => {
  store.firstName = 'Jane'
})

console.log(fullName.value) // "Jane Doe"
```

## API

### `useReaction<T>(selector: () => T): DeepReadonly<ShallowRef<T>>`

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `() => T` | Function that returns the value to track |

Returns a readonly shallow ref containing the current value. The ref updates when the selector's return value changes (using MobX's structural comparison).

Notes:
- Returned refs are shallow and readonly; mutate the underlying MobX state, not the ref.
- Vue 3 Composition API only (Vue 2 is not supported).

### `useTransform<T, E>(selector: () => T, transform: (value: T) => E): DeepReadonly<ShallowRef<E>>`

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `() => T` | Function that returns the value to track |
| `transform` | `(value: T) => E` | Function to transform the observed value |

Returns a readonly shallow ref containing the transformed value. The transform function is called on initialization and whenever the observed value changes.

Notes:
- Returned refs are shallow and readonly.
- Vue 3 Composition API only.

### `useAutorun<T>(selector: () => T): DeepReadonly<ShallowRef<T>>`

| Parameter | Type | Description |
|-----------|------|-------------|
| `selector` | `() => T` | Function that returns the value to track |

Returns a readonly shallow ref. Unlike `useReaction`, this uses MobX's `autorun` which automatically tracks all observables accessed within the selector, including conditional accesses.

Notes:
- Returned refs are shallow and readonly.
- Vue 3 Composition API only.

## Runtime Behavior

**`useReaction` and `useTransform`** use `fireImmediately: false` internally. The initial value is obtained by calling the selector synchronously during setup—no extra MobX reaction run is needed. Subsequent updates are triggered by MobX when the observed value changes.

**`useAutorun`** runs the selector twice on setup: once to populate the initial ref value, and once when the autorun executes immediately. After setup, it re-runs only when accessed observables change.

## Differences Between Hooks

| Feature | `useReaction` | `useAutorun` |
|---------|---------------|--------------|
| Tracking | Explicit (selector return value) | Automatic (all accessed observables) |
| Re-tracking | Static dependencies | Dynamic (re-tracks on each run) |
| Initial run | Selector runs once | Autorun runs immediately |
| Use case | Simple value tracking | Complex/conditional dependencies |

## Vue Integration

The returned refs work seamlessly with Vue's reactivity system:

```typescript
import { computed, watch } from 'vue'
import { useAutorun } from 'mobx-vue-use'

const store = observable({ count: 0 })
const count = useAutorun(() => store.count)

// Works with Vue computed
const doubled = computed(() => count.value * 2)

// Works with Vue watch
watch(count, (newValue) => {
  console.log('Count changed:', newValue)
})
```

## Cleanup

All hooks automatically dispose their MobX subscriptions when the component unmounts via Vue's `onUnmounted` lifecycle hook. No manual cleanup is required.

## Build Output

- `dist/index.mjs` — ESM
- `dist/index.js` — CommonJS
- `dist/index.d.ts` — Type declarations
- Source maps enabled; MobX and Vue remain external (not bundled).

## TypeScript

Full TypeScript support with proper type inference:

```typescript
const store = observable({ count: 0, name: 'test' })

// Type is DeepReadonly<ShallowRef<number>>
const count = useReaction(() => store.count)

// Type is DeepReadonly<ShallowRef<string>>
const formatted = useTransform(
  () => store.count,
  (n): string => n.toFixed(2)
)
```

## Development

This project uses a **pnpm workspace**.

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsup (outputs to `dist/`) |
| `pnpm test` | Run tests with Vitest |

### Build Output

```
dist/
  index.mjs    # ES module
  index.js     # CommonJS
  index.d.ts   # Type declarations
```

- Built with [tsup](https://github.com/egoist/tsup)
- Source maps included
- `mobx` and `vue` are externalized (not bundled)

## License

MIT
