import { embedImagesInSvg } from './imageUtils';

/**
 * Figma export — generic, template-agnostic.
 *
 * Figma's SVG import ignores <foreignObject> (HTML) content, so a raw copy of
 * our stage SVG would drop every headline, body, list and button. Rather than
 * hand-author a parallel pure-SVG layout per template (which silently drifts
 * whenever a template changes), this reads the LIVE rendered stage and rebuilds
 * it as native SVG from the browser's actual layout:
 *
 *   • SVG-native decoration (background, glow, washes, signature card, swipe)
 *     is copied through, with every `var(--…)` resolved to its computed value
 *     (Figma doesn't evaluate CSS custom properties or <style> blocks).
 *   • Each <foreignObject> is replaced by <text>/<rect>/<image> read from the
 *     measured positions of its HTML — text wrapping included, since we read the
 *     lines the browser already laid out.
 *   • Remote <image> hrefs are inlined as base64 so the copy is self-contained.
 *
 * The result always matches what the user sees, for any current or future
 * template, with no template-specific code to maintain.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Parse a computed color into hex + alpha, or null if fully transparent. */
const parseColor = (c: string): { hex: string; a: number } | null => {
    if (!c || c === 'transparent' || c === 'none') return null;
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(',').map((v) => parseFloat(v.trim()));
    const a = p.length > 3 ? p[3] : 1;
    if (a === 0) return null;
    const hex = '#' + p.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    return { hex, a };
};

const resolveVars = (value: string, cs: CSSStyleDeclaration): string =>
    value.includes('var(')
        ? value.replace(/var\((--[\w-]+)\)/g, (mm, name) => cs.getPropertyValue(name).trim() || mm)
        : value;

