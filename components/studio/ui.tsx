import React, { useEffect } from 'react';
import { AnimatePresence, motion, HTMLMotionProps } from 'framer-motion';
import { X } from 'lucide-react';

/** Shared easing + springs so every studio motion feels like one system. */
export const EASE = [0.16, 1, 0.3, 1] as const;
export const SPRING = { type: 'spring', stiffness: 420, damping: 32, mass: 0.7 } as const;
export const SOFT_SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

/* ------------------------------------------------------------------ */
/* Agent phases — derived from the worker's real status messages        */
/* ("PLAN: …", "EXECUTE: …", "REFLECT: …", "Art Director: …", "Saving…")*/
/* ------------------------------------------------------------------ */

export type Phase = 'PLAN' | 'EXECUTE' | 'REFLECT' | 'SKETCH' | 'DELIVER' | 'THINK';

export const PHASE_COLOR: Record<Phase, string> = {
  PLAN: '#3ee6f5',
  EXECUTE: '#4f8cff',
  REFLECT: '#9b6bff',
  SKETCH: '#ff7a8a',
  DELIVER: '#b6f36a',
  THINK: '#c9c9d6',
};

export const phaseOf = (status?: string | null): Phase => {
  const s = (status || '').trim().toLowerCase();
  if (s.startsWith('plan')) return 'PLAN';
  if (s.startsWith('execute')) return 'EXECUTE';
  if (s.startsWith('reflect')) return 'REFLECT';
  if (s.includes('sketch') || s.includes('art director') || s.includes('doodle')) return 'SKETCH';
  if (s.startsWith('saving') || s.includes('finaliz') || s.includes('done')) return 'DELIVER';
  return 'THINK';
};

/** Strips the "PHASE:" prefix so the label reads like a sentence. */
export const phaseLabel = (status?: string | null) =>
  (status || '').replace(/^(PLAN|EXECUTE|REFLECT):\s*/i, '').replace(/\.\.\.$|…$/, '');

/* ------------------------------ atoms ------------------------------ */

export const Spinner: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 14, color = 'currentColor', className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
    <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.2" strokeWidth="3" fill="none" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

/** A check mark that draws itself — for "saved" / "copied" moments. */
export const DrawCheck: React.FC<{ size?: number; color?: string }> = ({ size = 14, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <motion.path
      d="M5 12.5l4.2 4.2L19 7"
      stroke={color}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.45, ease: EASE }}
    />
  </svg>
);

export const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => <kbd className="st-kbd">{children}</kbd>;

interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  tip?: string;
  tipPos?: 'top' | 'bottom' | 'right';
  active?: boolean;
  children: React.ReactNode;
}

/** Square icon button with a delayed CSS tooltip and a press micro-interaction. */
export const IconButton: React.FC<IconButtonProps> = ({ tip, tipPos = 'bottom', active, className = '', children, ...rest }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.9 }}
    data-tip={tip}
    data-tip-pos={tipPos}
    aria-label={rest['aria-label'] ?? tip}
    className={`${tip ? 'st-tip' : ''} grid place-items-center w-8 h-8 rounded-[10px] transition-colors disabled:opacity-35 disabled:pointer-events-none ${
      active ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white hover:bg-white/[0.07]'
    } ${className}`}
    {...rest}
  >
    {children}
  </motion.button>
);

