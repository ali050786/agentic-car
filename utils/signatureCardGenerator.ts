import { BrandingConfig, CarouselFormat } from '../types';

/**
 * Signature card, rendered as HTML inside a <foreignObject> so the name and
 * title are editable directly on the canvas (data-edit-field, like slide
 * content) — ArtifactPanel commits edits back to the brand kit. The avatar is a
 * plain <img> (circular via border-radius); the figma exporter converts the
 * whole card to native SVG on export.
 *
 * data-signature marks the card so the on-canvas position picker can anchor to it.
 */
export const generateSignatureCard = (
  data: BrandingConfig,
  fontFamily: 'Lato' | 'Roboto',
  format: CarouselFormat = 'portrait',
  _uniqueId: string = '',
  templateId?: string
): string => {
  const escapeXml = (unsafe: string) =>
    (unsafe || '').replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
      return c;
    });

  const CANVAS_WIDTH = 1080;
  const CARD_WIDTH = 470;
  const CARD_HEIGHT = 92;
  const AVATAR = 88;

  // Left-aligned cards line up with each template's content left edge.
  const defaultX = templateId === 'template-3' ? 80
    : templateId === 'template-4' ? 100
    : templateId === 'template-1' ? (format === 'square' ? 80 : 90)
    : 150;

  // T4 has a tighter 100px margin, so the card sits lower to balance the layout.
  const bottomLeftY = format === 'square'
    ? (templateId === 'template-4' ? 880 : 860)
    : (templateId === 'template-4' ? 1160 : 1120);
  const topY = format === 'square' ? 85 : 120;

  const positions = {
    'bottom-left': { x: defaultX, y: bottomLeftY, right: false },
    'top-left': { x: defaultX, y: topY, right: false },
    'top-right': { x: CANVAS_WIDTH - defaultX - CARD_WIDTH, y: topY, right: true },
  } as const;

  const pos = positions[data.position] || positions['bottom-left'];

  const nameStyle = `font-family: '${fontFamily}', sans-serif; font-weight: 500; font-size: 28px; color: var(--text-highlight); line-height: 1.2; outline: none;`;
  const titleStyle = `font-family: '${fontFamily}', sans-serif; font-weight: 400; font-size: 24px; color: var(--text-default); line-height: 1.2; outline: none;`;
  const avatarImg = `<img src="${escapeXml(data.imageUrl)}" style="width: ${AVATAR}px; height: ${AVATAR}px; border-radius: 50%; object-fit: cover; flex-shrink: 0;" />`;
  const textCol = `
        <div style="display: flex; flex-direction: column; min-width: 0; ${pos.right ? 'align-items: flex-end; text-align: right;' : ''}">
          <div data-edit-field="brandName" contenteditable="false" spellcheck="false" style="${nameStyle}">${escapeXml(data.name)}</div>
          <div data-edit-field="brandTitle" contenteditable="false" spellcheck="false" style="${titleStyle}">${escapeXml(data.title)}</div>
        </div>`;

  return `
    <foreignObject x="${pos.x}" y="${pos.y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" data-signature="true">
      <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: center; gap: 20px; height: 100%; width: 100%; ${pos.right ? 'flex-direction: row-reverse; justify-content: flex-start;' : ''}">
        ${avatarImg}
        ${textCol}
      </div>
    </foreignObject>
  `;
};
