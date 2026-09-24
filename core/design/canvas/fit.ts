/**
 * Browser-side text fitting for Canvas slides.
 *
 * Every Canvas font size is `calc(<px> * var(--fit))` and gaps shrink with it,
 * so fitting a slide is a binary search on one CSS variable of its
 * [data-canvas-root]: the largest --fit (≤ 1) at which nothing overflows.
 * Runs on the live DOM, so stage, thumbnails and every export (which clone
 * the live DOM) all see fitted text.
 */

const MIN_FIT = 0.5;

const overflows = (root: HTMLElement) =>
    root.scrollHeight > root.clientHeight + 2 || root.scrollWidth > root.clientWidth + 2;

export const fitCanvasRoot = (root: HTMLElement): number => {
    root.style.setProperty('--fit', '1');
    if (!overflows(root)) return 1;
    let lo = MIN_FIT;
    let hi = 1;
    for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        root.style.setProperty('--fit', mid.toFixed(3));
        if (overflows(root)) hi = mid;
        else lo = mid;
    }
    root.style.setProperty('--fit', lo.toFixed(3));
    return lo;
};

/** Fits every Canvas slide inside `container`. Returns how many were fitted. */
export const fitCanvasIn = (container: ParentNode | null | undefined): number => {
    if (!container || typeof (container as any).querySelectorAll !== 'function') return 0;
    const roots = Array.from((container as ParentNode).querySelectorAll<HTMLElement>('[data-canvas-root]'));
    roots.forEach(fitCanvasRoot);
    return roots.length;
};

/**
 * Standalone copy of the fitter for exported HTML files (no bundler there).
 * Keep in sync with fitCanvasRoot above.
 */
export const FIT_SCRIPT = `(function(){function o(r){return r.scrollHeight>r.clientHeight+2||r.scrollWidth>r.clientWidth+2}function f(r){r.style.setProperty('--fit','1');if(!o(r))return;var lo=${MIN_FIT},hi=1;for(var i=0;i<8;i++){var m=(lo+hi)/2;r.style.setProperty('--fit',m.toFixed(3));if(o(r))hi=m;else lo=m}r.style.setProperty('--fit',lo.toFixed(3))}function all(){document.querySelectorAll('[data-canvas-root]').forEach(f)}if(document.fonts&&document.fonts.ready){document.fonts.ready.then(all)}window.addEventListener('load',all);all();})();`;
