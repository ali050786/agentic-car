import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Brain, Cpu, Image as ImageIcon, Palette, PenLine, RotateCcw, Sparkles } from 'lucide-react';
import { TemplateId } from '../../types';
import { MorphSlide, LiveSlide } from './LiveSlide';
import { DECK, AnySlide, DEMO_BRANDING } from './sampleDeck';
import { EASE, SectionHeading } from './primitives';

type Route = 'copy' | 'design' | 'image';

interface StudioState {
  punchy: boolean;
  templateId: TemplateId;
  presetId: string;
}

interface Command {
  id: string;
  label: string;
  route: Route;
  reply: string;
  memory?: string;
  apply: (s: StudioState) => StudioState;
}

const COMMANDS: Command[] = [
  {
    id: 'punchy',
    label: 'Make the hook punchier',
    route: 'copy',
    reply: 'Tightened the hook and led with tension.',
    memory: 'Prefers short, punchy hooks',
    apply: (s) => ({ ...s, punchy: true }),
  },
  {
    id: 'statement',
    label: 'Switch to The Statement style',
    route: 'design',
    reply: 'Switched to The Statement. Applied instantly, no model call needed.',
    apply: (s) => ({ ...s, templateId: 'template-4', presetId: s.presetId === 'ocean-tech' ? 'midnight' : s.presetId }),
  },
  {
    id: 'warm',
    label: 'Try a warmer palette',
    route: 'design',
    reply: 'Moved all 5 slides to Sunset Light.',
    memory: 'Likes warm, light palettes',
    apply: (s) => ({ ...s, presetId: 'sunset-light' }),
  },
  {
    id: 'sketch',
    label: 'Add hand-drawn sketches',
    route: 'image',
    reply: 'Briefed the Art Director. Sketch style with a custom doodle per slide.',
    apply: (s) => ({ ...s, templateId: 'template-3', presetId: s.presetId === 'sunset-light' ? 'sunset-light' : 'forest-light' }),
  },
];

const ROUTE_META: Record<Route, { icon: React.ElementType; color: string; label: string }> = {
  copy: { icon: PenLine, color: '#3ee6f5', label: 'copy' },
  design: { icon: Palette, color: '#9b6bff', label: 'design' },
  image: { icon: ImageIcon, color: '#ff7a8a', label: 'image' },
};

const INITIAL: StudioState = { punchy: false, templateId: 'template-1', presetId: 'ocean-tech' };

interface Msg { id: number; role: 'user' | 'ai'; text: string; route?: Route; pending?: boolean }

const heroFor = (punchy: boolean): AnySlide =>
  punchy
    ? { ...(DECK[0] as object), id: 'bip-1p', preHeader: 'BUILDING IN PUBLIC', headline: 'Nobody tells you this about building in public.', accentPhrase: 'Nobody tells you', body: '3 years. 7 lessons. Zero fluff.' } as AnySlide
    : DECK[0];

