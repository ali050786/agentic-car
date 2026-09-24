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

        // Inline SVG inside the HTML (icons, arrows, charts, Canvas decorations):
        // copy it as native vector content, mapped onto where the browser drew it.
        if (el.namespaceURI === SVG_NS && el.tagName.toLowerCase() === 'svg') {
            emitInlineSvg(el as SVGSVGElement, opacity, g);
            return;
        }

        emitShadow(el, cs, opacity, g);
        emitBackground(el, cs, opacity, g);
        emitBorder(el, cs, opacity, g);

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

    function emitInlineSvg(el: SVGSVGElement, opacity: number, g: Element) {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const vbAttr = el.getAttribute('viewBox');
        const vbp = vbAttr ? vbAttr.split(/[\s,]+/).map(Number) : [0, 0, r.width * scale, r.height * scale];
        const [vx, vy, vw, vh] = vbp.length === 4 && vbp.every(Number.isFinite) ? vbp : [0, 0, r.width * scale, r.height * scale];
        const sx = (r.width * scale) / (vw || 1);
        const sy = (r.height * scale) / (vh || 1);
        const wrap = document.createElementNS(SVG_NS, 'g');
        wrap.setAttribute('transform', `translate(${toX(r.left)} ${toY(r.top)}) scale(${sx} ${sy}) translate(${-vx} ${-vy})`);
        // Presentation attributes set on the <svg> itself (fill/stroke of lucide icons) apply to its children.
        for (const a of ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']) {
            const v = el.getAttribute(a);
            if (v) wrap.setAttribute(a, resolveVars(v, getComputedStyle(el)));
        }
        if (opacity < 1) wrap.setAttribute('opacity', String(opacity));
        for (const c of Array.from(el.children)) {
            const cc = cloneNative(c);
            if (cc) wrap.appendChild(cc);
        }
        g.appendChild(wrap);
    }

    /** Hard (unblurred) box shadows, e.g. brutalist cards and buttons. */
    function emitShadow(el: Element, cs: CSSStyleDeclaration, opacity: number, g: Element) {
        const bs = cs.boxShadow;
        if (!bs || bs === 'none') return;
        const m = bs.match(/(rgba?\([^)]+\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/);
        if (!m || parseFloat(m[4]) > 0.5) return;
        const col = parseColor(m[1]);
        if (!col) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', String(toX(r.left) + parseFloat(m[2])));
        rect.setAttribute('y', String(toY(r.top) + parseFloat(m[3])));
        rect.setAttribute('width', String(r.width * scale));
        rect.setAttribute('height', String(r.height * scale));
        const radius = parseFloat(cs.borderTopLeftRadius) || 0;
        if (radius) rect.setAttribute('rx', String(Math.min(radius, (r.height * scale) / 2)));
        rect.setAttribute('fill', col.hex);
        if (col.a * opacity < 1) rect.setAttribute('fill-opacity', String(col.a * opacity));
        g.appendChild(rect);
    }

    function emitBorder(el: Element, cs: CSSStyleDeclaration, opacity: number, g: Element) {
        const w = parseFloat(cs.borderTopWidth) || 0;
        if (w <= 0 || cs.borderTopStyle === 'none') return;
        const col = parseColor(cs.borderTopColor);
        if (!col) return;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return;
        const rect = document.createElementNS(SVG_NS, 'rect');
        // Stroke is centred on the path: inset by half the width to sit inside the box like CSS borders.
        rect.setAttribute('x', String(toX(r.left) + w / 2));
        rect.setAttribute('y', String(toY(r.top) + w / 2));
        rect.setAttribute('width', String(Math.max(0, r.width * scale - w)));
        rect.setAttribute('height', String(Math.max(0, r.height * scale - w)));
        const radius = parseFloat(cs.borderTopLeftRadius) || 0;
        if (radius) rect.setAttribute('rx', String(Math.max(0, Math.min(radius, (r.height * scale) / 2) - w / 2)));
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', col.hex);
        rect.setAttribute('stroke-width', String(w));
        if (col.a * opacity < 1) rect.setAttribute('stroke-opacity', String(col.a * opacity));
        g.appendChild(rect);
    }

    let gradSeq = 0;
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

        const bgImg = cs.backgroundImage;
        // A panel gradient (two opaque colours): a real <linearGradient> over the box.
        if (bgImg && bgImg.includes('linear-gradient') && !/transparent|rgba\([^)]*,\s*0\)/.test(bgImg)) {
            const cols = (bgImg.match(/rgba?\([^)]+\)/g) || []).map(parseColor).filter(Boolean) as { hex: string; a: number }[];
            if (cols.length >= 2) {
                const id = `fgrad-${++gradSeq}`;
                const lg = document.createElementNS(SVG_NS, 'linearGradient');
                lg.setAttribute('id', id);
                lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0'); lg.setAttribute('x2', '1'); lg.setAttribute('y2', '1');
                cols.forEach((c, i) => {
                    const stop = document.createElementNS(SVG_NS, 'stop');
                    stop.setAttribute('offset', String(i / (cols.length - 1)));
                    stop.setAttribute('stop-color', c.hex);
                    if (c.a < 1) stop.setAttribute('stop-opacity', String(c.a));
                    lg.appendChild(stop);
                });
                g.appendChild(lg);
                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', String(toX(r.left)));
                rect.setAttribute('y', String(toY(r.top)));
                rect.setAttribute('width', String(r.width * scale));
                rect.setAttribute('height', String(r.height * scale));
                const radius = parseFloat(cs.borderTopLeftRadius) || 0;
                if (radius) rect.setAttribute('rx', String(Math.min(radius, r.height / 2) * scale));
                rect.setAttribute('fill', `url(#${id})`);
                if (opacity < 1) rect.setAttribute('fill-opacity', String(opacity));
                g.appendChild(rect);
                return;
            }
        }

        // Highlighter / underline marks: a tinted band between two transparent
        // stops (e.g. "transparent 56%, tint 56%, tint 94%, transparent 94%").
        // Draw the band where the stops put it (lower ~56% when unspecified).
        if (bgImg && bgImg.includes('gradient')) {
            const cm = bgImg.match(/rgba?\([^)]+\)/g)?.find((c) => !!parseColor(c));
            const tint = cm ? parseColor(cm) : null;
            if (tint) {
                const pcts = (bgImg.match(/(\d+(?:\.\d+)?)%/g) || []).map((x) => parseFloat(x) / 100);
                const from = pcts.length >= 2 ? pcts[0] : 0.44;
                const to = pcts.length >= 3 ? pcts[pcts.length - 1] : 1;
                const bandH = r.height * Math.max(0.02, to - from);
                const bandTop = r.top + r.height * from;
                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', String(toX(r.left)));
                rect.setAttribute('y', String(toY(bandTop)));
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
            else t.setAttribute('fill', 'none');
            // Outlined numerals (-webkit-text-stroke with a transparent fill).
            const strokeW = parseFloat((cs as any).webkitTextStrokeWidth || '0');
            const strokeC = parseColor((cs as any).webkitTextStrokeColor || '');
            if (strokeW > 0 && strokeC) {
                t.setAttribute('stroke', strokeC.hex);
                t.setAttribute('stroke-width', String(strokeW));
            }
            const alpha = (fill ? fill.a : 1) * opacity;
            if (fill && alpha < 1) t.setAttribute('fill-opacity', String(alpha));
            t.textContent = str;
            g.appendChild(t);
        }
    }
};
