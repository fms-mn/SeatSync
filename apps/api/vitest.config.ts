import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', setupFiles: ['./src/test-env.ts'], fileParallelism: false, testTimeout: 20_000 },
});