export const ChatStudio: React.FC = () => {
  const [state, setState] = useState<StudioState>(INITIAL);
  const [used, setUsed] = useState<string[]>([]);
  const [memories, setMemories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 0, role: 'ai', text: 'Your 5-slide carousel is ready. Tell me what to change, like you would a designer.' },
  ]);
  const seq = useRef(1);
  const scroller = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const slides = useMemo(() => [heroFor(state.punchy), ...DECK.slice(1)], [state.punchy]);

  const run = (c: Command) => {
    if (busy) return;
    setBusy(true);
    setSelected(0);
    const uid = seq.current++;
    const aid = seq.current++;
    setMsgs((m) => [...m, { id: uid, role: 'user', text: c.label }, { id: aid, role: 'ai', text: 'Thinking', route: c.route, pending: true }]);
    timers.current.push(window.setTimeout(() => {
      setState((s) => c.apply(s));
      setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, text: c.reply, pending: false } : x)));
      setUsed((u) => [...u, c.id]);
      if (c.memory) setMemories((mm) => (mm.includes(c.memory!) ? mm : [...mm, c.memory!]));
      setBusy(false);
    }, c.route === 'design' ? 700 : 1300));
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    setState(INITIAL);
    setUsed([]);
    setMemories([]);
    setBusy(false);
    setSelected(0);
    setMsgs([{ id: seq.current++, role: 'ai', text: 'Back to the first draft. What should we try?' }]);
  };

  const remaining = COMMANDS.filter((c) => !used.includes(c.id));
  const morphKey = `${state.templateId}-${state.presetId}-${state.punchy}-${selected}`;

  return (
    <section id="studio" className="relative py-28 md:py-36">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(50%_40%_at_70%_50%,rgba(155,107,255,0.10),transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Edit by conversation"
          title={<>Refine it like you’d <span className="lp-serif text-[1.08em] lp-prism-text">brief a designer.</span></>}
          lede="One Orchestrator reads each message, routes it to copy, design or image work, and quietly remembers what you like for next time. Try it."
        />

        <div className="mt-16 grid lg:grid-cols-[1fr_1.05fr] gap-6 lg:gap-10 items-stretch">
          {/* Chat panel */}
          <div className="lp-glass rounded-[24px] flex flex-col h-[560px] overflow-hidden order-2 lg:order-1">
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5">
                <span className="grid place-items-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500"><Sparkles className="w-3.5 h-3.5 text-white" /></span>
                <span className="text-[14px] font-medium text-white">Studio chat</span>
              </div>
              <button type="button" onClick={reset} className="flex items-center gap-1.5 text-[12px] text-white/45 hover:text-white transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            </div>

            <div ref={scroller} className="flex-1 overflow-y-auto lp-scrollbar-none px-5 py-5 space-y-3.5">
              <AnimatePresence initial={false}>
                {msgs.map((m) => (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, ease: EASE }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {m.role === 'user' ? (
                      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-white text-black px-4 py-2.5 text-[14px]">{m.text}</div>
                    ) : (
                      <div className="max-w-[88%] space-y-1.5">
                        {m.route && <RoutePill route={m.route} />}
                        <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[14px] text-white/85">
                          {m.pending ? <span className="lp-shimmer">Working on it…</span> : m.text}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Memory tray */}
            <div className="px-5 pb-3 min-h-[40px]">
              <AnimatePresence>
                {memories.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1 lp-mono text-[10.5px] uppercase tracking-wider text-emerald-300/80 mr-1"><Brain className="w-3.5 h-3.5" /> Remembered</span>
                    {memories.map((mm) => (
                      <motion.span key={mm} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="rounded-full border border-emerald-300/25 bg-emerald-300/[0.07] px-2.5 py-1 text-[11.5px] text-emerald-100/90">
                        {mm}
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-white/[0.07] p-3.5">
              <div className="flex flex-wrap gap-2">
                {remaining.length ? remaining.map((c) => (
                  <motion.button
                    key={c.id}
                    type="button"
                    layout
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => run(c)}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[13px] text-white/80 hover:text-white hover:border-white/30 hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
                  >
                    {React.createElement(ROUTE_META[c.route].icon, { className: 'w-3.5 h-3.5', style: { color: ROUTE_META[c.route].color } })}
                    {c.label}
                  </motion.button>
                )) : (
                  <button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-2 text-[13px] text-white/70 hover:text-white">
                    <RotateCcw className="w-3.5 h-3.5" /> Start over
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Artifact panel */}
          <div className="order-1 lg:order-2 relative rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-5 md:p-7 flex flex-col">
            <div className="flex items-center justify-between lp-mono text-[11px] text-white/45">
              <span>SLIDE {String(selected + 1).padStart(2, '0')} / 05</span>
              <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5" /> same engine as the app</span>
            </div>
            <div className="flex-1 grid place-items-center py-5">
              <div className="w-full max-w-[330px] lp-slide-frame">
                <MorphSlide
                  morphKey={morphKey}
                  slide={slides[selected]}
                  templateId={state.templateId}
                  presetId={state.presetId}
                  slideNumber={selected + 1}
                  branding={DEMO_BRANDING}
                />
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {slides.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  aria-label={`Show slide ${i + 1}`}
                  className={`rounded-md overflow-hidden transition-all duration-300 ${i === selected ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-[#0b0b12]' : 'opacity-55 hover:opacity-90'}`}
                >
                  <LiveSlide slide={s} templateId={state.templateId} presetId={state.presetId} slideNumber={i + 1} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const RoutePill: React.FC<{ route: Route }> = ({ route }) => {
  const m = ROUTE_META[route];
  return (
    <div className="flex items-center gap-1.5 lp-mono text-[10.5px] uppercase tracking-wider" style={{ color: m.color }}>
      <m.icon className="w-3 h-3" /> Orchestrator → {m.label}
    </div>
  );
};
