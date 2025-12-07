import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.integration.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
				'src/**/*.integration.test.ts',
			],
		},
		testTimeout: 30000, // 30 seconds for integration tests
	},
});
