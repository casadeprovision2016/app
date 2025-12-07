import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
	plugins: [react()],
	root: 'frontend',
	publicDir: 'public',
	build: {
		outDir: '../dist/frontend',
		emptyOutDir: true,
		// Generate source maps for better debugging
		sourcemap: true,
		// Optimize chunk splitting for better caching
		rollupOptions: {
			output: {
				manualChunks: {
					'react-vendor': ['react', 'react-dom'],
				},
			},
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './frontend/src'),
		},
	},
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/**/*.test.ts',
				'src/**/*.spec.ts',
			],
		},
	},
});
