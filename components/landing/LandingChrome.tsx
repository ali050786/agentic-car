import React, { useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Github, Linkedin, Menu, Minus, Plus, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { EASE, LogoMark, Magnetic, SectionHeading } from './primitives';
import { PromptComposer } from './PromptComposer';
import { ShaderBackdrop } from './ShaderBackdrop';

export const NAV_LINKS = [
  { label: 'Agents', href: '#agents' },
  { label: 'Studio', href: '#studio' },
  { label: 'Styles', href: '#styles' },
  { label: 'Features', href: '#features' },
  { label: 'FAQ', href: '#faq' },
];

export const Nav: React.FC = () => {
  const { user } = useAuthStore();
  const { scrollY, scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30 });

  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0;
    setScrolled(y > 24);
    setHidden(y > 600 && y > prev + 4 && !open);
    if (y < prev - 4) setHidden(false);
  });

  return (
    <>
      <motion.header
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: hidden ? -90 : 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="fixed top-3 md:top-4 inset-x-0 z-50 px-3"
      >
        <nav
          className={`mx-auto max-w-5xl flex items-center justify-between rounded-full pl-4 pr-2 h-14 transition-all duration-500 ${scrolled ? 'lp-glass' : 'border border-transparent'}`}
          aria-label="Main"
        >
          <a href="#top" className="flex items-center gap-2.5" aria-label="Agentic Carousel home">
            <LogoMark />
            <span className="leading-none">
              <span className="block lp-display text-[16px] font-semibold tracking-tight text-white">Agentic Carousel</span>
              <span className="block lp-mono text-[9.5px] uppercase tracking-[0.2em] text-white/40 mt-0.5">by Blinkwiser</span>
            </span>
          </a>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="relative rounded-full px-3.5 py-2 text-[13.5px] text-white/60 hover:text-white transition-colors hover:bg-white/[0.05]">
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {!user && (
              <Link to="/login" className="hidden sm:block px-3 py-2 text-[13.5px] text-white/70 hover:text-white transition-colors">Sign in</Link>
            )}
            <Magnetic strength={0.2}>
              <Link to="/app" className="lp-btn-primary h-10 px-4 text-[13.5px]">
                {user ? 'Open studio' : 'Start free'} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </Magnetic>
            <button type="button" className="md:hidden grid place-items-center w-10 h-10 rounded-full text-white/80" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="md:hidden mx-auto max-w-5xl mt-2 lp-glass rounded-3xl p-3"
            >
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-2xl px-4 py-3 text-[15px] text-white/80 hover:bg-white/5">{l.label}</a>
              ))}
              {!user && <Link to="/login" className="block rounded-2xl px-4 py-3 text-[15px] text-white/80 hover:bg-white/5">Sign in</Link>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
      <motion.div className="fixed top-0 inset-x-0 h-[2px] z-[55] origin-left" style={{ scaleX: progress, background: 'var(--lp-prism)' }} />
    </>
  );
};

/* ---------------------------- comparison ---------------------------- */

