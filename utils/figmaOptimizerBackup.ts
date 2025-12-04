import React from 'react';
import satori from 'satori';
import { SlideContent, CarouselTheme } from '../types';

// Font loading cache
let fontCache: Record<string, ArrayBuffer> | null = null;

// Using reliable CDN links for standard woff files
const FONT_URLS = {
  'Lato-Regular': 'https://cdn.jsdelivr.net/npm/@fontsource/lato/files/lato-latin-400-normal.woff',
  'Lato-Bold': 'https://cdn.jsdelivr.net/npm/@fontsource/lato/files/lato-latin-700-normal.woff',
  'Oswald-Bold': 'https://cdn.jsdelivr.net/npm/@fontsource/oswald/files/oswald-latin-700-normal.woff',
  'Roboto-Regular': 'https://cdn.jsdelivr.net/npm/@fontsource/roboto/files/roboto-latin-400-normal.woff',
  'Roboto-Bold': 'https://cdn.jsdelivr.net/npm/@fontsource/roboto/files/roboto-latin-700-normal.woff',
  'Roboto-Black': 'https://cdn.jsdelivr.net/npm/@fontsource/roboto/files/roboto-latin-900-normal.woff'
};

async function loadFonts() {
  if (fontCache) return fontCache;
  
  try {
    const entries = await Promise.all(
      Object.entries(FONT_URLS).map(async ([name, url]) => {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to load font ${name}: ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        return [name, buffer] as [string, ArrayBuffer];
      })
    );
    
    fontCache = Object.fromEntries(entries);
    return fontCache;
  } catch (e) {
    console.error("Font loading error:", e);
    return null;
  }
}

// Helper for TS compatibility without JSX in .ts files
const h = React.createElement;

