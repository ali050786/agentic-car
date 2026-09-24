import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PRESETS } from '../../config/colorPresets';
import { TemplateId } from '../../types';
import { LiveSlide, MorphSlide } from './LiveSlide';
import { DECK, TEMPLATES, WALL_SLIDES, WALL_STYLES, DEMO_BRANDING } from './sampleDeck';
import { EASE, SectionHeading } from './primitives';

export const StyleLab: React.FC = () => {
  const [templateId, setTemplateId] = useState<TemplateId>('template-4');
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const [presetId, setPresetId] = useState('midnight');
  const [signature, setSignature] = useState(true);

  const presets = useMemo(() => PRESETS.filter((p) => (mode === 'light' ? p.id.endsWith('-light') : !p.id.endsWith('-light'))), [mode]);
  const tpl = TEMPLATES.find((t) => t.id === templateId)!;

  const switchMode = (m: 'dark' | 'light') => {
    setMode(m);
    const base = presetId.replace(/-light$/, '');
    setPresetId(m === 'light' ? `${base}-light` : base);
  };

  const trio = [DECK[0], DECK[1], DECK[2]];

  return (
    <section id="styles" className="relative py-28 md:py-36 overflow-hidden">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          eyebrow="Styles & brand"
          title={<>Three signature styles. <br className="hidden md:block" /><span className="lp-serif text-[1.08em] lp-prism-text">{PRESETS.length} palettes.</span> Your brand.</>}
          lede="Same words, instantly re-rendered. Pick a style, try a palette, add your signature card. Everything below is live."
        />

        <div className="mt-16 lp-glass rounded-[28px] p-4 md:p-6">
          {/* Controls */}
          <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:gap-6 justify-between">
            <div className="flex flex-wrap gap-1.5 rounded-2xl bg-black/30 p-1.5 border border-white/[0.06]">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => setTemplateId(t.id)} className="relative rounded-xl px-4 py-2.5 text-left">
                  {templateId === t.id && (
                    <motion.span layoutId="lp-tpl-pill" className="absolute inset-0 rounded-xl bg-white" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                  )}
                  <span className={`relative block text-[14px] font-semibold ${templateId === t.id ? 'text-black' : 'text-white/80'}`}>{t.name}</span>
                  <span className={`relative block text-[11px] ${templateId === t.id ? 'text-black/55' : 'text-white/40'}`}>{t.tagline}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex rounded-full bg-black/30 p-1 border border-white/[0.06] lp-mono text-[11px]">
                {(['dark', 'light'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => switchMode(m)} className="relative px-3 py-1.5 rounded-full uppercase tracking-wider">
                    {mode === m && <motion.span layoutId="lp-mode-pill" className="absolute inset-0 rounded-full bg-white/15" />}
                    <span className={`relative ${mode === m ? 'text-white' : 'text-white/45'}`}>{m}</span>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Color palette">
                {presets.map((p) => (
                  <motion.button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={presetId === p.id}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => setPresetId(p.id)}
                    whileHover={{ scale: 1.15, y: -2 }}
                    whileTap={{ scale: 0.9 }}
                    className={`relative w-7 h-7 rounded-full transition-shadow ${presetId === p.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#101018]' : 'ring-1 ring-white/15'}`}
                    style={{ background: `conic-gradient(${p.seeds.primary} 0 33%, ${p.seeds.secondary} 0 55%, ${p.seeds.background} 0 100%)` }}
                  />
                ))}
              </div>
              <label className="flex items-center gap-2 text-[12.5px] text-white/65 cursor-pointer select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={signature}
                  onClick={() => setSignature((v) => !v)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${signature ? 'bg-blue-500' : 'bg-white/15'}`}
                >
                  <motion.span layout className="absolute top-0.5 w-4 h-4 rounded-full bg-white" style={{ left: signature ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                </button>
                Signature card
              </label>
            </div>
          </div>

          {/* Stage */}
          <div className="mt-6 grid md:grid-cols-[1fr_2.2fr] gap-6 items-center rounded-[20px] bg-black/25 border border-white/[0.05] p-5 md:p-8">
            <div>
              <motion.div key={tpl.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}>
                <div className="lp-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Style</div>
                <div className="lp-display mt-2 text-[34px] font-semibold text-white">{tpl.name}</div>
                <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--lp-muted)]">{tpl.description}</p>
              </motion.div>
              <div className="mt-6 lp-mono text-[11px] uppercase tracking-[0.18em] text-white/40">Palette</div>
              <div className="mt-1.5 text-[15px] text-white/85">{PRESETS.find((p) => p.id === presetId)?.name}</div>
              <div className="mt-6 flex flex-wrap gap-2 text-[12px] text-white/55">
                {['Portrait 4:5', 'Square 1:1', 'Custom brand colors'].map((x) => (
                  <span key={x} className="rounded-full border border-white/10 px-2.5 py-1">{x}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 md:gap-4" style={{ perspective: 1200 }}>
              {trio.map((s, i) => (
                <motion.div key={i} className="lp-slide-frame" whileHover={{ y: -8, rotateX: 4, rotateY: i === 0 ? 6 : i === 2 ? -6 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <MorphSlide
                    morphKey={`${templateId}-${presetId}-${signature}`}
                    slide={s}
                    templateId={templateId}
                    presetId={presetId}
                    slideNumber={i + 1}
                    branding={signature ? DEMO_BRANDING : undefined}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <StyleWall />
    </section>
  );
};

/** Two opposing marquee rows of real slides across every style. */
const StyleWall: React.FC = () => {
  const rowA = WALL_SLIDES.map((s, i) => ({ s, ...WALL_STYLES[i % WALL_STYLES.length] }));
  const rowB = [...WALL_SLIDES].reverse().map((s, i) => ({ s, ...WALL_STYLES[(i + 3) % WALL_STYLES.length] }));
  return (
    <div className="mt-20 space-y-5 lp-marquee" aria-hidden="true">
      {[rowA, rowB].map((row, r) => (
        <div key={r} className="overflow-hidden">
          <div className={`lp-marquee-track gap-5 ${r === 1 ? 'reverse' : ''}`} style={{ ['--lp-marquee-dur' as string]: r ? '75s' : '65s' }}>
            {[...row, ...row].map((c, i) => (
              <div key={i} className="w-[180px] md:w-[210px] shrink-0 lp-slide-frame transition-transform duration-500 hover:-translate-y-2 hover:scale-[1.03]">
                <LiveSlide slide={c.s} templateId={c.templateId} presetId={c.presetId} slideNumber={(i % row.length) + 1} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
