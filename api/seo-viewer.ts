import type { VercelRequest, VercelResponse } from '@vercel/node';
import fs from 'fs';
import path from 'path';
import { databasesServer, serverConfig } from '../lib/appwriteServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;

    let carouselTitle = 'Agentic Carousel Generator';
    let carouselDesc = 'Generate high-converting, beautiful social media carousels for LinkedIn, Instagram, and Twitter in seconds using AI.';
    let carouselImage = 'https://carousel.blinkwiser.com/assets/og-image.png';

    // 1. Fetch public carousel details if ID is provided
    if (id && typeof id === 'string') {
        try {
            const document = await databasesServer.getDocument(
                serverConfig.databaseId,
                serverConfig.carouselsCollectionId,
                id
            );

            if (document && document.isPublic) {
                carouselTitle = `${document.title} | Agentic Carousel`;

                // Parse slides to extract rich description and image
                const slides = JSON.parse(document.slides as string || '[]');
                if (slides.length > 0) {
                    const firstSlide = slides[0];
                    let textDesc = firstSlide.headline || '';
                    if (firstSlide.body) {
                        textDesc += textDesc ? ` - ${firstSlide.body}` : firstSlide.body;
                    }
                    if (textDesc) {
                        carouselDesc = textDesc;
                    }

                    // Look for the first generated image doodle
                    for (const slide of slides) {
                        if (slide.doodleUrl) {
                            carouselImage = slide.doodleUrl;
                            break;
                        }
                    }
                }

                // Limit description length for SEO standards
                if (carouselDesc.length > 160) {
                    carouselDesc = carouselDesc.substring(0, 157) + '...';
                }
            }
        } catch (error) {
            console.error('[SEO Viewer API] Failed to fetch carousel from Appwrite:', error);
            // Non-blocking fallback to default values if document doesn't exist
        }
    }

    // 2. Load the base index.html file
    let html = '';
    try {
        const indexPath = path.join(process.cwd(), 'index.html');
        html = fs.readFileSync(indexPath, 'utf8');
    } catch (e) {
        try {
            const distPath = path.join(process.cwd(), 'dist/index.html');
            html = fs.readFileSync(distPath, 'utf8');
        } catch (err) {
            // Hardcoded HTML structure as the absolute fallback
            html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agentic Carousel Generator</title>
  <meta name="description" content="Generate high-converting, beautiful social media carousels for LinkedIn, Instagram, and Twitter in seconds using AI. Customize themes, colors, and layout instantly." />
  <meta name="keywords" content="linkedin carousel kaise banaye, linkedin carousel tips, linkedin post design, ai se content creation, ai content creator tools, ai se social media post, personal branding linkedin india, personal branding tips linkedin, linkedin profile grow kaise kare, social media carousel design guide, carousel design tips, social media slide design, canva vs ai carousel tools, canva alternative for carousel, linkedin marketing tools, startup linkedin marketing, solopreneur content marketing, agentic ai tools review, linkedin engagement badhane ke tips, linkedin post viral kaise kare" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://carousel.blinkwiser.com/" />
  <!--SEO_DYNAMIC_METADATA-->
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
        }
    }

    // 3. Inject custom social and SEO tag values
    const currentId = typeof id === 'string' ? id : '';
    const shareUrl = `https://carousel.blinkwiser.com/view/${currentId}`;

    const metaTags = `
  <!-- Dynamic Open Graph tags -->
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:title" content="${carouselTitle}" />
  <meta property="og:description" content="${carouselDesc}" />
  <meta property="og:image" content="${carouselImage}" />

  <!-- Dynamic Twitter Card tags -->
  <meta property="twitter:url" content="${shareUrl}" />
  <meta property="twitter:title" content="${carouselTitle}" />
  <meta property="twitter:description" content="${carouselDesc}" />
  <meta property="twitter:image" content="${carouselImage}" />
`;

    const updatedHtml = html
        .replace('<title>Agentic Carousel Generator - Create Beautiful Social Media Carousels</title>', `<title>${carouselTitle}</title>`)
        .replace('<meta name="description" content="Generate high-converting, beautiful social media carousels for LinkedIn, Instagram, and Twitter in seconds using AI. Customize themes, colors, and layout instantly." />', `<meta name="description" content="${carouselDesc}" />`)
        .replace('<link rel="canonical" href="https://carousel.blinkwiser.com/" />', `<link rel="canonical" href="${shareUrl}" />`)
        .replace('<!--SEO_DYNAMIC_METADATA-->', metaTags);

    // 4. Return HTML response
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(updatedHtml);
}
