import React, { useRef, useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import {
  ShieldCheck, Compass, Search, Target, LayoutTemplate, SpellCheck2, PenTool, Check, Globe, BookOpen, Mic2, Bell, CornerDownRight,
} from 'lucide-react';
import { LiveSlide } from './LiveSlide';
import { DECK, DOODLE_PATHS, BLANK_DOODLE_URL, AnySlide } from './sampleDeck';
import { EASE, SectionHeading, Typewriter } from './primitives';
import { useMedia } from './useMedia';

type Phase = 'PLAN' | 'EXECUTE' | 'REFLECT' | 'DELIVER';

interface Stage {
  phase: Phase;
  agents: string;
  title: string;
  body: string;
  status: string; // mirrors the real job status messages streamed by the worker
  pct: number;
  icon: React.ElementType;
  Visual: React.FC;
}

const PHASE_COLOR: Record<Phase, string> = {
  PLAN: '#3ee6f5',
  EXECUTE: '#4f8cff',
  REFLECT: '#9b6bff',
  DELIVER: '#ff7a8a',
};

/* ---------------------------- stage visuals ---------------------------- */

const Row: React.FC<{ delay: number; children: React.ReactNode; className?: string }> = ({ delay, children, className = '' }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={{ duration: 0.5, ease: EASE, delay }}
    className={className}
  >
    {children}
  </motion.div>
);

const PlanVisual: React.FC = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3">
      {[
        { k: 'Scope', v: 'This is a carousel request' },
        { k: 'Safety', v: 'Topic is allowed' },
      ].map((c, i) => (
        <Row key={c.k} delay={0.1 + i * 0.15} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex items-center gap-2 text-[12px] text-white/50 lp-mono uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" /> {c.k}
          </div>
          <div className="mt-1.5 text-[14px] text-white/90 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-300" /> {c.v}
          </div>
        </Row>
      ))}
    </div>
    <Row delay={0.45} className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.04] p-5">
      <div className="lp-mono text-[11px] uppercase tracking-[0.16em] text-cyan-200/70">Creative brief</div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px]">
        {[
          ['Audience', 'Indie founders & makers'],
          ['Tone', 'Candid, practical'],
          ['Goal', 'Saves and follows'],
          ['Shape', '7 slides · hook → proof → CTA'],
        ].map(([k, v], i) => (
          <Row key={k} delay={0.6 + i * 0.1}>
            <dt className="text-white/40 text-[12px]">{k}</dt>
            <dd className="text-white/90">{v}</dd>
          </Row>
        ))}
      </dl>
    </Row>
    <Row delay={1.0} className="flex flex-wrap items-center gap-2 text-[12.5px]">
      <span className="text-white/45">Fuzzy brief? It asks first:</span>
      {['Who is it for?', 'Serious or playful?', 'How many slides?'].map((q) => (
        <span key={q} className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-1 text-white/75">{q}</span>
      ))}
    </Row>
  </div>
);

const ResearchVisual: React.FC = () => (
  <div className="space-y-4">
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 lp-mono text-[12.5px] text-white/80 space-y-2">
      <div className="flex items-center gap-2"><Search className="w-3.5 h-3.5 text-sky-300" /><Typewriter text="building in public audience growth over time" speed={22} /></div>
      <div className="flex items-center gap-2 text-white/60"><Search className="w-3.5 h-3.5 text-sky-300/70" /><Typewriter text="founder content consistency vs virality" speed={22} caret={false} /></div>
    </div>
    <div className="space-y-3">
      {[
        { icon: BookOpen, kind: 'Long-form essay', note: 'Why compounding content takes years' },
        { icon: Mic2, kind: 'Podcast transcript', note: 'Founders on posting through the quiet phase' },
        { icon: Globe, kind: 'Industry survey', note: 'What makes B2B audiences save a post' },
      ].map((s, i) => (
        <Row key={s.kind} delay={0.5 + i * 0.18} className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-sky-400/10 border border-sky-300/20"><s.icon className="w-4 h-4 text-sky-300" /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] text-white/90 truncate">{s.note}</div>
            <div className="text-[11.5px] text-white/40 lp-mono">{s.kind}</div>
          </div>
          <motion.span initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: -6 }} transition={{ delay: 1.1 + i * 0.18, type: 'spring', stiffness: 400, damping: 14 }} className="rounded-md border border-emerald-300/40 px-2 py-0.5 text-[10.5px] lp-mono uppercase tracking-wider text-emerald-300">
            cited
          </motion.span>
        </Row>
      ))}
    </div>
  </div>
);

