import type { VercelRequest, VercelResponse } from '@vercel/node';
import { databasesServer, serverConfig, Query } from '../lib/appwriteServer.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const baseUrl = 'https://carousel.blinkwiser.com';
    const currentDate = new Date().toISOString().split('T')[0];

    // 1. Core static marketing and user routes
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/login</loc>
    <lastmod>2026-07-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/signup</loc>
    <lastmod>2026-07-11</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;

    // 2. Fetch public carousels to append dynamic URLs
    try {
        const response = await databasesServer.listDocuments(
            serverConfig.databaseId,
            serverConfig.carouselsCollectionId,
            [
                Query.equal('isPublic', true),
                Query.orderDesc('$updatedAt'),
                Query.limit(500) // Query up to 500 public carousels
            ]
        );

        if (response && response.documents) {
            xml += `  <!-- Dynamic Public Carousels -->\n`;
            for (const doc of response.documents) {
                const docDate = new Date(doc.$updatedAt || doc.$createdAt || Date.now()).toISOString().split('T')[0];
                xml += `  <url>\n`;
                xml += `    <loc>${baseUrl}/view/${doc.$id}</loc>\n`;
                xml += `    <lastmod>${docDate}</lastmod>\n`;
                xml += `    <changefreq>weekly</changefreq>\n`;
                xml += `    <priority>0.6</priority>\n`;
                xml += `  </url>\n`;
            }
        }
    } catch (error) {
        console.error('[Sitemap API] Failed to fetch public carousels:', error);
        // Fallback: keep static links only so it returns a valid sitemap
    }

    xml += `</urlset>`;

    // 3. Return XML response
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=600'); // Cache on Vercel Edge CDN for 1 hour
    return res.status(200).send(xml);
}
