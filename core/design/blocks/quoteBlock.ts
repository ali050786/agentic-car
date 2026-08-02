import { FONTS } from '../tokens';

export interface QuoteBlockRenderParams {
  templateId: string;
  isSquare: boolean;
  slideNum: string;
  preHeader?: string;
  headlineHtml: string;
  body?: string;
  quoteAuthor?: string;
  wrapEditable: (field: string, inner: string, extraAttrs?: string) => string;
}

export const renderQuoteBlock = ({
  templateId,
  isSquare,
  slideNum,
  preHeader,
  headlineHtml,
  body,
  quoteAuthor,
  wrapEditable,
}: QuoteBlockRenderParams): string => {
  const preHeaderWrapped = preHeader ? wrapEditable('preHeader', preHeader) : '';
  const quoteText = body || headlineHtml || '';
  const quoteWrapped = wrapEditable('body', quoteText);
  const authorText = quoteAuthor ? `— ${quoteAuthor}` : '';
  const authorWrapped = quoteAuthor ? wrapEditable('quoteAuthor', authorText) : '';

  if (templateId === 'template-1') {
    const quoteSize = isSquare ? '42px' : '52px';
    const authorSize = isSquare ? '26px' : '30px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%; font-family: ${FONTS.mono}; font-weight: 500; font-size: ${isSquare ? '23px' : '26px'}; color: var(--text-default);">
          <div>${preHeaderWrapped}</div>
          <div style="opacity: 0.55;">/${slideNum}</div>
        </div>

        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; gap: ${isSquare ? '24px' : '32px'}; border-left: 4px solid var(--background-2); padding-left: ${isSquare ? '28px' : '36px'};">
          <div style="font-family: ${FONTS.fraunces}; font-style: italic; font-weight: 500; font-size: ${quoteSize}; line-height: 1.35; color: var(--text-highlight);">
            "${quoteWrapped}"
          </div>
          <div style="font-family: ${FONTS.mono}; font-weight: 700; font-size: ${authorSize}; color: var(--background-2);">
            ${authorWrapped}
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-3') {
    const quoteSize = isSquare ? '40px' : '48px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${isSquare ? '22px' : '24px'}; text-transform: uppercase; color: var(--text-highlight);">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${isSquare ? '64px' : '76px'}; left: 0; width: 880px; display: flex; flex-direction: column; gap: ${isSquare ? '22px' : '28px'};">
          <div style="font-family: ${FONTS.fraunces}; font-style: italic; font-weight: 500; font-size: ${quoteSize}; color: var(--text-default); line-height: 1.35;">
            "${quoteWrapped}"
          </div>
          <div style="font-family: ${FONTS.lato}; font-weight: 700; font-size: ${isSquare ? '24px' : '28px'}; color: var(--text-highlight);">
            ${authorWrapped}
          </div>
        </div>
      </div>
    `;
  }

  // Template 4 default
  const quoteSize = isSquare ? '40px' : '50px';

  return `
    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: ${isSquare ? '24px' : '32px'};">
      <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${isSquare ? '22px' : '26px'}; text-transform: uppercase; color: var(--background-2);">${preHeaderWrapped}</div>
      <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${quoteSize}; line-height: 1.3; color: var(--text-highlight); border-left: 3px solid var(--background-2); padding-left: 28px;">
        "${quoteWrapped}"
      </div>
      <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${isSquare ? '24px' : '28px'}; color: var(--background-2); padding-left: 28px;">
        ${authorWrapped}
      </div>
    </div>
  `;
};