const StrategyVisual: React.FC = () => {
  const angles = [
    { t: 'Building in public is a growth hack', pick: false },
    { t: '7 lessons from 3 years of shipping in the open', pick: true },
    { t: 'Why I almost quit posting (and didn’t)', pick: false },
  ];
  return (
    <div className="space-y-3">
      <div className="lp-mono text-[11px] uppercase tracking-[0.16em] text-white/45">Angle candidates</div>
      {angles.map((a, i) => (
        <motion.div
          key={a.t}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: a.pick ? 1 : 0.45, x: 0, scale: a.pick ? 1.02 : 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.15 + i * 0.15, scale: { delay: 1.1, duration: 0.5 } }}
          className={`relative rounded-xl border p-4 ${a.pick ? 'border-blue-400/50 bg-blue-500/[0.08]' : 'border-white/10 bg-white/[0.02]'}`}
        >
          <div className="flex items-center justify-between gap-4">
            <span className={`text-[15px] ${a.pick ? 'text-white' : 'text-white/70'}`}>{a.t}</span>
            {a.pick && (
              <motion.span initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 }} className="shrink-0 flex items-center gap-1 rounded-full bg-blue-400 text-black px-2.5 py-1 text-[11px] font-semibold">
                <Check className="w-3 h-3" /> Hook
              </motion.span>
            )}
          </div>
          <div className="mt-3 h-1 rounded-full bg-white/5 overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: a.pick ? '92%' : i === 0 ? '48%' : '63%' }} transition={{ duration: 1, ease: EASE, delay: 0.4 + i * 0.12 }} className={`h-full rounded-full ${a.pick ? 'bg-gradient-to-r from-cyan-300 to-blue-500' : 'bg-white/20'}`} />
          </div>
        </motion.div>
      ))}
      <Row delay={1.4} className="flex items-center gap-2 text-[12.5px] text-white/55">
        <CornerDownRight className="w-4 h-4" /> Narrative arc locked: lesson → proof → call to action
      </Row>
    </div>
  );
};

const WriteVisual: React.FC = () => {
  const blocks = ['hero', 'list', 'stat', 'quote', 'closing'];
  return (
    <div className="grid grid-cols-[110px_1fr] gap-5 items-start">
      <div className="space-y-2">
        <div className="lp-mono text-[11px] uppercase tracking-[0.16em] text-white/45 mb-3">Layout IR</div>
        {blocks.map((b, i) => (
          <Row key={b} delay={0.1 + i * 0.12} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 lp-mono text-[12px] text-white/80">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ['#3ee6f5', '#4f8cff', '#9b6bff', '#ff7a8a', '#b6f36a'][i] }} />
            {b}
          </Row>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {DECK.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 18, rotateX: -30 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.35 + i * 0.14 }}
            className="lp-slide-frame !rounded-lg"
            style={{ transformPerspective: 600 }}
          >
            <LiveSlide slide={s} templateId="template-1" presetId="ocean-tech" slideNumber={i + 1} />
          </motion.div>
        ))}
        <Row delay={1.2} className="grid place-items-center rounded-lg border border-dashed border-white/15 text-[11px] text-white/40 lp-mono text-center p-2">
          auto-fit<br />to limits
        </Row>
      </div>
    </div>
  );
};

