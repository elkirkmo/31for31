import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement the Web Animations API, which Svelte's
// per-item each-block transitions use under the hood -- without this,
// any component using a css-function transition throws in tests.
if (!Element.prototype.animate) {
	Element.prototype.animate = function (_keyframes, options) {
		const duration = typeof options === 'number' ? options : (options && options.duration) || 0;
		const animation = {
			onfinish: null,
			oncancel: null,
			cancel() {
				clearTimeout(timer);
				this.oncancel && this.oncancel();
			},
			finish() {
				clearTimeout(timer);
				this.onfinish && this.onfinish();
			},
			play() {},
			pause() {}
		};
		const timer = setTimeout(() => {
			animation.onfinish && animation.onfinish();
		}, duration);
		animation.finished = new Promise((resolve) => setTimeout(resolve, duration));
		return animation;
	};
}
