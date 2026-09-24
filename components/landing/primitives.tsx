import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, Variants } from 'framer-motion';

export const EASE = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.8, ease: EASE } },
};

export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Fade-and-rise once when scrolled into view. */
export const Reveal: React.FC<{ children: React.ReactNode; className?: string; delay?: number; as?: 'div' | 'section' | 'li' }> = ({ children, className, delay = 0 }) => (
  <motion.div
    className={className}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-80px' }}
    variants={{
      hidden: fadeUp.hidden,
      show: { ...(fadeUp.show as object), transition: { duration: 0.8, ease: EASE, delay } },
    }}
  >
    {children}
  </motion.div>
);

/** Section heading: mono eyebrow, big display title, optional lede. */
export const SectionHeading: React.FC<{
  eyebrow: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}> = ({ eyebrow, title, lede, align = 'center', className = '' }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-80px' }}
    variants={stagger(0.08)}
    className={`${align === "center" ? "text-center mx-auto" : ""} max-w-4xl ${className}`}
  >
    <motion.div variants={fadeUp} className={`lp-eyebrow flex items-center gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
      <span className="h-px w-6 bg-white/25" />
      {eyebrow}
      <span className="h-px w-6 bg-white/25" />
    </motion.div>
    <motion.h2 variants={fadeUp} className="lp-display mt-5 text-[40px] leading-[1.02] md:text-[64px] font-semibold text-white">
      {title}
    </motion.h2>
    {lede && (
      <motion.p variants={fadeUp} className={`mt-6 text-[17px] md:text-lg leading-relaxed text-[color:var(--lp-muted)] ${align === 'center' ? 'mx-auto' : ''} max-w-2xl`}>
        {lede}
      </motion.p>
    )}
  </motion.div>
);

/** Pulls its child toward the cursor a little — for primary CTAs. */
export const Magnetic: React.FC<{ children: React.ReactNode; strength?: number; className?: string }> = ({ children, strength = 0.25, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 18, mass: 0.4 });
  const onMove = (e: React.PointerEvent) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const reset = () => { x.set(0); y.set(0); };
  return (
    <motion.div ref={ref} onPointerMove={onMove} onPointerLeave={reset} style={{ x, y }} className={`inline-block ${className ?? ''}`}>
      {children}
    </motion.div>
  );
};

/** Card whose border + wash track the cursor (see .lp-spot in landing.css). */
export const SpotlightCard: React.FC<React.HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }> = ({ children, className = '', ...rest }) => {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} onPointerMove={onMove} className={`lp-spot ${className}`} {...rest}>
      {children}
    </div>
  );
};

/** Cycles through words with a vertical blur-slide. Width animates smoothly. */
export const RotatingWord: React.FC<{ words: string[]; interval?: number; className?: string; wordClassName?: string }> = ({ words, interval = 2200, className = '', wordClassName = '' }) => {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [words.length, interval, reduce]);
  return (
    <motion.span layout className={`relative inline-flex overflow-hidden align-baseline ${className}`} transition={{ layout: { duration: 0.5, ease: EASE } }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[i]}
          className={`inline-block whitespace-nowrap pr-[0.08em] ${wordClassName}`}
          initial={{ y: '85%', opacity: 0, filter: 'blur(8px)' }}
          animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-85%', opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
};

/** Three stacked slides that fan out on hover — the product mark. */
export const LogoMark: React.FC<{ size?: number }> = ({ size = 30 }) => (
  <motion.div className="relative" style={{ width: size, height: size }} initial="rest" whileHover="fan" animate="rest">
    {[0, 1, 2].map((k) => (
      <motion.span
        key={k}
        className="absolute inset-y-[3px] left-[7px] right-[7px] rounded-[5px] border border-white/20"
        style={{
          background: k === 2 ? 'linear-gradient(145deg,#4f8cff,#9b6bff 60%,#ff7a8a)' : k === 1 ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.1)',
          zIndex: k,
          transformOrigin: '50% 100%',
        }}
        variants={{
          rest: { rotate: (k - 2) * 9, x: (k - 2) * 2 },
          fan: { rotate: (k - 1) * 16, x: (k - 1) * 5 },
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      />
    ))}
  </motion.div>
);

/** Types a string out character by character once visible. */
export const Typewriter: React.FC<{ text: string; speed?: number; className?: string; start?: boolean; caret?: boolean; onDone?: () => void }> = ({ text, speed = 28, className, start = true, caret = true, onDone }) => {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!start) { setN(0); return; }
    if (reduce) { setN(text.length); onDone?.(); return; }
    setN(0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) { window.clearInterval(id); onDone?.(); }
    }, speed);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, start, reduce]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      {caret && n < text.length && <span className="lp-caret" />}
    </span>
  );
};
