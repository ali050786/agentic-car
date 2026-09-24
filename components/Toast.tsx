import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, X, AlertCircle } from 'lucide-react';
import { ToastMessage, ToastType } from '../hooks/useToast';
import { Spinner } from './studio/ui';

interface ToastProps {
    toasts: ToastMessage[];
    onRemove: (id: string) => void;
}

const TONE: Record<ToastType, { color: string; icon: React.ReactNode }> = {
    success: { color: '#6ee7b7', icon: <Check size={13} strokeWidth={3} /> },
    error: { color: '#fda4af', icon: <AlertCircle size={14} /> },
    warning: { color: '#fcd34d', icon: <AlertTriangle size={13} /> },
    info: { color: '#93c5fd', icon: <Info size={14} /> },
};

/** Stacked glass toasts, bottom-center, with a countdown hairline. */
export const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => (
    <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[90] flex flex-col-reverse items-center gap-2 pointer-events-none w-[min(440px,calc(100vw-24px))]" aria-live="polite">
        <AnimatePresence initial={false}>
            {toasts.map((toast) => {
                const tone = TONE[toast.type] || TONE.info;
                const persistent = toast.duration === 0;
                return (
                    <motion.div
                        key={toast.id}
                        layout
                        initial={{ opacity: 0, y: 24, scale: 0.9, filter: 'blur(6px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 12, scale: 0.94, filter: 'blur(4px)', transition: { duration: 0.2 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="pointer-events-auto relative overflow-hidden w-full flex items-center gap-3 rounded-2xl st-popover pl-3 pr-2 py-2.5"
                        role={toast.type === 'error' ? 'alert' : 'status'}
                    >
                        <span className="grid place-items-center w-7 h-7 rounded-full shrink-0" style={{ background: `${tone.color}1f`, color: tone.color, boxShadow: `0 0 0 1px ${tone.color}40` }}>
                            {persistent && toast.type === 'info' ? <Spinner size={13} color={tone.color} /> : tone.icon}
                        </span>
                        <p className="flex-1 text-[13px] text-white/90 leading-snug">{toast.message}</p>
                        <button
                            onClick={() => onRemove(toast.id)}
                            className="grid place-items-center w-7 h-7 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            aria-label="Dismiss"
                        >
                            <X size={14} />
                        </button>
                        {!persistent && (
                            <motion.span
                                className="absolute left-0 bottom-0 h-[2px] origin-left"
                                style={{ background: tone.color, width: '100%' }}
                                initial={{ scaleX: 1, opacity: 0.6 }}
                                animate={{ scaleX: 0 }}
                                transition={{ duration: (toast.duration ?? 3000) / 1000, ease: 'linear' }}
                            />
                        )}
                    </motion.div>
                );
            })}
        </AnimatePresence>
    </div>
);
