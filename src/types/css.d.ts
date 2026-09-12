// Ambient CSS declarations so `tsc --noEmit` passes in CI, where the generated
// (and gitignored) expo-env.d.ts is absent. Locally, expo/types provides these
// too; the duplicate ambient declarations are harmless.

declare module '*.css';
