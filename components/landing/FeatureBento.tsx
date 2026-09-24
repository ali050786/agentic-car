import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Brain, MonitorX, FileText, Link2, Youtube, Lightbulb, FileType2, StickyNote, Figma, FileDown, ImageDown, Share2, Languages, ShieldCheck, Check,
} from 'lucide-react';
import { SpotlightCard, SectionHeading, stagger, fadeUp, EASE } from './primitives';

const useTicker = (length: number, ms: number) => {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % length), ms);
    return () => window.clearInterval(id);
  }, [length, ms, reduce]);
  return i;
};

const CardHead: React.FC<{ icon: React.ElementType; title: string; body: string; tint: string }> = ({ icon: Icon, title, body, tint }) => (
  <div className="relative z-10">
    <span className="grid place-items-center w-10 h-10 rounded-xl border border-white/10 bg-white/[0.04]">
      <Icon className="w-[18px] h-[18px]" style={{ color: tint }} />
    </span>
    <h3 className="lp-display mt-5 text-[22px] font-medium text-white">{title}</h3>
    <p className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--lp-muted)] max-w-md">{body}</p>
  </div>
);

/* ------------------------------ visuals ------------------------------ */

const MemoryViz: React.FC = () => {
  const notes = ['Audience: early-stage founders', 'Hooks: short and punchy', 'No emojis in headlines', 'Palette: Sunset Light', 'Always end with a follow CTA'];
  const i = useTicker(notes.length, 1700);
  const shown = notes.slice(0, i + 1);
  const layers = [
    { k: 'Durable profile', d: 'Your saved preferences' },
    { k: 'Rolling summary', d: 'Compressed chat history' },
    { k: 'Live notes', d: 'Picked up as you chat' },
  ];
  return (
    <div className="mt-7 grid sm:grid-cols-[1fr_1.1fr] gap-4">
      <div className="space-y-2">
        {layers.map((l, k) => (
          <div key={l.k} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5" style={{ marginLeft: k * 10 }}>
            <span className="w-2 h-2 rounded-full" style={{ background: ['#b6f36a', '#3ee6f5', '#9b6bff'][k] }} />
            <div>
              <div className="text-[13px] text-white/85">{l.k}</div>
              <div className="text-[11.5px] text-white/40">{l.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-white/[0.08] bg-black/30 p-3 lp-mono text-[12px] min-h-[150px]">
        <div className="text-white/35 mb-2">memory.notes</div>
        <AnimatePresence initial={false}>
          {shown.map((n) => (
            <motion.div key={n} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="text-emerald-200/85 leading-6 truncate">
              <span className="text-white/30">+ </span>{n}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const BackgroundViz: React.FC = () => {
  const reduce = useReducedMotion();
  return (
    <div className="mt-7 flex items-center gap-6">
      <div className="relative w-[120px] h-[120px] shrink-0">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" stroke="rgba(255,255,255,0.08)" strokeWidth="8" fill="none" />
          <motion.circle
            cx="60" cy="60" r="52" stroke="url(#lp-ring)" strokeWidth="8" fill="none" strokeLinecap="round"
            initial={{ pathLength: 0.15 }}
            animate={reduce ? { pathLength: 0.8 } : { pathLength: [0.15, 1, 1] }}
            transition={{ duration: 5, repeat: Infinity, times: [0, 0.85, 1], ease: 'easeInOut' }}
          />
          <defs>
            <linearGradient id="lp-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3ee6f5" /><stop offset="1" stopColor="#9b6bff" /></linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 grid place-items-center lp-mono text-[11px] text-white/60 text-center leading-tight">worker<br /><span className="text-white">running</span></div>
      </div>
      <div className="flex-1 space-y-2">
        <motion.div
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12.5px] text-white/70 origin-left"
          animate={reduce ? {} : { opacity: [1, 1, 0.25, 0.25, 1], scaleX: [1, 1, 0.92, 0.92, 1] }}
          transition={{ duration: 5, repeat: Infinity, times: [0, 0.25, 0.35, 0.9, 1] }}
        >
          <MonitorX className="w-3.5 h-3.5 text-white/50" /> Tab closed
        </motion.div>
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2 text-[12.5px] text-emerald-200/90">Job keeps running on the server</div>
        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12.5px] text-white/60">Resumes live when you come back</div>
      </div>
    </div>
  );
};

const InputsViz: React.FC = () => {
  const items = [
    { icon: Lightbulb, l: 'Topic' },
    { icon: Link2, l: 'Article URL' },
    { icon: Youtube, l: 'YouTube' },
    { icon: FileText, l: 'PDF' },
    { icon: FileType2, l: 'DOCX' },
    { icon: StickyNote, l: 'Notes' },
  ];
  const i = useTicker(items.length, 1100);
  return (
    <div className="mt-7 grid grid-cols-3 gap-2">
      {items.map((it, k) => (
        <motion.div
          key={it.l}
          animate={{ borderColor: k === i ? 'rgba(62,230,245,0.6)' : 'rgba(255,255,255,0.08)', backgroundColor: k === i ? 'rgba(62,230,245,0.08)' : 'rgba(255,255,255,0.02)' }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-1.5 rounded-xl border py-3"
        >
          <it.icon className={`w-4 h-4 ${k === i ? 'text-cyan-300' : 'text-white/45'}`} />
          <span className={`text-[11.5px] ${k === i ? 'text-white' : 'text-white/50'}`}>{it.l}</span>
        </motion.div>
      ))}
    </div>
  );
};

const FigmaViz: React.FC = () => (
  <div className="mt-7 rounded-xl border border-white/[0.08] bg-black/30 p-3 text-[12px]">
    <div className="flex items-center justify-between text-white/40 lp-mono mb-2"><span>Layers</span><span>⌘V</span></div>
    {['Slide 01 / Frame', 'Headline / Text', 'Accent phrase / Text', 'Icon / Vector', 'Background / Rect'].map((l, k) => (
      <motion.div
        key={l}
        initial={{ opacity: 0, x: -10 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.2 + k * 0.1, duration: 0.4, ease: EASE }}
        className="flex items-center gap-2 py-1 text-white/70"
        style={{ paddingLeft: k === 0 ? 0 : 14 }}
      >
        <span className={`w-2.5 h-2.5 rounded-[3px] ${k === 0 ? 'bg-violet-400/70' : 'border border-white/30'}`} />
        {l}
      </motion.div>
    ))}
  </div>
);

const ExportViz: React.FC = () => {
  const items = [
    { icon: FileDown, l: 'carousel.pdf', c: '#ff7a8a' },
    { icon: ImageDown, l: 'slide-01.jpg', c: '#3ee6f5' },
    { icon: Share2, l: 'Public link', c: '#b6f36a' },
  ];
  return (
    <div className="mt-7 space-y-2">
      {items.map((it, k) => (
        <motion.div
          key={it.l}
          initial={{ opacity: 0, y: 14, rotate: -2 }}
          whileInView={{ opacity: 1, y: 0, rotate: 0 }}
          viewport={{ once: true }}
          whileHover={{ x: 4 }}
          transition={{ delay: 0.15 + k * 0.12, type: 'spring', stiffness: 260, damping: 20 }}
          className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
        >
          <span className="flex items-center gap-2 text-[12.5px] text-white/80"><it.icon className="w-4 h-4" style={{ color: it.c }} />{it.l}</span>
          <Check className="w-3.5 h-3.5 text-white/40" />
        </motion.div>
      ))}
    </div>
  );
};

const LanguagesViz: React.FC = () => {
  const words = [
    { w: 'Start before you feel ready.', l: 'English' },
    { w: 'Empieza antes de sentirte listo.', l: 'Español' },
    { w: 'Commence avant d’être prêt.', l: 'Français' },
    { w: 'Fang an, bevor du bereit bist.', l: 'Deutsch' },
    { w: 'Comece antes de se sentir pronto.', l: 'Português' },
    { w: 'तैयार महसूस करने से पहले शुरू करें।', l: 'हिन्दी' },
  ];
  const i = useTicker(words.length, 2000);
  return (
    <div className="mt-7">
      <div className="h-[64px] relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ y: 24, opacity: 0, filter: 'blur(6px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} exit={{ y: -24, opacity: 0, filter: 'blur(6px)' }} transition={{ duration: 0.5, ease: EASE }} className="absolute inset-0">
            <div className="lp-serif text-[26px] md:text-[30px] text-white leading-tight">{words[i].w}</div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {words.map((w, k) => (
          <span key={w.l} className={`rounded-full px-2.5 py-1 text-[11.5px] border transition-colors duration-300 ${k === i ? 'border-white/40 text-white bg-white/10' : 'border-white/10 text-white/45'}`}>{w.l}</span>
        ))}
      </div>
    </div>
  );
};

const GuardViz: React.FC = () => (
  <div className="mt-7 space-y-2 text-[12.5px]">
    {[
      { k: 'Before', d: 'Scope + safety check' },
      { k: 'During', d: 'Char limits per block' },
      { k: 'After', d: 'Output moderation' },
    ].map((s, k) => (
      <motion.div
        key={s.k}
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.15 + k * 0.15, duration: 0.5, ease: EASE }}
        className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
      >
        <span className="text-white/80 flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" />{s.d}</span>
        <span className="lp-mono text-[10.5px] uppercase tracking-wider text-white/35">{s.k}</span>
      </motion.div>
    ))}
  </div>
);

/* ------------------------------ section ------------------------------ */

export const FeatureBento: React.FC = () => (
  <section id="features" className="relative py-28 md:py-36">
    <div className="mx-auto max-w-6xl px-5">
      <SectionHeading
        eyebrow="Built like a product"
        title={<>Everything a content team does. <span className="lp-serif text-[1.08em] lp-prism-text">Minus the meetings.</span></>}
      />
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        variants={stagger(0.07)}
        className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4"
      >
        <motion.div variants={fadeUp} className="lg:col-span-4">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={Brain} tint="#b6f36a" title="It learns how you like it" body="A three-layer memory keeps your preferences, compresses long chats and picks up new notes as you talk, so every carousel starts closer to done." />
            <MemoryViz />
          </SpotlightCard>
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={Lightbulb} tint="#3ee6f5" title="Start from anything" body="Detected automatically. No tabs, no modes." />
            <InputsViz />
          </SpotlightCard>
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-3">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={MonitorX} tint="#9b6bff" title="Close the tab. It keeps going." body="Generation runs on a background worker, not in your browser. Walk away and come back to a finished deck." />
            <BackgroundViz />
          </SpotlightCard>
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-3">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={Languages} tint="#ff7a8a" title="Writes in six languages" body="Pick the output language and the whole carousel is written natively in it, not machine-translated after the fact." />
            <LanguagesViz />
          </SpotlightCard>
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={Figma} tint="#9b6bff" title="Figma-ready" body="Copy any slide as clean SVG and paste it straight into Figma for pixel tweaks." />
            <FigmaViz />
          </SpotlightCard>
        </motion.div>
        <motion.div variants={fadeUp} className="lg:col-span-2">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={FileDown} tint="#ff7a8a" title="Export in one click" body="LinkedIn-ready PDF, high-res JPGs, or a public share link." />
            <ExportViz />
          </SpotlightCard>
        </motion.div>
        <motion.div variants={fadeUp} className="md:col-span-2 lg:col-span-2">
          <SpotlightCard className="h-full p-7">
            <CardHead icon={ShieldCheck} tint="#b6f36a" title="Guardrails built in" body="Checked before, during and after generation." />
            <GuardViz />
          </SpotlightCard>
        </motion.div>
      </motion.div>
    </div>
  </section>
);
