/**
 * The slide engine emits its theme as `:root { --vars }` and uses fixed ids for
 * gradients/patterns. That is fine for one slide on a page, but the studio shows
 * many (stage, filmstrip, history thumbnails with *different* themes), so each
 * copy is scoped: `:root` → a unique class, ids → suffixed. Wrap the markup in an
 * element carrying the same class.
 */
const cache = new Map<string, string>();

export const scopeSvg = (svg: string, scope: string): string => {
  if (!svg) return '';
  const key = scope + '|' + svg;
  const hit = cache.get(key);
  if (hit) return hit;

  let out = svg.replace(/:root/g, `.${scope}`);
  const ids = new Set<string>();
  out.replace(/\sid="([^"]+)"/g, (m, id) => { ids.add(id); return m; });
  ids.forEach((id) => {
    if (id.endsWith(scope)) return;
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out
      .replace(new RegExp(`id="${esc}"`, 'g'), `id="${id}-${scope}"`)
      .replace(new RegExp(`url\\(#${esc}\\)`, 'g'), `url(#${id}-${scope})`)
      .replace(new RegExp(`href="#${esc}"`, 'g'), `href="#${id}-${scope}"`);
  });

  if (cache.size > 300) cache.clear();
  cache.set(key, out);
  return out;
};
