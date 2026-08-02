import { FONTS } from '../tokens';

export interface StatBlockRenderParams {
  templateId: string;
  isSquare: boolean;
  slideNum: string;
  preHeader?: string;
  headlineHtml: string;
  statNumber?: string;
  statLabel?: string;
  body?: string;
  wrapEditable: (field: string, inner: string, extraAttrs?: string) => string;
}

export const renderStatBlock = ({
  templateId,
  isSquare,
  slideNum,
  preHeader,
  headlineHtml,
  statNumber,
  statLabel,
  body,
  wrapEditable,
}: StatBlockRenderParams): string => {
  const preHeaderWrapped = preHeader ? wrapEditable('preHeader', preHeader) : '';
  const bodyWrapped = body ? wrapEditable('body', body) : '';
  const numberText = statNumber || headlineHtml || '100%';
  const labelText = statLabel || headlineHtml || '';
  const numberWrapped = wrapEditable('statNumber', numberText);
  const labelWrapped = wrapEditable('statLabel', labelText);

  if (templateId === 'template-1') {
    const statSize = isSquare ? '120px' : '160px';
    const labelSize = isSquare ? '36px' : '44px';
    const bodySize = isSquare ? '28px' : '32px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: ${FONTS.mono}; font-weight: 500; font-size: ${isSquare ? '23px' : '26px'}; color: var(--text-default);">
          <div>${preHeaderWrapped}</div>
          <div style="opacity: 0.55;">/${slideNum}</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${isSquare ? '24px' : '36px'};">
          <div style="font-family: ${FONTS.interTight}; font-weight: 900; font-size: ${statSize}; line-height: 1; color: var(--background-2); letter-spacing: -0.04em;">
            ${numberWrapped}
          </div>
          <div style="font-family: ${FONTS.interTight}; font-weight: 800; font-size: ${labelSize}; line-height: 1.1; color: var(--text-highlight);">
            ${labelWrapped}
          </div>
          <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${bodySize}; line-height: 1.5; color: var(--text-default); max-width: 680px;">
            ${bodyWrapped}
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-3') {
    const statSize = isSquare ? '100px' : '130px';
    const labelSize = isSquare ? '34px' : '40px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${isSquare ? '22px' : '24px'}; text-transform: uppercase; color: var(--text-highlight);">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${isSquare ? '64px' : '76px'}; left: 0; width: 880px; display: flex; flex-direction: column; gap: ${isSquare ? '20px' : '28px'};">
          <div style="font-family: ${FONTS.fraunces}; font-weight: 600; font-size: ${statSize}; color: var(--text-highlight); line-height: 1;">
            ${numberWrapped}
          </div>
          <div style="font-family: ${FONTS.fraunces}; font-weight: 500; font-size: ${labelSize}; color: var(--text-default); line-height: 1.2;">
            ${labelWrapped}
          </div>
          <div style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${isSquare ? '26px' : '30px'}; color: var(--text-default); opacity: 0.85; line-height: 1.5;">
            ${bodyWrapped}
          </div>
        </div>
      </div>
    `;
  }

  // Template 4 default
  const statSize = isSquare ? '110px' : '140px';
  const labelSize = isSquare ? '36px' : '44px';

  return `
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: ${isSquare ? '24px' : '32px'};">
      <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${isSquare ? '22px' : '26px'}; text-transform: uppercase; color: var(--background-2);">${preHeaderWrapped}</div>
      <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${statSize}; line-height: 1; color: var(--background-2); letter-spacing: -3px;">
        ${numberWrapped}
      </div>
      <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${labelSize}; line-height: 1.1; color: var(--text-highlight);">
        ${labelWrapped}
      </div>
      <div style="font-family: ${FONTS.inter}; font-weight: 400; font-size: ${isSquare ? '28px' : '34px'}; line-height: 1.5; color: var(--text-default);">
        ${bodyWrapped}
      </div>
    </div>
  `;
};
