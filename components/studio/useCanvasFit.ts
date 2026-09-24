/**
 * Fits Canvas slides (template-5) rendered inside a container: shrinks each
 * slide's text until nothing overflows (see core/design/canvas/fit.ts).
 * Runs after every render of the container's markup and again whenever a web
 * font finishes loading, since text metrics change when the real font lands.
 */

import { useLayoutEffect, type DependencyList, type RefObject } from 'react';
import { fitCanvasIn } from '../../core/design/canvas/fit';

export const useCanvasFit = (ref: RefObject<HTMLElement | null>, deps: DependencyList, enabled = true) => {
    useLayoutEffect(() => {
        if (!enabled) return;
        const el = ref.current;
        if (!el) return;
        fitCanvasIn(el);
        let raf = 0;
        const refit = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(() => { if (ref.current) fitCanvasIn(ref.current); });
        };
        const fonts: any = typeof document !== 'undefined' ? (document as any).fonts : null;
        fonts?.ready?.then?.(refit).catch?.(() => undefined);
        fonts?.addEventListener?.('loadingdone', refit);
        // Typing into a slide can overflow it: refit as the user types.
        el.addEventListener('input', refit);
        return () => {
            cancelAnimationFrame(raf);
            fonts?.removeEventListener?.('loadingdone', refit);
            el.removeEventListener('input', refit);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...deps]);
};
