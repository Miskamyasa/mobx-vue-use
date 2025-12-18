# AGENTS.md

Guidelines for AI agents working in this repository.

## Project Overview

`mobx-vue-use` is a TypeScript library providing Vue 3 Composition API utilities for MobX integration. It bridges MobX observables with Vue's reactivity system via composable hooks.

## Commands

| Command | Description |
|---------|-------------|
| `pnpm build` | Build the library with tsup (outputs ESM, CJS, and type declarations to `dist/`) |
| `pnpm test` | Run tests with Vitest |

**Package manager**: pnpm (workspace configuration present)

## Project Structure

```
src/
  mobx-vue-use.ts    # Single source file containing all exports
dist/                # Build output (generated)
```

This is a minimal single-file library. All functionality lives in `src/mobx-vue-use.ts`.

## Code Patterns

### Exported Functions

The library exports three composables:

| Function | Purpose |
|----------|---------|
| `useReaction<T>(selector)` | Track MobX observable via `reaction()`, returns readonly shallow ref |
| `useTransform<T, E>(selector, transform)` | Like `useReaction` but transforms the value through an transform function |
| `useAutorun<T>(selector)` | Track MobX observable via `autorun()`, returns readonly shallow ref |

### Pattern Structure

All composables follow the same pattern:
1. Create a `shallowRef` with initial value from selector
2. Set up MobX listener (`reaction` or `autorun`) to update the ref
3. Register `onUnmounted` cleanup to dispose the listener
4. Return `readonly(reactive)` to prevent external mutation

### Type Conventions

- Return type is always `DeepReadonly<ShallowRef<T>>` (or `<E>` for transform)
- Generic type parameters: `T` for selector return type, `E` for transformed type
- `fireImmediately: false` used with reactions (initial value set synchronously)

## TypeScript Configuration

Strict mode enabled with additional checks:
- `noImplicitReturns`
- `noFallthroughCasesInSwitch`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`

Target: ESNext, Module: ESNext

## Dependencies

**Peer dependencies** (user must provide):
- `mobx` >= 6.0.0
- `vue` >= 3.0.0

**Build tools**:
- `tsup` - bundler
- `typescript` - type checking
- `vitest` - testing (configured but no tests exist yet)

## Build Output

tsup produces:
- `dist/index.mjs` - ES module
- `dist/index.js` - CommonJS
- `dist/index.d.ts` - Type declarations
- Source maps enabled

## Notes

- No tests exist yet - Vitest is configured but no test files present
- No linting/formatting tools configured
- Single source file architecture - consider this when adding features
- The `--external react` flag in build script appears to be a copy-paste artifact (this is a Vue library)