export const serializeStageForFigma = async (liveSvg: SVGSVGElement): Promise<string> => {
    const vb = liveSvg.viewBox.baseVal;
    const svgRect = liveSvg.getBoundingClientRect();
    // Uniform scale from on-screen client px to SVG user units (aspect is locked).
    const scale = vb.width / svgRect.width;
    const toX = (clientX: number) => vb.x + (clientX - svgRect.left) * scale;
    const toY = (clientY: number) => vb.y + (clientY - svgRect.top) * scale;

    const out = document.createElementNS(SVG_NS, 'svg');
    out.setAttribute('xmlns', SVG_NS);
    out.setAttribute('xmlns:xlink', XLINK_NS);
    out.setAttribute('width', String(vb.width));
    out.setAttribute('height', String(vb.height));
    out.setAttribute('viewBox', `0 0 ${vb.width} ${vb.height}`);

    for (const child of Array.from(liveSvg.children)) {
        if (child.tagName.toLowerCase() === 'foreignobject') {
            const g = document.createElementNS(SVG_NS, 'g');
            const rootDiv = child.querySelector('div');
            if (rootDiv) walkHtml(rootDiv, g);
            out.appendChild(g);
        } else {
            const native = cloneNative(child);
            if (native) out.appendChild(native);
        }
    }

    // Inline any remote <image> (doodle, avatar) so the clipboard SVG stands alone.
    await embedImagesInSvg(out);

    return new XMLSerializer().serializeToString(out);

    // ── native SVG passthrough (resolve CSS vars, drop <style>) ────────────────
    function cloneNative(liveEl: Element): Element | null {
        const tag = liveEl.tagName;
        if (tag.toLowerCase() === 'style') return null; // Figma ignores it; vars are resolved inline
        const cs = getComputedStyle(liveEl);
        if (cs.display === 'none') return null;
        const el = document.createElementNS(liveEl.namespaceURI || SVG_NS, tag);
        for (const attr of Array.from(liveEl.attributes)) {
            el.setAttribute(attr.name, resolveVars(attr.value, cs));
        }
        for (const c of Array.from(liveEl.childNodes)) {
            if (c.nodeType === Node.TEXT_NODE) {
                // e.g. the ghost slide number and signature name/title live as
                // text-node content of <text> elements.
                el.appendChild(document.createTextNode(c.textContent || ''));
            } else if (c.nodeType === Node.ELEMENT_NODE) {
                const cc = cloneNative(c as Element);
                if (cc) el.appendChild(cc);
            }
        }
        return el;
    }

    // ── foreignObject (HTML) → native SVG from measured layout ─────────────────
    // An element is a "text block" when it holds text and all its children are
    // inline — its own line-height defines the grid every line snaps to.
    function isInline(el: Element) { return getComputedStyle(el).display === 'inline'; }
    function hasText(el: Element) { return (el.textContent || '').trim().length > 0; }
    function isTextBlock(el: Element) {
        return hasText(el) && Array.from(el.children).every(isInline);
    }

    function walkHtml(el: Element, g: Element) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const opacity = parseFloat(cs.opacity);
        if (opacity === 0) return;

        emitBackground(el, cs, opacity, g);

        if (el.tagName === 'IMG') {
            emitImage(el as HTMLImageElement, cs, opacity, g);
            return;
        }

        if (isTextBlock(el)) {
            emitBlockText(el, cs, opacity, g);
            return; // its inline subtree (incl. any highlight spans) is fully handled
        }

        for (const node of Array.from(el.childNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE) walkHtml(node as Element, g);
        }
    }

    function emitBackground(el: Element, cs: CSSStyleDeclaration, opacity: number, g: Element) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;

        const solid = parseColor(cs.backgroundColor);
        if (solid) {
            const rect = document.createElementNS(SVG_NS, 'rect');
            rect.setAttribute('x', String(toX(r.left)));
            rect.setAttribute('y', String(toY(r.top)));
            rect.setAttribute('width', String(r.width * scale));
            rect.setAttribute('height', String(r.height * scale));
            const radius = parseFloat(cs.borderTopLeftRadius) || 0;
            if (radius) rect.setAttribute('rx', String(Math.min(radius, r.height / 2) * scale));
            rect.setAttribute('fill', solid.hex);
            const alpha = solid.a * opacity;
            if (alpha < 1) rect.setAttribute('fill-opacity', String(alpha));
            g.appendChild(rect);
        }

        // Highlighter marker: the accent phrase uses a bottom-anchored gradient
        // (transparent top, tinted lower band). Approximate it as a rect over the
        // lower ~56% using the gradient's tint colour.
        const bgImg = cs.backgroundImage;
        if (bgImg && bgImg.includes('gradient')) {
            const cm = bgImg.match(/rgba?\([^)]+\)/);
            const tint = cm ? parseColor(cm[0]) : null;
            if (tint) {
                const bandH = r.height * 0.56;
                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', String(toX(r.left)));
                rect.setAttribute('y', String(toY(r.bottom - bandH)));
                rect.setAttribute('width', String(r.width * scale));
                rect.setAttribute('height', String(bandH * scale));
                rect.setAttribute('fill', tint.hex);
                const alpha = tint.a * opacity;
                if (alpha < 1) rect.setAttribute('fill-opacity', String(alpha));
                g.appendChild(rect);
            }
        }
    }

    function emitImage(el: HTMLImageElement, cs: CSSStyleDeclaration, opacity: number, g: Element) {
        const r = el.getBoundingClientRect();
        const image = document.createElementNS(SVG_NS, 'image');
        image.setAttribute('x', String(toX(r.left)));
        image.setAttribute('y', String(toY(r.top)));
        image.setAttribute('width', String(r.width * scale));
        image.setAttribute('height', String(r.height * scale));
        const src = el.src;
        image.setAttribute('href', src);
        image.setAttributeNS(XLINK_NS, 'xlink:href', src);
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') {
            image.setAttribute('style', `mix-blend-mode:${cs.mixBlendMode}`);
        }
        if (opacity < 1) image.setAttribute('opacity', String(opacity));
        g.appendChild(image);
    }

    /**
     * Lay out a text block's inline content by snapping every line to the block's
     * line-height grid — so line spacing is exact and consistent (glyph-box tops
     * drift with caps/descenders). Handles inline runs of differing style (e.g. an
     * italic serif accent phrase) by measuring each word and merging same-line,
     * same-style neighbours into one <text>.
     */
    // NOTE on units: getBoundingClientRect() returns on-screen px (→ user units
    // via toX/toY/×scale), but getComputedStyle font metrics are already in user
    // units (1 CSS px == 1 user unit inside a foreignObject), so font-size,
    // line-height and letter-spacing are used as-is — never scaled.
    function emitBlockText(blockEl: Element, blockCs: CSSStyleDeclaration, opacity: number, g: Element) {
        const gridTopUser = toY(blockEl.getBoundingClientRect().top);
        const blockFontSize = parseFloat(blockCs.fontSize);
        const lineHeight = parseFloat(blockCs.lineHeight) || blockFontSize * 1.2;

        type Frag = { word: string; left: number; top: number; cs: CSSStyleDeclaration };
        const frags: Frag[] = [];

        const collect = (node: Node) => {
            for (const n of Array.from(node.childNodes)) {
                if (n.nodeType === Node.TEXT_NODE) {
                    const text = n.textContent || '';
                    if (!text.trim()) continue;
                    const pcs = getComputedStyle((n.parentElement || blockEl) as Element);
                    const re = /\S+/g;
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(text))) {
                        const range = document.createRange();
                        range.setStart(n, m.index);
                        range.setEnd(n, m.index + m[0].length);
                        const rr = range.getBoundingClientRect();
                        if (rr.width === 0 && rr.height === 0) continue;
                        frags.push({ word: m[0], left: rr.left, top: rr.top, cs: pcs });
                    }
                } else if (n.nodeType === Node.ELEMENT_NODE) {
                    const ecs = getComputedStyle(n as Element);
                    emitBackground(n as Element, ecs, opacity, g); // e.g. highlighter span
                    collect(n);
                }
            }
        };
        collect(blockEl);
        if (!frags.length) return;

        // Cluster glyph tops into line rows, then order them → grid index.
        const lineTops: number[] = [];
        for (const f of frags) {
            if (!lineTops.some((t) => Math.abs(t - f.top) < blockFontSize * 0.5)) lineTops.push(f.top);
        }
        lineTops.sort((a, b) => a - b);
        const lineIndexOf = (top: number) => {
            let best = 0, bd = Infinity;
            lineTops.forEach((t, i) => { const d = Math.abs(t - top); if (d < bd) { bd = d; best = i; } });
            return best;
        };

        // Merge consecutive same-line, same-style words into runs.
        type Run = { line: number; cs: CSSStyleDeclaration; left: number; words: string[] };
        const sameStyle = (a: CSSStyleDeclaration, b: CSSStyleDeclaration) =>
            a.color === b.color && a.fontFamily === b.fontFamily && a.fontSize === b.fontSize &&
            a.fontWeight === b.fontWeight && a.fontStyle === b.fontStyle;
        const runs: Run[] = [];
        for (const f of frags) {
            const line = lineIndexOf(f.top);
            const last = runs[runs.length - 1];
            if (last && last.line === line && sameStyle(last.cs, f.cs)) {
                last.words.push(f.word);
                last.left = Math.min(last.left, f.left);
            } else {
                runs.push({ line, cs: f.cs, left: f.left, words: [f.word] });
            }
        }

        for (const run of runs) {
            const cs = run.cs;
            const fontSize = parseFloat(cs.fontSize);
            const fill = parseColor(cs.color);
            const family = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
            const letterSpacing = parseFloat(cs.letterSpacing);
            let str = run.words.join(' ');
            if (cs.textTransform === 'uppercase') str = str.toUpperCase();
            const baseline = gridTopUser + run.line * lineHeight + (lineHeight - fontSize) / 2 + fontSize * 0.8;
            const t = document.createElementNS(SVG_NS, 'text');
            t.setAttribute('x', String(toX(run.left)));
            t.setAttribute('y', String(baseline));
            t.setAttribute('font-family', family);
            t.setAttribute('font-size', String(fontSize));
            t.setAttribute('font-weight', cs.fontWeight);
            if (cs.fontStyle && cs.fontStyle !== 'normal') t.setAttribute('font-style', cs.fontStyle);
            if (letterSpacing) t.setAttribute('letter-spacing', String(letterSpacing));
            if (fill) t.setAttribute('fill', fill.hex);
            const alpha = (fill ? fill.a : 1) * opacity;
            if (alpha < 1) t.setAttribute('fill-opacity', String(alpha));
            t.textContent = str;
            g.appendChild(t);
        }
    }
};
