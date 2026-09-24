import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, MotionValue } from 'framer-motion';
import { ShaderBackdrop } from './ShaderBackdrop';
import { PromptComposer } from './PromptComposer';
import { LiveSlide } from './LiveSlide';
import { HERO_CARDS, HeroCard } from './sampleDeck';
import { EASE, RotatingWord, fadeUp, stagger } from './primitives';

const VERBS = ['research', 'write', 'design', 'proofread', 'sketch'];

export const Hero: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);

  return (
    <section ref={ref} className="relative pt-36 md:pt-44 pb-10 overflow-hidden">
      <ShaderBackdrop className="absolute inset-x-0 top-0 h-[115vh]" />
      <div className="absolute inset-x-0 top-0 h-[110vh] lp-grid opacity-60 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-b from-transparent to-[var(--lp-bg)] pointer-events-none" />

      <motion.div style={{ y: textY, opacity: textOpacity }} className="relative z-10 mx-auto max-w-5xl px-5 text-center">
        <motion.div initial="hidden" animate="show" variants={stagger(0.1, 0.1)}>
          <motion.a
            variants={fadeUp}
            href="#agents"
            className="group inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-black/30 backdrop-blur-md pl-2.5 pr-3.5 py-1.5 text-[12.5px] text-white/75 hover:text-white hover:border-white/25 transition-colors"
          >
            <span className="lp-dot" />
            <span className="hidden sm:inline lp-mono text-[11px] tracking-wide text-white/55">AGENTS ONLINE</span>
            <span className="hidden sm:inline h-3 w-px bg-white/15" />
            Plan → Execute → Reflect<span className="hidden sm:inline">, on every carousel</span>
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </motion.a>

          <motion.h1 variants={fadeUp} className="lp-display mt-8 font-semibold text-white text-[44px] leading-[0.98] sm:text-[64px] md:text-[88px]">
            Carousels that
            <br />
            <span className="lp-serif text-[1.12em] leading-[0.9]">
              <RotatingWord words={VERBS} wordClassName="lp-prism-text" />
            </span>{' '}
            themselves.
          </motion.h1>

          <motion.p variants={fadeUp} className="mx-auto mt-7 max-w-2xl text-[17px] md:text-[19px] leading-relaxed text-[color:var(--lp-muted)]">
            Drop in a topic, an article, a YouTube video or a PDF. A crew of specialist AI agents finds the angle,
            writes the hooks and designs every slide on your brand. Then you refine it by just talking.
          </motion.p>

          <motion.div variants={fadeUp} className="mx-auto mt-10 max-w-2xl">
            <PromptComposer />
          </motion.div>

          <motion.p variants={fadeUp} className="mt-5 lp-mono text-[11.5px] text-white/40 tracking-wide">
            Free during beta · No credit card · Keeps running if you close the tab
          </motion.p>
        </motion.div>
      </motion.div>

      <HeroDeck progress={scrollYProgress} />
    </section>
  );
};

/* ------------------------------------------------------------------------ */
/* 3D coverflow of real slides                                               */
/* ------------------------------------------------------------------------ */

const ARC = [
  { x: -560, z: -260, ry: 34, y: 60, r: -4 },
  { x: -300, z: -110, ry: 20, y: 22, r: -2 },
  { x: 0, z: 40, ry: 0, y: 0, r: 0 },
  { x: 300, z: -110, ry: -20, y: 22, r: 2 },
  { x: 560, z: -260, ry: -34, y: 60, r: 4 },
];

const HeroDeck: React.FC<{ progress: MotionValue<number> }> = ({ progress }) => {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 50, damping: 18 });
  const sy = useSpring(my, { stiffness: 50, damping: 18 });
  const tiltY = useTransform(sx, [-1, 1], [-7, 7]);
  const tiltX = useTransform(sy, [-1, 1], [5, -5]);

  // Scroll: the deck tips back onto a "table" and drifts up as the hero exits.
  const scrollTilt = useTransform(progress, [0, 0.8], [8, 32]);
  const rotateX = useTransform([tiltX, scrollTilt] as MotionValue[], ([a, b]: number[]) => a + b);
  const lift = useTransform(progress, [0, 1], [0, -140]);
  const scale = useTransform(progress, [0, 1], [1, 0.9]);

  const onMove = (e: React.PointerEvent) => {
    if (reduce) return;
    mx.set((e.clientX / window.innerWidth) * 2 - 1);
    my.set((e.clientY / window.innerHeight) * 2 - 1);
  };

  return (
    <div
      className="relative z-0 mt-14 md:mt-20 h-[360px] sm:h-[460px] md:h-[560px]"
      onPointerMove={onMove}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
      aria-hidden="true"
    >
      {/* floor glow */}
      <div className="absolute left-1/2 top-[62%] -translate-x-1/2 w-[80%] max-w-[1100px] h-[260px] rounded-[50%] bg-[radial-gradient(closest-side,rgba(79,140,255,0.35),rgba(155,107,255,0.15)_55%,transparent)] blur-2xl" />
      <div className="absolute inset-0 flex justify-center" style={{ perspective: 1600 }}>
        <div className="relative w-[300px] md:w-[320px] origin-top scale-[0.55] sm:scale-[0.78] md:scale-100" style={{ transformStyle: 'preserve-3d' }}>
        <motion.div
          className="relative w-full origin-[50%_80%]"
          style={{ transformStyle: 'preserve-3d', rotateX, rotateY: tiltY, y: lift }}
        >
          <motion.div style={{ scale, transformStyle: 'preserve-3d' }}>
            {HERO_CARDS.map((card, i) => (
              <DeckCard key={i} card={card} i={i} />
            ))}
          </motion.div>
        </motion.div>
        </div>
      </div>
    </div>
  );
};

const DeckCard: React.FC<{ card: HeroCard; i: number }> = ({ card, i }) => {
  const a = ARC[i];
  const [hover, setHover] = useState(false);
  const [settled, setSettled] = useState(false);
  const center = i === 2;
  return (
    <motion.div
      className={`${center ? 'relative' : 'absolute inset-x-0 top-0'} lp-slide-frame cursor-pointer`}
      style={{ transformStyle: 'preserve-3d', zIndex: 10 - Math.abs(i - 2) }}
      initial={{ opacity: 0, x: 0, y: 120, z: -300, rotateY: 0, rotateZ: 0 }}
      animate={{
        opacity: 1,
        x: a.x,
        y: hover ? a.y - 28 : a.y,
        z: hover ? a.z + 90 : a.z,
        rotateY: a.ry,
        rotateZ: a.r,
      }}
      transition={settled ? { type: 'spring', stiffness: 220, damping: 22 } : { duration: 1.3, ease: EASE, delay: 0.55 + Math.abs(i - 2) * 0.12 }}
      onAnimationComplete={() => setSettled(true)}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 6 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
      >
        <LiveSlide slide={card.slide} templateId={card.templateId} presetId={card.presetId} slideNumber={i + 1} />
      </motion.div>
      {/* sheen */}
      <div className="pointer-events-none absolute inset-0 rounded-[14px] bg-[linear-gradient(115deg,rgba(255,255,255,0.14),transparent_35%,transparent_70%,rgba(255,255,255,0.05))]" />
    </motion.div>
  );
};