const ReflectVisual: React.FC = () => (
  <div className="space-y-4">
    <Row delay={0.1} className="flex items-center justify-between rounded-xl border border-violet-300/25 bg-violet-400/[0.06] px-4 py-3">
      <span className="lp-mono text-[12px] text-violet-200">Pass 1 / 2 · critique</span>
      <span className="text-[12px] text-amber-300">2 slides flagged</span>
    </Row>
    <div className="rounded-xl border border-white/10 bg-black/30 p-4 lp-mono text-[12.5px] leading-relaxed space-y-3">
      {[
        ['We utilize a consistent cadence to leverage engagement.', 'Post on a rhythm you can keep.'],
        ['In conclusion, you should probably consider starting.', 'Start before you feel ready.'],
      ].map(([from, to], i) => (
        <div key={i} className="space-y-1">
          <Row delay={0.35 + i * 0.4}><span className="text-rose-300/80 line-through decoration-rose-300/60">− {from}</span></Row>
          <Row delay={0.55 + i * 0.4}><span className="text-emerald-300">+ {to}</span></Row>
        </div>
      ))}
    </div>
    <Row delay={1.4} className="flex items-center justify-between rounded-xl border border-emerald-300/25 bg-emerald-400/[0.06] px-4 py-3">
      <span className="lp-mono text-[12px] text-emerald-200">Pass 2 / 2 · critique</span>
      <span className="flex items-center gap-1.5 text-[12px] text-emerald-300"><Check className="w-3.5 h-3.5" /> Clean</span>
    </Row>
  </div>
);

const DeliverVisual: React.FC = () => (
  <div className="grid grid-cols-[1fr_1.1fr] gap-5 items-center">
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: EASE }} className="relative lp-slide-frame">
      <LiveSlide slide={{ ...(DECK[0] as object), doodleUrl: BLANK_DOODLE_URL } as AnySlide} templateId="template-3" presetId="forest-light" slideNumber={1} />
      {/* Sits exactly where the engine places the hero doodle (x540 y660 w520 h580 of 1080×1384). */}
      <svg className="lp-draw absolute" style={{ left: '50%', top: '47.7%', width: '48.1%', height: '41.9%', mixBlendMode: 'multiply' }} viewBox="0 0 520 580" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {DOODLE_PATHS.map((p, k) => (
          <path key={k} pathLength={1} d={p.d} strokeWidth={p.w} opacity={p.o} style={{ animationDelay: `${0.3 + k * 0.18}s` }} />
        ))}
      </svg>
    </motion.div>
    <div className="space-y-3">
      <Row delay={0.2} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="flex items-center gap-2 text-[13.5px] text-white/90"><PenTool className="w-4 h-4 text-rose-300" /> Doodles sketched for 5 slides</div>
        <div className="mt-1 text-[12px] text-white/45">Art Director writes the scene, Flux draws it</div>
      </Row>
      <Row delay={0.45} className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
        <div className="flex items-center gap-2 text-[13.5px] text-white/90"><Check className="w-4 h-4 text-emerald-300" /> Saved to your history</div>
        <div className="mt-1 text-[12px] text-white/45">Output checked again before it’s saved</div>
      </Row>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.9, type: 'spring', stiffness: 260, damping: 20 }}
        className="rounded-xl bg-white text-black p-3.5 shadow-[0_20px_50px_-15px_rgba(255,122,138,0.5)]"
      >
        <div className="flex items-center gap-2 text-[13.5px] font-semibold"><Bell className="w-4 h-4" /> Your carousel is ready</div>
        <div className="mt-0.5 text-[12px] text-black/60">Built on our worker while your tab was closed.</div>
      </motion.div>
    </div>
  </div>
);