// ------------------------------------------------------------------
// TEMPLATE 1: "The Truth" (Satori / React Elements)
// ------------------------------------------------------------------
const Template1Layout = ({ slide, theme }: { slide: SlideContent, theme: CarouselTheme }) => {
  const bg = theme.background || '#141414';
  const bg2 = theme.background2 || 'rgba(255, 255, 255, 0.1)';
  const textDefault = theme.textDefault || '#A2A2A2';
  const textHighlight = theme.textHighlight || '#FFFFFF';

  // Helper for List Items
  const renderList = () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' } },
      (slide.listItems || []).map((item, i) => {
        const parts = item.split(':');
        const hasKey = parts.length > 1;
        const key = hasKey ? parts[0] + ':' : '';
        const val = hasKey ? parts.slice(1).join(':') : item;

        return h('div', { key: i, style: { display: 'flex', alignItems: 'flex-start', gap: '24px', fontFamily: 'Lato', fontWeight: 500, fontSize: '32px', color: textDefault, lineHeight: 1.2 } },
          h('div', { style: { minWidth: '20px' } }, '•'),
          h('div', { style: { display: 'flex' } },
              hasKey && h('span', { style: { color: textHighlight, fontWeight: 700, marginRight: '8px' } }, key),
              h('span', null, val)
          )
        );
      })
  );

  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '1080px', height: '1384px', backgroundColor: bg, position: 'relative' } },
      
      // Decorative Lines
      h('div', { style: { position: 'absolute', left: '150px', top: 0, bottom: 0, width: '1px', backgroundColor: bg2 } }),
      slide.variant === 'closing' ? (
        h('div', { style: { position: 'absolute', left: '788px', top: 0, bottom: 0, width: '1px', backgroundColor: bg2 } })
      ) : (
        h('div', { style: { position: 'absolute', right: '150px', top: 0, bottom: 0, width: '1px', backgroundColor: bg2 } })
      ),

      // Content Area
      h('div', { style: { position: 'absolute', left: '150px', top: 0, width: '780px', height: slide.variant === 'closing' ? '900px' : '1104px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '50px' } },
        
        // PreHeader
        slide.preHeader && h('div', { style: { fontFamily: 'Lato', fontWeight: 700, fontSize: '32px', color: textHighlight, textTransform: 'uppercase', letterSpacing: '0.05em' } },
           slide.preHeader
        ),

        // Headline
        h('div', { style: { display: 'flex', flexDirection: 'column', fontFamily: 'Oswald', fontWeight: 700, fontSize: slide.variant === 'hero' || slide.variant === 'closing' ? '96px' : '80px', textTransform: 'uppercase', lineHeight: 1.2, color: textDefault } },
           slide.variant !== 'hero' && h('span', { style: { opacity: 0.6 } }, slide.headline),
           slide.variant === 'hero' && h('span', null, slide.headline),
           h('span', { style: { color: textHighlight } }, slide.headlineHighlight)
        ),

        // Body
        slide.variant !== 'list' && slide.body && h('div', { style: { fontFamily: 'Lato', fontWeight: slide.variant === 'body' ? 500 : 300, fontSize: '32px', color: textDefault, lineHeight: 1.2 } },
             slide.body
        ),

        // List
        slide.variant === 'list' && renderList()
      ),

      // Bottom Section
      h('div', { style: { position: 'absolute', bottom: 0, left: 0, width: '100%', height: '275px', backgroundColor: bg2 } }),
      
      // Swipe / CTA
      (slide.variant === 'hero' || slide.variant === 'body' || slide.variant === 'list') && (
        h('div', { style: { position: 'absolute', bottom: '154px', right: slide.variant === 'hero' ? '0px' : '0px', width: '292px', height: '125px', backgroundColor: textHighlight, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
           h('div', { style: { fontFamily: 'Lato', fontWeight: 700, fontSize: '32px', color: bg } }, 'SWIPE ->')
        )
      ),

      slide.variant === 'closing' && (
         h('div', { style: { position: 'absolute', bottom: '330px', left: '150px', width: '292px', height: '125px', backgroundColor: textHighlight, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
            h('div', { style: { fontFamily: 'Lato', fontWeight: 700, fontSize: '32px', color: bg } }, 'FOLLOW US')
         )
      )

  );
};

// ------------------------------------------------------------------
// TEMPLATE 2: "The Clarity" (Satori / React Elements)
// ------------------------------------------------------------------
const Template2Layout = ({ slide, theme }: { slide: SlideContent, theme: CarouselTheme }) => {
  const bg = theme.background || '#091c33';
  const textHighlight = theme.textHighlight || '#f4782d';
  const bg2 = theme.background2 || '#6d51a2';
  const textDefault = theme.textDefault || '#ffffff';
  const bgGradStart = theme.bgGradStart || '#6d51a2';
  const bgGradEnd = theme.bgGradEnd || '#091c33';

  // Helper for List Items
  const renderList = () => h('div', { style: { display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' } },
      (slide.listItems || []).map((item, i) => {
        const parts = item.split(':');
        const hasKey = parts.length > 1;
        const key = hasKey ? parts[0] + ':' : '';
        const val = hasKey ? parts.slice(1).join(':') : item;

        return h('div', { key: i, style: { display: 'flex', alignItems: 'flex-start', gap: '20px', fontFamily: 'Roboto', fontWeight: 500, fontSize: '32px', color: textDefault, lineHeight: 1.4 } },
          h('div', { style: { minWidth: '15px', color: textHighlight } }, '•'),
          h('div', { style: { display: 'flex' } },
             hasKey && h('span', { style: { color: textHighlight, fontWeight: 700, marginRight: '8px' } }, key),
             h('span', null, val)
          )
        );
      })
  );

  return h('div', { style: { display: 'flex', flexDirection: 'column', width: '1080px', height: '1374px', backgroundColor: bg, position: 'relative' } },
      
      // Background Elements (SVG paths)
      h('svg', { 
        width: 1080, 
        height: 1374, 
        viewBox: "0 0 1080 1374.14",
        style: { position: 'absolute', top: 0, left: 0 } 
      },
        h('defs', null, 
          h('radialGradient', { 
            id: 'grad1', 
            cx: "845.36", 
            cy: "241.41", 
            r: "416.24", 
            gradientUnits: "userSpaceOnUse", 
            gradientTransform: "translate(-517.29 -50.02) scale(1.48 1.68)" 
          },
             h('stop', { offset: "0", stopColor: bgGradStart }),
             h('stop', { offset: "0.59", stopColor: bgGradEnd })
          )
        ),
        h('path', { d: "M386.97,5.06c0,2.31,0,4.61.02,6.92,3.77,382.43,312.55,690.44,693,695.27V5.06H386.97Z", fill: "url(#grad1)" }),
        h('path', { d: "M839.49,1326.66c23.07-116.89,125.7-197.83,240.51-197.7v-112.29c-197.43,0-357.47,160.04-357.47,357.47h112.29c.02-15.66,1.52-31.54,4.67-47.48Z", fill: bg2 })
      ),

      // Content Area
      h('div', { style: { position: 'absolute', left: '150px', top: '240px', width: '800px', display: 'flex', flexDirection: 'column', gap: '40px' } },
        
        // PreHeader
        slide.preHeader && h('div', { style: { fontFamily: 'Roboto', fontWeight: 400, fontSize: '32px', color: textDefault, lineHeight: 1 } }, slide.preHeader),
        
        // Headline
        h('div', { style: { display: 'flex', flexDirection: 'column', fontFamily: 'Roboto', fontWeight: 900, fontSize: (slide.variant === 'hero' || slide.variant === 'closing') ? '104px' : '80px', color: textDefault, lineHeight: 1.1, textTransform: slide.variant === 'hero' ? 'none' : 'uppercase' } },
           (slide.variant === 'body' || slide.variant === 'list') && h('span', { style: { opacity: 0.7 } }, slide.headline),
           (slide.variant === 'hero' || slide.variant === 'closing') && h('span', null, slide.headline),
           h('span', { style: { color: textHighlight } }, slide.headlineHighlight)
        ),

        // Body
        (slide.variant !== 'list') && slide.body && h('div', { style: { fontFamily: 'Roboto', fontWeight: 500, fontSize: '32px', color: textDefault, lineHeight: 1.4 } }, slide.body),

        // List
        slide.variant === 'list' && renderList()
      ),

      // CTA / Swipe
      h('div', { style: { position: 'absolute', top: '903px', left: '150px', width: '292px', height: '125px', backgroundColor: textHighlight, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
         h('div', { style: { fontFamily: 'Roboto', fontWeight: 700, fontSize: '32px', color: bg, letterSpacing: '0.05em' } }, 
           slide.variant === 'closing' ? 'FOLLOW US' : 'SWIPE ->'
         )
      )
  );
};

// ------------------------------------------------------------------
// MAIN OPTIMIZER FUNCTION
// ------------------------------------------------------------------
export const optimizeSvgForFigma = async (
  slide: SlideContent, 
  theme: CarouselTheme | null, 
  templateId: string
): Promise<string> => {
  if (!theme) return '';

  const fonts = await loadFonts();
  if (!fonts) {
    console.error("Fonts failed to load, SVG generation aborted.");
    return '<svg></svg>'; // Return empty SVG or fallback
  }

  // Prepare Layout
  const element = templateId === 'template-1' 
    ? Template1Layout({ slide, theme })
    : Template2Layout({ slide, theme });

  // Prepare Fonts Config
  const fontConfig = templateId === 'template-1' ? [
    { name: 'Lato', data: fonts['Lato-Regular'], weight: 400, style: 'normal' as const },
    { name: 'Lato', data: fonts['Lato-Bold'], weight: 700, style: 'normal' as const },
    { name: 'Oswald', data: fonts['Oswald-Bold'], weight: 700, style: 'normal' as const },
  ] : [
    { name: 'Roboto', data: fonts['Roboto-Regular'], weight: 400, style: 'normal' as const },
    { name: 'Roboto', data: fonts['Roboto-Bold'], weight: 700, style: 'normal' as const },
    { name: 'Roboto', data: fonts['Roboto-Black'], weight: 900, style: 'normal' as const },
  ];

  // Generate SVG using Satori
  // @ts-ignore - Satori types might conflict in some envs, but this is standard usage
  const svg = await satori(element, {
    width: 1080,
    height: templateId === 'template-1' ? 1384 : 1374,
    // @ts-ignore
    fonts: fontConfig,
  });

  return svg;
};