export const Comparison: React.FC = () => {
  const rows = [
    ['Stare at a blank canvas', 'Start from one sentence, a link or a file'],
    ['Google for stats, lose an hour', 'Research agent pulls context and sources'],
    ['Rewrite the hook six times', 'Strategist picks the strongest angle'],
    ['Nudge text boxes until it fits', 'Layouts auto-fit to character limits'],
    ['Export slide by slide', 'One-click PDF, JPGs or a share link'],
  ];
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-5">
        <SectionHeading eyebrow="Why it’s different" title={<>A Canva alternative that <span className="lp-serif text-[1.08em] lp-prism-text">does the thinking</span> too.</>} />
        <div className="mt-14 grid md:grid-cols-2 gap-4">
          <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.015] p-7">
            <div className="lp-mono text-[11px] uppercase tracking-[0.18em] text-white/35">The old way</div>
            <ul className="mt-5 space-y-4">
              {rows.map(([a], i) => (
                <motion.li key={a} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08, duration: 0.5, ease: EASE }} className="flex items-center gap-3 text-[15px] text-white/40">
                  <span className="grid place-items-center w-5 h-5 rounded-full border border-white/15 shrink-0"><X className="w-3 h-3" /></span>
                  <span className="line-through decoration-white/20">{a}</span>
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-[24px] p-7 lp-conic lp-glass">
            <div className="lp-mono text-[11px] uppercase tracking-[0.18em] text-cyan-200/80">With Agentic Carousel</div>
            <ul className="mt-5 space-y-4">
              {rows.map(([, b], i) => (
                <motion.li key={b} initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 + i * 0.08, duration: 0.5, ease: EASE }} className="flex items-center gap-3 text-[15px] text-white/90">
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-gradient-to-br from-cyan-300 to-violet-500 shrink-0 text-black text-[11px] font-bold">✓</span>
                  {b}
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

/* -------------------------------- FAQ -------------------------------- */

export const FAQS: { q: string; a: string }[] = [
  { q: 'LinkedIn carousel kaise banaye using this tool?', a: 'Bahut aasan hai. Step 1: apna topic likhiye, ya koi article, YouTube link, PDF ya DOCX daaliye. Step 2: style aur palette chuniye, ya apna brand kit use kijiye. Step 3: Generate dabaiye. AI agents research, copy aur design khud karte hain, aur aap chat karke koi bhi slide badal sakte hain. Phir LinkedIn-ready PDF download kar lijiye.' },
  { q: 'Is this a good Canva alternative for carousels?', a: 'Canva gives you a blank canvas; you still write the copy, find the angle and fit every text box by hand. Agentic Carousel does the research, writing and layout for you, then lets you refine by chatting. When you want pixel-level control, copy any slide straight into Figma.' },
  { q: 'Can I use it for personal branding on LinkedIn in India?', a: 'Yes. Carousels are one of the best formats for showing expertise on LinkedIn. Save your name, title, photo and brand colors once and every carousel ships with a consistent signature card, so your audience recognises your posts in the feed.' },
  { q: 'What are some key LinkedIn carousel tips for better reach?', a: 'Lead with a bold hook on slide one, keep one idea per slide, use high-contrast colors and minimal text, and finish with a clear call to action. The Strategist agent builds this arc into every carousel by default.' },
  { q: 'Ai se content creation kaise kare with Agentic Carousel?', a: 'Seedha topic likhiye ya kisi YouTube video ya blog post ka URL paste kijiye. Research agent context nikaalta hai, Strategist angle chunta hai, aur Writer structured slides banata hai. Output language mein Hindi bhi choose kar sakte hain.' },
  { q: 'Does it work for startup LinkedIn marketing?', a: 'Yes. Founders and teams use it to share lessons, product updates and educational content consistently. The memory system learns your tone and preferences over time, so each new carousel needs fewer edits.' },
  { q: 'Do I need to keep the tab open while it generates?', a: 'No. Generation runs on a background worker. Close the tab, keep working, and your finished carousel is waiting when you come back.' },
  { q: 'Is it free?', a: 'Yes, it is free to use during the early-access beta. No credit card required.' },
];

export const FAQ: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5 grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
        <div className="lg:sticky lg:top-28 self-start">
          <SectionHeading align="left" eyebrow="FAQ" title={<>Questions, <span className="lp-serif text-[1.08em] lp-prism-text">answered.</span></>} lede="Everything you need to know about making LinkedIn and Instagram carousels with AI agents." />
        </div>
        <div className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="w-full flex items-center justify-between gap-6 py-5 text-left group"
                >
                  <span className={`text-[16px] md:text-[17px] font-medium transition-colors ${isOpen ? 'text-white' : 'text-white/75 group-hover:text-white'}`}>{f.q}</span>
                  <span className={`grid place-items-center w-8 h-8 rounded-full border shrink-0 transition-all duration-300 ${isOpen ? 'bg-white text-black border-white rotate-180' : 'border-white/15 text-white/60 group-hover:border-white/35'}`}>
                    {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }} className="overflow-hidden">
                      <p className="pb-6 pr-12 text-[15px] leading-relaxed text-[color:var(--lp-muted)]">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ------------------------------ final CTA ------------------------------ */

export const FinalCTA: React.FC = () => (
  <section className="relative px-3 md:px-5 pb-10">
    <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-white/10 px-5 py-24 md:py-32 text-center">
      <ShaderBackdrop className="absolute inset-0" fade={0} />
      <div className="absolute inset-0 bg-[radial-gradient(80%_70%_at_50%_50%,rgba(6,6,10,0.35),rgba(6,6,10,0.8))]" />
      <div className="relative z-10 mx-auto max-w-3xl">
        <motion.h2
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE }}
          className="lp-display text-[44px] md:text-[80px] leading-[0.98] font-semibold text-white"
        >
          Your next carousel is <span className="lp-serif text-[1.1em]">one prompt</span> away.
        </motion.h2>
        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.8 }} className="mt-6 text-[17px] text-white/70">
          No credit card. No design tools. Just say what you want to say.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.8, ease: EASE }} className="mt-10 mx-auto max-w-2xl">
          <PromptComposer showChips={false} />
        </motion.div>
      </div>
    </div>
  </section>
);

