import { SlideContent, CarouselTheme, CarouselFormat, BrandingConfig } from '../../types';
import { imageUrlToBase64 } from '../imageUtils';
import { generatePatternPNG } from '../patternGenerator';

export const generateTemplate3Native = async (
    slide: SlideContent,
    theme: CarouselTheme,
    branding?: BrandingConfig,
    format: CarouselFormat = 'portrait',
    patternId?: number,
    userPatternOpacity?: number,
    patternScale: number = 1,
    patternSpacing: number = 1
): Promise<string> => {
    // Theme and Format Setup
    const bg = '#FFFFFF'; // Template-3 always uses pure white background
    const textHighlight = theme.textHighlight || '#9333EA';
    const textDefault = theme.textDefault || '#1E1B4B';
    const background2 = theme.background2 || '#055569';
    const patternColor = theme.patternColor || '#E0E7FF';
    const patternOpacity = userPatternOpacity !== undefined ? userPatternOpacity : parseFloat(theme.patternOpacity || '0.1');

    const WIDTH = 1080;
    const HEIGHT = format === 'square' ? 1080 : 1380;
    const isSquare = format === 'square';

    // Rocket Doodle Image Embedding
    const rocketUrl = "https://image.pollinations.ai/prompt/A%20simple%20blackpencil%20doodle%20sketch%20of%20a%20rocket%20ship%20launching%20upwards%20representing%20startup%20growth%20isolated%20on%20strict%20pure%20white%20background%20%23FFFFFF?width=600&height=1000&nologo=true";
    let rocketBase64 = '';
    try {
        rocketBase64 = await imageUrlToBase64(rocketUrl);
    } catch (e) {
        console.warn('Failed to fetch rocket doodle for Figma:', e);
    }

    // Text Wrapping Logic
    const wrapText = (text: string, maxChars: number) => {
        const words = text.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach(word => {
            if ((currentLine + word).length > maxChars) {
                lines.push(currentLine.trim());
                currentLine = word + ' ';
            } else {
                currentLine += word + ' ';
            }
        });
        lines.push(currentLine.trim());
        return lines;
    };

    // Content processing
    const preHeaderLines = wrapText(slide.preHeader || '', 40);
    const headlineLines = wrapText(slide.headline || '', 22);
    const bodyLines = wrapText(slide.body || '', 35);

    let contentSvg = '';
    let currentY = isSquare ? 200 : 250;

    // Shift down if top signature is active
    if (branding && branding.enabled && (branding.position === 'top-left' || branding.position === 'top-right')) {
        currentY += 60;
    }

    // Preheader
    preHeaderLines.forEach((line, i) => {
        contentSvg += `<text x="100" y="${currentY + (i * 40)}" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${textDefault}">${line.toUpperCase()}</text>`;
    });
    currentY += preHeaderLines.length * 50;

    headlineLines.forEach((line, i) => {
        contentSvg += `<text x="95" y="${currentY + (i * (isSquare ? 70 : 80))}" font-family="Fredericka the Great, cursive" font-weight="200" font-size="66" fill="${textHighlight}">${line.toUpperCase()}</text>`;
    });
    currentY += headlineLines.length * (isSquare ? 80 : 90);

    // Body / List
    if (slide.variant === 'list' && slide.listItems) {
        slide.listItems.forEach((item, i) => {
            let text = '';
            if (typeof item === 'string') text = item;
            else if (item && typeof item === 'object') text = `${item.bullet}: ${item.description}`;

            const lines = wrapText(text, 40);
            lines.forEach((line, j) => {
                contentSvg += `<text x="100" y="${currentY + (j * 35)}" font-family="Lato, sans-serif" font-weight="400" font-size="28" fill="${textDefault}">${j === 0 ? '• ' : '  '}${line}</text>`;
            });
            currentY += lines.length * 40 + 10;
        });
    } else {
        bodyLines.forEach((line, i) => {
            contentSvg += `<text x="100" y="${currentY + (i * 45)}" font-family="Lato, sans-serif" font-weight="300" font-size="32" fill="${textDefault}">${line}</text>`;
        });
    }

    // Swipe component logic
    const swipeY = HEIGHT - 140;
    const swipeX = WIDTH - 140;
    const swipeSvg = `
    <g transform="translate(${swipeX}, ${swipeY})">
       <circle r="50" fill="${background2}"/>
       <g fill="none" stroke="${bg}" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
          <path d="M-20 0 H 20"/>
          <path d="M 8 -12 L 20 0 L 8 12"/>
       </g>
    </g>
  `;

    // CTA specific logic
    let ctaSvg = '';
    if (slide.variant === 'cta' || slide.variant === 'closing') {
        const buttonY = isSquare ? 750 : 960;
        ctaSvg = `
        <g transform="translate(100, ${buttonY})">
            <rect width="292" height="125" fill="${textHighlight}"/>
            <text x="146" y="75" font-family="Lato, sans-serif" font-weight="700" font-size="32" fill="${bg}" text-anchor="middle">FOLLOW US</text>
        </g>
      `;
    }

    // Signature Card logic
    let signatureSvg = '';
    if (branding && branding.enabled) {
        try {
            const imageBase64 = await imageUrlToBase64(branding.imageUrl);
            const pos = isSquare ? { x: 80, y: 860 } : { x: 80, y: 1120 };
            const clipId = `clip-t3-${Date.now()}`;
            signatureSvg = `
            <defs>
              <clipPath id="${clipId}">
                <circle cx="46" cy="46" r="44"/>
              </clipPath>
            </defs>
            <g transform="translate(${pos.x}, ${pos.y})">
              <circle fill="${textHighlight}" cx="46" cy="46" r="44"/>
              <image x="2" y="2" width="88" height="88" href="${imageBase64}" clip-path="url(#${clipId})" preserveAspectRatio="xMidYMid slice"/>
              <text fill="${textHighlight}" font-family="Lato, sans-serif" font-size="28" font-weight="500" x="106" y="44">${branding.name}</text>
              <text fill="${textDefault}" font-family="Lato, sans-serif" font-size="24" x="106" y="74">${branding.title}</text>
            </g>
          `;
        } catch (e) {
            console.error('Failed to generate signature for Template 3 Figma:', e);
        }
    }
    const bottomRectY = isSquare ? 860 : 1104.56;
    const bottomRectSvg = `<rect x="0" y="${bottomRectY}" width="${WIDTH}" height="${isSquare ? 220 : 275}" fill="${background2}" opacity="0.2"/>`;

    return `
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${WIDTH}" height="${HEIGHT}" fill="${bg}"/>
      ${rocketBase64 ? `<image href="${rocketBase64}" x="${WIDTH - 550}" y="${HEIGHT - 950}" width="600" height="1000" opacity="0.6" />` : ''}
      ${bottomRectSvg}
      ${contentSvg}
      ${slide.variant !== 'cta' && slide.variant !== 'closing' ? swipeSvg : ''}
      ${ctaSvg}
      ${signatureSvg}
    </svg>
  `;
};