const STAGES: Stage[] = [
  { phase: 'PLAN', agents: 'Gatekeeper · Creative Director', title: 'Reads the brief like a strategist', body: 'Checks scope and safety before spending a single token, then turns your one-liner into a real creative brief. If the intent is fuzzy, it asks you first.', status: 'PLAN: Analyzing brief & constructing strategy…', pct: 15, icon: Compass, Visual: PlanVisual },
  { phase: 'EXECUTE', agents: 'Research Agent', title: 'Finds real context, not filler', body: 'Plans search queries, pulls fresh facts and trends from the web, and keeps the sources so your claims hold up.', status: 'EXECUTE: Researching trends & factual context…', pct: 25, icon: Search, Visual: ResearchVisual },
  { phase: 'EXECUTE', agents: 'Strategist', title: 'Picks the angle worth reading', body: 'Generates competing hooks, chooses the strongest one and locks a narrative arc so every slide earns the next swipe.', status: 'EXECUTE: Drafting viral angle & narrative flow…', pct: 40, icon: Target, Visual: StrategyVisual },
  { phase: 'EXECUTE', agents: 'Writer', title: 'Writes to a layout, not a text box', body: 'Copy is mapped to a structured layout: hero, list, stat, quote, split, closing. Every block respects character limits, so nothing overflows.', status: 'EXECUTE: Writing content & mapping Layout IR…', pct: 55, icon: LayoutTemplate, Visual: WriteVisual },
  { phase: 'REFLECT', agents: 'Proofreader · Critic', title: 'Critiques its own work', body: 'A bounded reflect loop inspects every slide, flags weak or wordy ones and rewrites only those. Up to two passes, then it ships.', status: 'REFLECT: Critiquing layout & quality (pass 2/2)…', pct: 81, icon: SpellCheck2, Visual: ReflectVisual },
  { phase: 'DELIVER', agents: 'Art Director · Worker', title: 'Sketches, saves and pings you', body: 'For the Sketch style, the Art Director briefs a custom doodle per slide. Everything runs on a background worker, so you can close the tab.', status: 'Saving carousel & finalizing…', pct: 100, icon: PenTool, Visual: DeliverVisual },
];

/* ------------------------------- window ------------------------------- */

const RunWindow: React.FC<{ active: number }> = ({ active }) => {
  const s = STAGES[active];
  const Visual = s.Visual;
  return (
    <div className="lp-glass rounded-[22px] overflow-hidden">
      <div className="flex items-center gap-3 px-4 h-11 border-b border-white/[0.07]">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
          <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
        </div>
        <div className="flex-1 truncate text-center lp-mono text-[11.5px] text-white/45">run · 7 lessons from 3 years of shipping in the open</div>
        <span className="lp-mono text-[11px] tabular-nums text-white/60">{s.pct}%</span>
      </div>
      <div className="h-[2px] bg-white/[0.05]">
        <motion.div className="h-full" animate={{ width: `${s.pct}%`, background: PHASE_COLOR[s.phase] }} transition={{ duration: 0.8, ease: EASE }} />
      </div>
      <div className="p-5 md:p-6 min-h-[430px]">
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12, filter: 'blur(6px)' }} transition={{ duration: 0.4, ease: EASE }}>
            <Visual />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2.5 px-5 h-11 border-t border-white/[0.07] lp-mono text-[11.5px]">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: PHASE_COLOR[s.phase] }} />
        <AnimatePresence mode="wait">
          <motion.span key={s.status} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="lp-shimmer truncate">
            {s.status}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
};

