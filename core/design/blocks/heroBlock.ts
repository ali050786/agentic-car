import { FONTS } from '../tokens';

export interface BlockRenderParams {
  templateId: string;
  isSquare: boolean;
  slideNum: string;
  preHeader?: string;
  headlineHtml: string;
  body?: string;
  wrapEditable: (field: string, inner: string, extraAttrs?: string) => string;
}

export const renderHeroBlock = ({
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
    const numSize = isSquare ? '230px' : '300px';
    const headlineSize = isSquare ? '82px' : '104px';
    const bodySize = isSquare ? '29px' : '32px';
    const divWidth = isSquare ? '64px' : '74px';
    const divHeight = isSquare ? '5px' : '6px';
    const gap = isSquare ? '36px' : '46px';
    const maxW = isSquare ? '640px' : '660px';
    const ghostTop = isSquare ? '20px' : '40px';
    const ghostRight = isSquare ? '-16px' : '-20px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="position: absolute; top: ${ghostTop}; right: ${ghostRight}; font-family: ${FONTS.interTight}; font-weight: 900; font-size: ${numSize}; line-height: 1; color: var(--text-highlight); opacity: 0.05; pointer-events: none;">${slideNum}</div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: ${FONTS.mono}; font-weight: 500; font-size: ${kickerSize}; line-height: ${kickerHeight}; color: var(--text-default); overflow: visible;">
          <div style="min-width: 0; overflow: visible; height: ${kickerHeight};">
            <span style="display: inline-block; letter-spacing: 0.22em; text-transform: uppercase; white-space: nowrap; overflow: visible; line-height: ${kickerHeight}; height: ${kickerHeight};">${preHeaderWrapped}</span>
          </div>
          <div style="opacity: 0.55; flex-shrink: 0; line-height: ${kickerHeight}; height: ${kickerHeight};">/${slideNum}</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${gap};">
          <div style="font-family: ${FONTS.interTight}; font-weight: 800; font-size: ${headlineSize}; line-height: 1.04; letter-spacing: -0.025em; color: var(--text-highlight);">
            ${headlineWrapped}
          </div>
          <div style="width: ${divWidth}; height: ${divHeight}; background: var(--background-2);"></div>
          <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; line-height: 1.5; color: var(--text-default); max-width: ${maxW};">
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
    const headlineSize = isSquare ? '68px' : '78px';
    const bodySize = isSquare ? '26px' : '30px';
    const bodyWidth = isSquare ? '480px' : '520px';
    const contentGap = isSquare ? '24px' : '32px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${preHeaderSize}; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${topGap}; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-start; gap: ${contentGap};">
          <div style="font-family: ${FONTS.fraunces}; font-weight: 500; font-size: ${headlineSize}; color: var(--text-default); line-height: 1.14;">
            ${headlineWrapped}
          </div>
          <div style="width: ${bodyWidth}; font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; color: var(--text-default); opacity: 0.82; line-height: 1.5;">
            ${bodyWrapped}
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-4') {
    const preHeaderSize = isSquare ? '24px' : '28px';
    const preHeaderLetterSpacing = isSquare ? '5px' : '6px';
    const headlineSize = isSquare ? '80px' : '96px';
    const bodySize = isSquare ? '30px' : '36px';
    const maxW = isSquare ? '720px' : '760px';
    const gap = isSquare ? '30px' : '38px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: flex-end; height: 100%; gap: ${gap};">
        <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${preHeaderSize}; letter-spacing: ${preHeaderLetterSpacing}; text-transform: uppercase; color: var(--background-2);">
          ${preHeaderWrapped}
        </div>
        <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${headlineSize}; line-height: 1.06; letter-spacing: -3px; color: var(--text-highlight);">
          ${headlineWrapped}
        </div>
        <div style="font-family: ${FONTS.inter}; font-weight: 400; font-size: ${bodySize}; line-height: 1.5; color: var(--text-default); max-width: ${maxW};">
          ${bodyWrapped}
        </div>
      </div>
    `;
  }

  return '';
};
