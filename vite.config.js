import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	// Without the browser condition vitest resolves Svelte's server build, so
	// `onMount` is the no-op stub and `$app/environment`'s `browser` is false —
	// component lifecycle code silently never runs in tests.
	resolve: process.env.VITEST ? { conditions: ['browser'] } : undefined,
	test: {
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./vitest-setup.js']
	}
});