/** Segmented control with a sliding pill (shared layoutId per group). */
export function Segmented<T extends string>({
  id, value, options, onChange, size = 'sm', className = '',
}: {
  id: string;
  value: T;
  options: { value: T; label: React.ReactNode; title?: string }[];
  onChange: (v: T) => void;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  return (
    <div className={`relative inline-flex items-center rounded-full bg-black/35 border border-white/[0.08] p-0.5 ${className}`} role="radiogroup">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full font-medium transition-colors ${size === 'xs' ? 'px-2.5 py-1 text-[10.5px]' : 'px-3 py-1.5 text-[11.5px]'} ${
              on ? 'text-black' : 'text-white/55 hover:text-white'
            }`}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-white" transition={SPRING} />}
            <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Animated popover shell. Parent controls `open`; position with className. */
export const Popover: React.FC<{
  open: boolean;
  className?: string;
  origin?: string;
  children: React.ReactNode;
  innerRef?: React.Ref<HTMLDivElement>;
}> = ({ open, className = '', origin = 'top right', children, innerRef }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        ref={innerRef}
        initial={{ opacity: 0, scale: 0.94, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -4, transition: { duration: 0.14 } }}
        transition={SPRING}
        style={{ transformOrigin: origin }}
        className={`st-popover rounded-2xl overflow-hidden ${className}`}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
);

/** Staggered menu item for popovers. */
export const MenuItem: React.FC<{
  icon?: React.ReactNode;
  label: React.ReactNode;
  hint?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  i?: number;
}> = ({ icon, label, hint, danger, disabled, onClick, i = 0 }) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, x: -6 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.03 + i * 0.035, duration: 0.3, ease: EASE }}
    disabled={disabled}
    onClick={onClick}
    className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors disabled:opacity-40 ${
      danger ? 'text-rose-300 hover:bg-rose-500/10' : 'text-white/85 hover:bg-white/[0.06]'
    }`}
  >
    {icon && <span className={`grid place-items-center w-7 h-7 rounded-lg border shrink-0 transition-colors ${danger ? 'border-rose-400/20 bg-rose-400/5' : 'border-white/10 bg-white/[0.03] group-hover:border-white/20'}`}>{icon}</span>}
    <span className="min-w-0 flex-1">
      <span className="block text-[12.5px] font-medium">{label}</span>
      {hint && <span className="block text-[11px] text-white/40 mt-0.5">{hint}</span>}
    </span>
  </motion.button>
);

/** Modal shell: fading blurred backdrop, spring panel, Esc to close. */
export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: 'center' | 'drawer';
  labelledBy?: string;
}> = ({ open, onClose, children, className = '', variant = 'center', labelledBy }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className={`fixed inset-0 z-[70] ${variant === 'center' ? 'grid place-items-center p-4' : ''}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
          <motion.div
            className="absolute inset-0 bg-[#050509]/70 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          {variant === 'center' ? (
            <motion.div
              className={`relative st-popover rounded-[24px] w-full ${className}`}
              initial={{ opacity: 0, y: 24, scale: 0.96, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(6px)', transition: { duration: 0.18 } }}
              transition={SOFT_SPRING}
            >
              {children}
            </motion.div>
          ) : (
            <motion.div
              className={`absolute right-0 top-0 h-full st-popover !rounded-none !rounded-l-[28px] ${className}`}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%', transition: { duration: 0.25, ease: EASE } }}
              transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            >
              {children}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};

export const CloseButton: React.FC<{ onClick: () => void; label?: string }> = ({ onClick, label = 'Close' }) => (
  <motion.button
    type="button"
    onClick={onClick}
    aria-label={label}
    whileHover={{ rotate: 90 }}
    whileTap={{ scale: 0.9 }}
    transition={SPRING}
    className="grid place-items-center w-8 h-8 rounded-full text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
  >
    <X size={16} />
  </motion.button>
);

/** Field wrapper used by the form-y overlays. */
export const Field: React.FC<{ label: string; error?: string; aside?: React.ReactNode; children: React.ReactNode }> = ({ label, error, aside, children }) => (
  <label className="block">
    <span className="flex items-center justify-between mb-1.5">
      <span className="text-[12px] font-medium text-white/60">{label}</span>
      {aside}
    </span>
    {children}
    <AnimatePresence>
      {error && (
        <motion.span initial={{ opacity: 0, height: 0, y: -4 }} animate={{ opacity: 1, height: 'auto', y: 0 }} exit={{ opacity: 0, height: 0 }} className="block mt-1.5 text-[11.5px] text-rose-300 overflow-hidden">
          {error}
        </motion.span>
      )}
    </AnimatePresence>
  </label>
);

export const inputClass = (invalid?: boolean) =>
  `w-full rounded-xl bg-black/35 border px-3.5 py-2.5 text-[13.5px] text-white placeholder-white/30 outline-none transition-[border-color,box-shadow] duration-200 focus:border-violet-400/60 focus:shadow-[0_0_0_4px_rgba(155,107,255,0.14)] ${
    invalid ? 'border-rose-400/60' : 'border-white/10 hover:border-white/20'
  }`;
