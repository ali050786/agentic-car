import { FONTS } from '../tokens';
import { BlockRenderParams } from './heroBlock';

export interface ListBlockRenderParams extends BlockRenderParams {
  listItems?: Array<string | { bullet?: string; description?: string }>;
}

export const renderListItemsHtml = (
  templateId: string,
  isSquare: boolean,
  listItems?: Array<string | { bullet?: string; description?: string }>
): string => {
  if (!listItems || listItems.length === 0) return '';

  if (templateId === 'template-1') {
    const listFontSize = isSquare ? '28px' : '31px';
    const listIdxSize = isSquare ? '24px' : '26px';

    return listItems
      .map((item, itemIndex) => {
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] + ':' : '';
          desc = parts.length > 1 ? parts.slice(1).join(':') : item;
        } else if (typeof item === 'object' && item !== null) {
          title = item.bullet || '';
          desc = item.description || '';
        }

        return `
          ${itemIndex > 0 ? '<div style="height: 1px; background: var(--text-default); opacity: 0.2;"></div>' : ''}
          <div style="display: flex; align-items: flex-start; gap: 30px; padding: ${isSquare ? '22px' : '28px'} 0;">
            <div style="font-family: ${FONTS.mono}; font-weight: 700; font-size: ${listIdxSize}; color: var(--background-2); min-width: 52px; padding-top: 4px;">${String(itemIndex + 1).padStart(2, '0')}</div>
            <div data-edit-field="listItem" data-edit-index="${itemIndex}" contenteditable="true" spellcheck="false" style="font-family: ${FONTS.lato}; font-weight: 400; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.45;">
              ${title ? `<span style="color: var(--text-highlight); font-weight: 700;">${title}</span>` : ''}
              ${desc}
            </div>
          </div>
        `;
      })
      .join('');
  }

  if (templateId === 'template-3') {
    const listFontSize = isSquare ? '26px' : '30px';
    const checkSize = isSquare ? '30px' : '34px';

    return listItems
      .map((item, itemIndex) => {
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] + ':' : '';
          desc = parts.length > 1 ? parts.slice(1).join(':') : item;
        } else if (typeof item === 'object' && item !== null) {
          title = item.bullet || '';
          desc = item.description || '';
        }

        return `
          <div style="display: flex; align-items: flex-start; gap: 22px; font-family: ${FONTS.lato}; font-weight: 400; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.45;">
            <div style="min-width: ${checkSize}; font-size: ${checkSize}; line-height: 1.1; color: var(--text-highlight); font-weight: 700;">&#10003;</div>
            <div data-edit-field="listItem" data-edit-index="${itemIndex}" contenteditable="true" spellcheck="false">
              ${title ? `<span style="font-weight: 700;">${title}</span>` : ''}
              ${desc}
            </div>
          </div>
        `;
      })
      .join('');
  }

  if (templateId === 'template-4') {
    const listFontSize = isSquare ? '28px' : '32px';
    const listNumSize = isSquare ? '26px' : '30px';

    return listItems
      .map((item, itemIndex) => {
        let title = '';
        let desc = '';

        if (typeof item === 'string') {
          const parts = item.split(':');
          title = parts.length > 1 ? parts[0] : '';
          desc = parts.length > 1 ? parts.slice(1).join(':').trim() : item;
        } else if (typeof item === 'object' && item !== null) {
          title = (item.bullet || '').replace(/:$/, '');
          desc = item.description || '';
        }

        return `
          <div style="height: 1px; background: var(--text-default); opacity: 0.3;"></div>
          <div style="display: flex; align-items: flex-start; gap: 32px; padding: ${isSquare ? '24px' : '30px'} 0;">
            <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${listNumSize}; color: var(--background-2); min-width: 56px;">${String(itemIndex + 1).padStart(2, '0')}</div>
            <div data-edit-field="listItem" data-edit-index="${itemIndex}" contenteditable="true" spellcheck="false" style="font-family: ${FONTS.inter}; font-weight: 400; font-size: ${listFontSize}; color: var(--text-default); line-height: 1.45;">
              ${title ? `<span style="color: var(--text-highlight); font-weight: 500;">${title}.</span> ` : ''}${desc}
            </div>
          </div>
        `;
      })
      .join('');
  }

  return '';
};

export const renderListBlock = ({
  templateId,
  isSquare,
  slideNum,
  preHeader,
  headlineHtml,
  listItems,
  wrapEditable,
}: ListBlockRenderParams): string => {
  const preHeaderWrapped = preHeader ? wrapEditable('preHeader', preHeader) : '';
  const headlineWrapped = wrapEditable('headline', headlineHtml);
  const listItemsHtml = renderListItemsHtml(templateId, isSquare, listItems);

  if (templateId === 'template-1') {
    const kickerSize = isSquare ? '23px' : '26px';
    const kickerHeight = isSquare ? '30px' : '34px';
    const headlineSize = isSquare ? '62px' : '76px';
    const gap = isSquare ? '36px' : '54px';

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
          <div style="display: flex; flex-direction: column;">
            ${listItemsHtml}
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
    const flexGap = isSquare ? '28px' : '36px';
    const listGap = isSquare ? '20px' : '28px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="position: relative; width: 100%; height: 100%;">
        <div style="position: absolute; top: 0; left: 0; font-family: ${FONTS.lato}; font-weight: 700; font-size: ${preHeaderSize}; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-highlight); line-height: 1;">${preHeaderWrapped}</div>

        <div style="position: absolute; top: ${topGap}; left: 0; width: 880px; display: flex; flex-direction: column; align-items: flex-start; gap: ${flexGap};">
          <div style="font-family: ${FONTS.fraunces}; font-weight: 500; font-size: ${headlineSize}; color: var(--text-default); line-height: 1.15;">
            ${headlineWrapped}
          </div>
          <div style="display: flex; flex-direction: column; gap: ${listGap}; width: 100%;">
            ${listItemsHtml}
          </div>
        </div>
      </div>
    `;
  }

  if (templateId === 'template-4') {
    const preHeaderSize = isSquare ? '22px' : '26px';
    const preHeaderLetterSpacing = isSquare ? '4px' : '5px';
    const headlineSize = isSquare ? '60px' : '70px';
    const gap = isSquare ? '28px' : '40px';

    return `
      <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; flex-direction: column; justify-content: center; height: 100%; gap: ${gap};">
        <div style="font-family: ${FONTS.inter}; font-weight: 500; font-size: ${preHeaderSize}; letter-spacing: ${preHeaderLetterSpacing}; text-transform: uppercase; color: var(--background-2);">
          ${preHeaderWrapped}
        </div>
        <div style="font-family: ${FONTS.spaceGrotesk}; font-weight: 700; font-size: ${headlineSize}; line-height: 1.12; letter-spacing: -2px; color: var(--text-highlight);">
          ${headlineWrapped}
        </div>
        <div style="display: flex; flex-direction: column;">
          ${listItemsHtml}
        </div>
      </div>
    `;
  }

  return '';
};
