import { FONTS } from '../tokens';
import { BlockRenderParams } from './heroBlock';

export const renderBodyBlock = ({
  templateId,
  isSquare,
  slideNum,
  preHeader,
  headlineHtml,
  body,
  wrapEditable,
}: BlockRenderParams): string => {
  const preHeaderWrapped = preHeader ? wrapEditable('preHeader', preHeader) : '';
  const bodyWrapped = body ? wrapEditable('body', body) : '';
  const headlineWrapped = wrapEditable('headline', headlineHtml);

  if (templateId === 'template-1') {
    const kickerSize = isSquare ? '23px' : '26px';
    const kickerHeight = isSquare ? '30px' : '34px';
    const headlineSize = isSquare ? '66px' : '84px';
    const bodySize = isSquare ? '30px' : '34px';
    const bodyLineHeight = isSquare ? '1.5' : '1.55';
    const divWidth = isSquare ? '64px' : '74px';
    const divHeight = isSquare ? '5px' : '6px';
    const gap = isSquare ? '34px' : '44px';
    const maxW = isSquare ? '700px' : '720px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: ${FONTS.mono}; font-weight: 500; font-size: ${kickerSize}; line-height: ${kickerHeight}; color: var(--text-default); overflow: visible;">
          <div style="min-width: 0; overflow: visible; height: ${kickerHeight};">
            <span style="display: inline-block; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap; overflow: visible; line-height: ${kickerHeight}; height: ${kickerHeight};">${preHeaderWrapped}</span>
          </div>
          <div style="opacity: 0.55; flex-shrink: 0; line-height: ${kickerHeight}; height: ${kickerHeight};">/${slideNum}</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${gap};">
          <div style="font-family: ${FONTS.interTight}; font-weight: 800; font-size: ${headlineSize}; line-height: 1.08; letter-spacing: -0.02em; color: var(--text-highlight);">
            ${headlineWrapped}
          </div>
          <div style="width: ${divWidth}; height: ${divHeight}; background: var(--background-2);"></div>
          <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; line-height: ${bodyLineHeight}; color: var(--text-default); max-width: ${maxW};">
            ${bodyWrapped}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: ${isSquare ? '18px' : '20px'}; width: 100%;">
          <div style="flex: 1; height: 1px; background: var(--text-default); opacity: 0.25;"></div>
          <div style="font-family: ${FONTS.mono}; font-weight: 700; font-size: ${isSquare ? '22px' : '24px'}; letter-spacing: 0.22em; color: var(--text-highlight);">SWIPE&#160;&#8594;</div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-3') {
    const preHeaderSize = isSquare ? '22px' : '24px';
    const topGap = isSquare ? '64px' : '76px';
    const headlineSize = isSquare ? '54px' : '64px';
    const bodySize = isSquare ? '26px' : '30px';
    const containerW = isSquare ? '500px' : '540px';
    const bodyW = isSquare ? '480px' : '520px';
    const flexGap = isSquare ? '20px' : '28px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${preHeaderSize}; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${topGap}; right: 0; width: ${containerW}; display: flex; flex-direction: column; align-items: flex-start; gap: ${flexGap};">
          <div style="font-family: ${FONTS.fraunces}; font-weight: 500; font-size: ${headlineSize}; color: var(--text-default); line-height: 1.15;">
            ${headlineWrapped}
          </div>
          <div style="width: ${bodyW}; font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
            ${bodyWrapped}
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-4') {
    const preHeaderSize = isSquare ? '22px' : '26px';
    const preHeaderLetterSpacing = isSquare ? '4px' : '5px';
    const headlineSize = isSquare ? '64px' : '74px';
    const bodySize = isSquare ? '32px' : '38px';
    const gap = isSquare ? '32px' : '44px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: ${gap};">
        <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${preHeaderSize}; letter-spacing: ${preHeaderLetterSpacing}; text-transform: uppercase; color: var(--background-2);">
          ${preHeaderWrapped}
        </div>
        <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${headlineSize}; line-height: 1.12; letter-spacing: -2px; color: var(--text-highlight);">
          ${headlineWrapped}
        </div>
        <div style="font-family: ${FONTS.inter}; font-weight: 400; font-size: ${bodySize}; line-height: 1.55; color: var(--text-default);">
          ${bodyWrapped}
        </div>
      </div>
    `;
  }

  return '';
};