const StageItem: React.FC<{ s: Stage; i: number; active: boolean; done: boolean; onClick?: () => void }> = ({ s, i, active, done, onClick }) => (
  <button type="button" onClick={onClick} className="group w-full text-left relative pl-12 py-4">
    <span
      className="absolute left-0 top-4 grid place-items-center w-8 h-8 rounded-full border transition-all duration-500"
      style={{
        borderColor: active ? PHASE_COLOR[s.phase] : done ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
        background: active ? `${PHASE_COLOR[s.phase]}22` : 'rgba(6,6,10,1)',
        boxShadow: active ? `0 0 24px ${PHASE_COLOR[s.phase]}66` : 'none',
      }}
    >
      {done ? <Check className="w-3.5 h-3.5 text-white/60" /> : <s.icon className="w-3.5 h-3.5" style={{ color: active ? PHASE_COLOR[s.phase] : 'rgba(255,255,255,0.45)' }} />}
    </span>
    <div className="flex items-center gap-2.5 lp-mono text-[10.5px] uppercase tracking-[0.18em]">
      <span style={{ color: active ? PHASE_COLOR[s.phase] : 'rgba(255,255,255,0.35)' }}>{String(i + 1).padStart(2, '0')} · {s.phase}</span>
      <span className="text-white/30 normal-case tracking-normal text-[11.5px]">{s.agents}</span>
    </div>
    <div className={`lp-display mt-1.5 text-[20px] md:text-[22px] font-medium transition-colors duration-500 ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
      {s.title}
    </div>
    <motion.div initial={false} animate={{ height: active ? 'auto' : 0, opacity: active ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
      <p className="pt-2 text-[15px] leading-relaxed text-[color:var(--lp-muted)] max-w-md">{s.body}</p>
    </motion.div>
  </button>
);

/* ------------------------------ section ------------------------------ */

export const AgentPipeline: React.FC = () => {
  const desktop = useMedia('(min-width: 1024px)', true);
  return (
    <section id="agents" className="relative pt-28 md:pt-36">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Under the hood"
          title={<>Not one prompt. <span className="lp-serif text-[1.08em] lp-prism-text">A whole crew.</span></>}
          lede="Every carousel runs through a Plan → Execute → Reflect loop of specialist agents. Scroll to watch one run."
        />
      </div>
      {desktop ? <StickyPipeline /> : <StackedPipeline />}
    </section>
  );
};

const StickyPipeline: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const rail = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const i = Math.min(STAGES.length - 1, Math.max(0, Math.floor(p * STAGES.length * 0.999)));
    setActive((prev) => (prev === i ? prev : i));
  });

  const jump = (i: number) => {
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const span = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + span * ((i + 0.5) / STAGES.length), behavior: 'smooth' });
  };

  return (
    <div ref={ref} className="relative" style={{ height: `${STAGES.length * 75 + 40}vh` }}>
      <div className="sticky top-0 h-screen flex items-center">
        <div className="mx-auto w-full max-w-6xl px-5 grid grid-cols-[0.9fr_1.1fr] gap-14 items-center">
          <div className="relative">
            <div className="absolute left-4 top-8 bottom-8 w-px bg-white/[0.08]" />
            <motion.div className="absolute left-4 top-8 w-px origin-top bg-gradient-to-b from-cyan-300 via-blue-500 to-violet-500" style={{ bottom: '2rem', scaleY: rail }} />
            {STAGES.map((s, i) => (
              <StageItem key={i} s={s} i={i} active={i === active} done={i < active} onClick={() => jump(i)} />
            ))}
          </div>
          <RunWindow active={active} />
        </div>
      </div>
    </div>
  );
};

const StackedPipeline: React.FC = () => (
  <div className="mx-auto max-w-2xl px-5 mt-14 space-y-10">
    {STAGES.map((s, i) => (
      <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: EASE }}>
        <div className="flex items-center gap-2.5 lp-mono text-[10.5px] uppercase tracking-[0.18em]" style={{ color: PHASE_COLOR[s.phase] }}>
          {String(i + 1).padStart(2, '0')} · {s.phase}
          <span className="text-white/35 normal-case tracking-normal text-[11.5px]">{s.agents}</span>
        </div>
        <h3 className="lp-display mt-2 text-[24px] font-medium text-white">{s.title}</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--lp-muted)]">{s.body}</p>
        <InViewVisual Visual={s.Visual} />
      </motion.div>
    ))}
  </div>
);

const InViewVisual: React.FC<{ Visual: React.FC }> = ({ Visual }) => {
  const [seen, setSeen] = useState(false);
  return (
    <motion.div onViewportEnter={() => setSeen(true)} viewport={{ once: true, margin: '-80px' }} className="mt-5 lp-glass rounded-2xl p-4 min-h-[200px]">
      {seen && <Visual />}
    </motion.div>
  );
};
