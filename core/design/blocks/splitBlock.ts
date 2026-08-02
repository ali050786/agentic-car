import { FONTS } from '../tokens';

export interface SplitBlockRenderParams {
  templateId: string;
  isSquare: boolean;
  slideNum: string;
  preHeader?: string;
  headlineHtml: string;
  splitLeft?: string;
  splitRight?: string;
  body?: string;
  wrapEditable: (field: string, inner: string, extraAttrs?: string) => string;
}

export const renderSplitBlock = ({
  templateId,
  isSquare,
  slideNum,
  preHeader,
  headlineHtml,
  splitLeft,
  splitRight,
  body,
  wrapEditable,
}: SplitBlockRenderParams): string => {
  const preHeaderWrapped = preHeader ? wrapEditable('preHeader', preHeader) : '';
  const headlineWrapped = wrapEditable('headline', headlineHtml);
  const leftText = splitLeft || headlineHtml || '';
  const rightText = splitRight || body || '';
  const leftWrapped = wrapEditable('splitLeft', leftText);
  const rightWrapped = wrapEditable('splitRight', rightText);

  if (templateId === 'template-1') {
    const titleSize = isSquare ? '52px' : '64px';
    const textSize = isSquare ? '26px' : '30px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: ${FONTS.mono}; font-weight: 500; font-size: ${isSquare ? '23px' : '26px'}; color: var(--text-default);">
          <div>${preHeaderWrapped}</div>
          <div style="opacity: 0.55;">/${slideNum}</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${isSquare ? '24px' : '32px'};">
          <div style="font-family: ${FONTS.interTight}; font-weight: 800; font-size: ${titleSize}; line-height: 1.1; color: var(--text-highlight);">
            ${headlineWrapped}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${isSquare ? '24px' : '32px'}; background: rgba(255, 255, 255, 0.03); border-radius: 16px; padding: ${isSquare ? '24px' : '32px'}; border: 1px solid rgba(255, 255, 255, 0.08);">
            <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${textSize}; color: var(--background-2); line-height: 1.45;">
              ${leftWrapped}
            </div>
            <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${textSize}; color: var(--text-default); line-height: 1.45; border-left: 1px solid rgba(255, 255, 255, 0.1); padding-left: ${isSquare ? '20px' : '28px'};">
              ${rightWrapped}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-3') {
    const titleSize = isSquare ? '48px' : '56px';
    const textSize = isSquare ? '24px' : '28px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${isSquare ? '22px' : '24px'}; text-transform: uppercase; color: var(--text-highlight);">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${isSquare ? '64px' : '76px'}; left: 0; width: 880px; display: flex; flex-direction: column; gap: ${isSquare ? '20px' : '28px'};">
          <div style="font-family: ${FONTS.fraunces}; font-weight: 500; font-size: ${titleSize}; color: var(--text-default); line-height: 1.15;">
            ${headlineWrapped}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${isSquare ? '24px' : '32px'}; background: var(--background-2); opacity: 0.9; border-radius: 12px; padding: ${isSquare ? '24px' : '32px'};">
            <div style="font-family: ${FONTS.lato}; font-weight: 700; font-size: ${textSize}; color: var(--text-default); line-height: 1.45;">
              ${leftWrapped}
            </div>
            <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${textSize}; color: var(--text-default); line-height: 1.45; border-left: 1px solid rgba(0, 0, 0, 0.15); padding-left: ${isSquare ? '20px' : '28px'};">
              ${rightWrapped}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Template 4 default
  const titleSize = isSquare ? '48px' : '58px';
  const textSize = isSquare ? '26px' : '30px';

  return `
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: ${isSquare ? '24px' : '32px'};">
      <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${isSquare ? '22px' : '26px'}; text-transform: uppercase; color: var(--background-2);">${preHeaderWrapped}</div>
      <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${titleSize}; line-height: 1.1; color: var(--text-highlight);">
        ${headlineWrapped}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: ${isSquare ? '24px' : '32px'}; border-top: 1px solid var(--text-default); padding-top: 24px;">
        <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${textSize}; color: var(--background-2); line-height: 1.45;">
          ${leftWrapped}
        </div>
        <div style="font-family: ${FONTS.inter}; font-weight: 400; font-size: ${textSize}; color: var(--text-default); line-height: 1.45; border-left: 1px solid rgba(255, 255, 255, 0.15); padding-left: 24px;">
          ${rightWrapped}
        </div>
      </div>
    </div>
  `;
};
