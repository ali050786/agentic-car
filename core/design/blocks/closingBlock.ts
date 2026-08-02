import { FONTS } from '../tokens';
import { BlockRenderParams } from './heroBlock';

export interface ClosingBlockRenderParams extends BlockRenderParams {
  footer?: string;
}

export const renderClosingBlock = ({
  templateId,
  isSquare,
  slideNum,
  preHeader,
  headlineHtml,
  body,
  footer,
  wrapEditable,
}: ClosingBlockRenderParams): string => {
  const preHeaderWrapped = preHeader ? wrapEditable('preHeader', preHeader) : '';
  const bodyWrapped = body ? wrapEditable('body', body) : '';
  const headlineWrapped = wrapEditable('headline', headlineHtml);
  const footerText = footer || 'Follow for more →';
  const footerWrapped = wrapEditable('footer', footerText);

  if (templateId === 'template-1') {
    const kickerSize = isSquare ? '23px' : '26px';
    const kickerHeight = isSquare ? '30px' : '34px';
    const headlineSize = isSquare ? '74px' : '96px';
    const bodySize = isSquare ? '30px' : '34px';
    const gap = isSquare ? '36px' : '46px';
    const maxW = isSquare ? '640px' : '680px';
    const btnFont = isSquare ? '26px' : '30px';
    const btnArrow = isSquare ? '28px' : '32px';
    const btnPadding = isSquare ? '20px 44px' : '26px 54px';
    const btnMarginTop = isSquare ? '12px' : '16px';
    const btnGap = isSquare ? '14px' : '16px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: ${FONTS.mono}; font-weight: 500; font-size: ${kickerSize}; line-height: ${kickerHeight}; color: var(--text-default); overflow: visible;">
          <div style="min-width: 0; overflow: visible; height: ${kickerHeight};">
            <span style="display: inline-block; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap; overflow: visible; line-height: ${kickerHeight}; height: ${kickerHeight};">${preHeaderWrapped}</span>
          </div>
          <div style="opacity: 0.55; flex-shrink: 0; line-height: ${kickerHeight}; height: ${kickerHeight};">/${slideNum}</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${gap};">
          <div style="font-family: ${FONTS.interTight}; font-weight: 800; font-size: ${headlineSize}; line-height: ${isSquare ? '1.04' : '1.05'}; letter-spacing: -0.025em; color: var(--text-highlight);">
            ${headlineWrapped}
          </div>
          <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; line-height: 1.5; color: var(--text-default); max-width: ${maxW};">
            ${bodyWrapped}
          </div>
          <div style="margin-top: ${btnMarginTop}; display: inline-flex; align-self: flex-start; align-items: center; gap: ${btnGap}; background: var(--background-2); color: var(--background); font-family: ${FONTS.interTight}; font-weight: 800; font-size: ${btnFont}; letter-spacing: 0.02em; padding: ${btnPadding}; border-radius: 999px;">
            FOLLOW
            <span style="font-size: ${btnArrow};">&#8594;</span>
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-3') {
    const preHeaderSize = isSquare ? '22px' : '24px';
    const topGap = isSquare ? '64px' : '76px';
    const headlineSize = isSquare ? '60px' : '74px';
    const bodySize = isSquare ? '26px' : '30px';
    const bodyWidth = isSquare ? '560px' : '600px';
    const flexGap = isSquare ? '24px' : '32px';
    const btnFont = isSquare ? '24px' : '28px';
    const btnArrow = isSquare ? '26px' : '30px';
    const btnPadding = isSquare ? '18px 40px' : '22px 48px';
    const btnMarginTop = isSquare ? '8px' : '12px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${preHeaderSize}; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${topGap}; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-start; gap: ${flexGap};">
          <div style="font-family: ${FONTS.fraunces}; font-weight: 500; font-size: ${headlineSize}; color: var(--text-default); line-height: 1.14;">
            ${headlineWrapped}
          </div>
          <div style="width: ${bodyWidth}; font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
            ${bodyWrapped}
          </div>
          <div style="margin-top: ${btnMarginTop}; display: inline-flex; align-self: flex-start; align-items: center; gap: 16px; background: var(--text-highlight); color: var(--background); font-family: ${FONTS.lato}; font-weight: 700; font-size: ${btnFont}; letter-spacing: 0.04em; padding: ${btnPadding}; border-radius: 999px;">
            FOLLOW
            <span style="font-size: ${btnArrow};">&#8594;</span>
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-4') {
    const preHeaderSize = isSquare ? '22px' : '26px';
    const preHeaderLetterSpacing = isSquare ? '4px' : '5px';
    const headlineSize = isSquare ? '72px' : '88px';
    const bodySize = isSquare ? '28px' : '34px';
    const gap = isSquare ? '30px' : '40px';
    const btnPadding = isSquare ? '18px 36px' : '22px 44px';
    const btnFontSize = isSquare ? '24px' : '28px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: ${gap};">
        <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${preHeaderSize}; letter-spacing: ${preHeaderLetterSpacing}; text-transform: uppercase; color: var(--background-2);">
          ${preHeaderWrapped}
        </div>
        <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${headlineSize}; line-height: 1.08; letter-spacing: -2px; color: var(--text-highlight);">
          ${headlineWrapped}
        </div>
        <div style="font-family: ${FONTS.inter}; font-weight: 400; font-size: ${bodySize}; line-height: 1.5; color: var(--text-default); max-width: ${isSquare ? '700px' : '740px'};">
          ${bodyWrapped}
        </div>
        <div style="display: inline-flex; align-self: flex-start; align-items: center; padding: ${btnPadding}; border: 2px solid var(--background-2); border-radius: 999px; font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${btnFontSize}; color: var(--background-2);">
          ${footerWrapped}
        </div>
      </div>
    `;
  }

  return '';
};
