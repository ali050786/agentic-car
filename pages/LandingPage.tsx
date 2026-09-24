import React from 'react';
import '../components/landing/landing.css';
import { Hero } from '../components/landing/Hero';
import { AgentPipeline } from '../components/landing/AgentPipeline';
import { ChatStudio } from '../components/landing/ChatStudio';
import { StyleLab } from '../components/landing/StyleLab';
import { FeatureBento } from '../components/landing/FeatureBento';
import { Nav, Comparison, FAQ, FAQS, FinalCTA, Footer } from '../components/landing/LandingChrome';

/**
 * Landing page for carousel.blinkwiser.com.
 *
 * Every slide on this page is rendered live by the production SVG engine
 * (core/design/renderSlide.ts). Motion is Framer Motion (already a dependency)
 * plus a small raw-WebGL shader, so the page adds no new packages.
 */

const INPUT_STRIP = ['A one-line topic', 'Blog post URL', 'YouTube video', 'PDF report', 'Word doc', 'Meeting notes', 'Newsletter draft', 'Markdown file'];

const LandingPage = () => (
  <div id="top" className="lp lp-grain min-h-screen">
    {/* React 19 document metadata hoisting */}
    <title>Agentic Carousel | AI agents that research, write and design your LinkedIn carousels</title>
    <meta name="description" content="Turn a topic, article, YouTube video or PDF into a scroll-stopping LinkedIn or Instagram carousel. Specialist AI agents research, write, design and proofread every slide on your brand. Free during beta." />
    <meta name="keywords" content="linkedin carousel kaise banaye, linkedin carousel tips, linkedin post design, ai se content creation, ai content creator tools, ai se social media post, personal branding linkedin india, personal branding tips linkedin, linkedin profile grow kaise kare, social media carousel design guide, carousel design tips, social media slide design, canva vs ai carousel tools, canva alternative for carousel, linkedin marketing tools, startup linkedin marketing, solopreneur content marketing, agentic ai tools review, linkedin engagement badhane ke tips, linkedin post viral kaise kare, ai carousel generator" />
    <link rel="canonical" href="https://carousel.blinkwiser.com/" />

    <script type="application/ld+json">
      {JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Agentic Carousel Generator',
        operatingSystem: 'All',
        applicationCategory: 'MultimediaApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        description: 'AI agents that research, write and design social media carousels for LinkedIn and Instagram from a topic, article, YouTube video or PDF.',
        creator: { '@type': 'Organization', name: 'Blinkwiser', url: 'https://carousel.blinkwiser.com/' },
      })}
    </script>
    <script type="application/ld+json">
      {JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      })}
    </script>

    <Nav />

    <main>
      <Hero />

      {/* Inputs strip */}
      <section aria-label="Supported inputs" className="relative py-10 border-y border-white/[0.06] bg-white/[0.012]">
        <div className="lp-marquee overflow-hidden">
          <div className="lp-marquee-track gap-10" style={{ ['--lp-marquee-dur' as string]: '40s' }}>
            {[...INPUT_STRIP, ...INPUT_STRIP].map((t, i) => (
              <span key={i} className="flex items-center gap-10 whitespace-nowrap lp-display text-[22px] md:text-[28px] text-white/30">
                {t}
                <span className="lp-serif text-white/20">→ carousel</span>
                <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
              </span>
            ))}
          </div>
        </div>
      </section>

      <AgentPipeline />
      <ChatStudio />
      <StyleLab />
      <FeatureBento />
      <Comparison />
      <FAQ />
      <FinalCTA />
    </main>

    <Footer />
  </div>
);

export default LandingPage;