export const Footer: React.FC = () => (
  <footer className="relative">
    <div className="mx-auto max-w-6xl px-5 py-14 grid md:grid-cols-[1.4fr_1fr_1fr] gap-10">
      <div>
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="lp-display text-[16px] font-semibold text-white">Agentic Carousel</span>
        </div>
        <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-white/45">AI agents that research, write and design social media carousels for LinkedIn and Instagram. A Blinkwiser product.</p>
      </div>
      <div>
        <div className="lp-mono text-[11px] uppercase tracking-[0.18em] text-white/35">Product</div>
        <ul className="mt-4 space-y-2.5 text-[14px]">
          {NAV_LINKS.map((l) => <li key={l.href}><a href={l.href} className="text-white/60 hover:text-white transition-colors">{l.label}</a></li>)}
        </ul>
      </div>
      <div>
        <div className="lp-mono text-[11px] uppercase tracking-[0.18em] text-white/35">Get started</div>
        <ul className="mt-4 space-y-2.5 text-[14px]">
          <li><Link to="/app" className="text-white/60 hover:text-white transition-colors">Open the studio</Link></li>
          <li><Link to="/signup" className="text-white/60 hover:text-white transition-colors">Create an account</Link></li>
          <li><Link to="/login" className="text-white/60 hover:text-white transition-colors">Sign in</Link></li>
        </ul>
      </div>
    </div>
    <div className="mx-auto max-w-6xl px-5 py-6 border-t border-white/[0.07] flex flex-col sm:flex-row items-center justify-between gap-4">
      <p className="text-[13px] text-white/35">© {new Date().getFullYear()} Blinkwiser. All rights reserved.</p>
      <div className="flex gap-2">
        <a href="https://www.linkedin.com/in/blinkwiser/" target="_blank" rel="noopener noreferrer" className="grid place-items-center w-9 h-9 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors" aria-label="LinkedIn">
          <Linkedin className="w-4 h-4" />
        </a>
        <a href="https://github.com/ali050786" target="_blank" rel="noopener noreferrer" className="grid place-items-center w-9 h-9 rounded-full border border-white/10 text-white/55 hover:text-white hover:border-white/30 transition-colors" aria-label="GitHub">
          <Github className="w-4 h-4" />
        </a>
      </div>
    </div>
    <div className="overflow-hidden select-none pointer-events-none" aria-hidden="true">
      <div className="lp-display text-center font-semibold leading-[0.8] text-[22vw] bg-gradient-to-b from-white/[0.07] to-transparent bg-clip-text text-transparent translate-y-[18%]">carousel</div>
    </div>
  </footer>
);
