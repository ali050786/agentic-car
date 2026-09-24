import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, FileText, Link2, Lightbulb, Loader2, Paperclip, Youtube } from 'lucide-react';
import { detectInputMode } from '../../utils/inputDetector';
import { EASE } from './primitives';

/** sessionStorage key read by ChatPanel to prefill the composer in /app. */
export const LANDING_PROMPT_KEY = 'ac:landing-prompt';

const EXAMPLES = [
  'Why most personal brands stall at 1,000 followers',
  'https://youtube.com/watch?v=… turn this talk into 8 slides',
  '5 pricing mistakes early SaaS founders make',
  'https://yourblog.com/post  summarize it for LinkedIn',
  'A beginner’s guide to prompt engineering, in the Sketch style',
];

const CHIPS = [
  { label: 'Founder lessons', value: '7 lessons from 3 years of building in public' },
  { label: 'Paste a YouTube link', value: 'https://youtu.be/' },
  { label: 'Explain a concept', value: 'What is RAG? Explain it to a non-technical marketer' },
];

const MODE_META = {
  topic: { label: 'Topic', icon: Lightbulb, tint: 'text-amber-300' },
  text: { label: 'Long-form text', icon: FileText, tint: 'text-emerald-300' },
  url: { label: 'Article link', icon: Link2, tint: 'text-sky-300' },
  video: { label: 'YouTube video', icon: Youtube, tint: 'text-rose-300' },
} as const;

/** Cycles typed-out example prompts as an animated placeholder. */
const usePlaceholderCycle = (active: boolean) => {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [n, setN] = useState(0);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (!active) return;
    if (reduce) { setN(EXAMPLES[idx].length); return; }
    const full = EXAMPLES[idx];
    let t: number;
    if (!deleting && n < full.length) t = window.setTimeout(() => setN(n + 1), 32);
    else if (!deleting && n === full.length) t = window.setTimeout(() => setDeleting(true), 1800);
    else if (deleting && n > 0) t = window.setTimeout(() => setN(n - 1), 14);
    else { setDeleting(false); setIdx((idx + 1) % EXAMPLES.length); t = 0; }
    return () => window.clearTimeout(t);
  }, [active, n, deleting, idx, reduce]);
  return EXAMPLES[idx].slice(0, n);
};

export const PromptComposer: React.FC<{ size?: 'lg' | 'md'; showChips?: boolean; autoFocus?: boolean }> = ({ size = 'lg', showChips = true }) => {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const [launching, setLaunching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const placeholder = usePlaceholderCycle(!value && !focused);

  const detected = useMemo(() => (value.trim() ? detectInputMode(value).mode : null), [value]);
  const meta = detected ? MODE_META[detected] : null;

  const launch = (text: string) => {
    const prompt = text.trim();
    setLaunching(true);
    try {
      if (prompt) sessionStorage.setItem(LANDING_PROMPT_KEY, prompt);
    } catch { /* storage unavailable: the app still opens, just without the prefill */ }
    window.setTimeout(() => navigate('/app'), 650);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) { inputRef.current?.focus(); return; }
    launch(value);
  };

  const lg = size === 'lg';

  return (
    <div className="w-full">
      <form onSubmit={onSubmit} className={`lp-conic lp-glass ${lg ? 'rounded-[22px]' : 'rounded-[18px]'} flex items-center gap-2 ${lg ? 'p-2.5 pl-3' : 'p-2 pl-3'}`}>
        {/* Detected input type badge */}
        <div className="hidden sm:flex shrink-0 items-center">
          <AnimatePresence mode="wait" initial={false}>
            {meta ? (
              <motion.span
                key={detected}
                initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-white/80 lp-mono"
                title="Detected automatically, just like in the app"
              >
                <meta.icon className={`w-3.5 h-3.5 ${meta.tint}`} />
                {meta.label}
              </motion.span>
            ) : (
              <motion.span key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid place-items-center w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10">
                <SparkIcon />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-label="Describe your carousel, or paste a link"
            className={`w-full bg-transparent text-white outline-none placeholder-transparent ${lg ? 'text-[16px] md:text-[17px] h-12' : 'text-[15px] h-11'}`}
            placeholder="Describe your carousel, or paste a link"
          />
          {!value && (
            <div className={`pointer-events-none absolute inset-0 flex items-center text-white/40 truncate ${lg ? 'text-[16px] md:text-[17px]' : 'text-[15px]'}`}>
              {focused ? 'Describe your carousel, or paste a link…' : (
                <span className="truncate">{placeholder}<span className="lp-caret" /></span>
              )}
            </div>
          )}
        </div>

        <span className="hidden md:grid place-items-center w-9 h-9 rounded-xl text-white/40 hover:text-white/80 transition-colors" title="PDF, DOCX, Markdown and TXT uploads are supported in the app">
          <Paperclip className="w-4 h-4" />
        </span>

        <motion.button
          type="submit"
          whileTap={{ scale: 0.95 }}
          disabled={launching}
          className={`lp-btn-primary shrink-0 justify-center ${lg ? 'h-12 px-5 text-[15px]' : 'h-11 px-4 text-[14px]'}`}
          aria-label="Generate carousel"
        >
          <AnimatePresence mode="wait" initial={false}>
            {launching ? (
              <motion.span key="l" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Waking the agents
              </motion.span>
            ) : (
              <motion.span key="g" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
                <span className="hidden sm:inline">Generate</span>
                <span className="grid place-items-center w-6 h-6 rounded-full bg-black text-white"><ArrowUp className="w-3.5 h-3.5" /></span>
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </form>

      {showChips && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="lp-mono text-[11px] uppercase tracking-[0.16em] text-white/35 mr-1">Try</span>
          {CHIPS.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={() => { setValue(c.value); inputRef.current?.focus(); }}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] text-white/70 hover:text-white hover:border-white/25 hover:bg-white/[0.07] transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SparkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="lp-spark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#3ee6f5" />
        <stop offset=".5" stopColor="#9b6bff" />
        <stop offset="1" stopColor="#ff7a8a" />
      </linearGradient>
    </defs>
    <path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7L12 2z" fill="url(#lp-spark)" />
    <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" fill="url(#lp-spark)" opacity=".7" />
  </svg>
);
