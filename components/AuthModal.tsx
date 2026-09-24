import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import {
    isValidEmail,
    isValidPassword,
    getPasswordStrength,
    formatAuthError
} from '../utils/authUtils';
import { Mail, Lock, User, AlertCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloseButton, DrawCheck, Field, Modal, Spinner, inputClass } from './studio/ui';
import { LogoMark } from './landing/primitives';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialMode?: 'signup' | 'login';
    message?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
    isOpen,
    onClose,
    initialMode = 'signup',
    message = 'Create an account to save your work'
}) => {
    const { signUp, signIn, signInWithGoogle } = useAuthStore();
    const [mode, setMode] = useState<'signup' | 'login'>(initialMode);

    // Re-sync the tab whenever the modal is (re)opened with a different intent
    // ("Sign in to keep it" vs "Sign up"); useState alone only reads it once.
    useEffect(() => {
        if (isOpen) setMode(initialMode);
    }, [isOpen, initialMode]);

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Real-time password strength indicator (only for signup)
    const passwordStrength = formData.password ? getPasswordStrength(formData.password) : null;

    const validateForm = (): boolean => {
        const newErrors: { [key: string]: string } = {};

        if (mode === 'signup') {
            if (!formData.fullName.trim()) {
                newErrors.fullName = 'Full name is required';
            } else if (formData.fullName.trim().length < 2) {
                newErrors.fullName = 'Name must be at least 2 characters';
            }

            if (formData.password !== formData.confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!isValidEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (mode === 'signup' && !isValidPassword(formData.password)) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setErrors({});

        try {
            if (mode === 'signup') {
                const { error } = await signUp({
                    email: formData.email,
                    password: formData.password,
                    fullName: formData.fullName,
                });

                if (error) {
                    setErrors({ submit: formatAuthError(error) });
                } else {
                    setShowSuccess(true);
                    // Close after success message
                    setTimeout(() => {
                        onClose();
                        // Reset state
                        setShowSuccess(false);
                        setFormData({ email: '', password: '', confirmPassword: '', fullName: '' });
                    }, 2000);
                }
            } else {
                const { error } = await signIn({
                    email: formData.email,
                    password: formData.password,
                });

                if (error) {
                    setErrors({ submit: formatAuthError(error) });
                } else {
                    // Login successful, close modal immediately
                    onClose();
                    setFormData({ email: '', password: '', confirmPassword: '', fullName: '' });
                }
            }
        } catch (err) {
            setErrors({ submit: 'An unexpected error occurred' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsLoading(true);
        setErrors({});

        const { error } = await signInWithGoogle();

        if (error) {
            setIsLoading(false);
            setErrors({ submit: formatAuthError(error) });
        }
        // For OAuth, the redirect happens automatically
    };

    const switchMode = (newMode: 'signup' | 'login') => {
        setMode(newMode);
        setErrors({});
        // Keep email if entered
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '', fullName: '' }));
    };

    const GoogleIcon = (
        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );

    const strengthLevel = passwordStrength === 'strong' ? 3 : passwordStrength === 'medium' ? 2 : passwordStrength === 'weak' ? 1 : 0;
    const strengthColor = strengthLevel === 3 ? '#6ee7b7' : strengthLevel === 2 ? '#fcd34d' : '#fda4af';

    return (
        <Modal open={isOpen} onClose={onClose} className="max-w-[420px] overflow-hidden" labelledBy="auth-title">
            <div className="absolute inset-x-0 top-0 h-40 pointer-events-none bg-[radial-gradient(60%_100%_at_50%_0%,rgba(155,107,255,0.22),transparent)]" />
            <div className="absolute top-3 right-3 z-10"><CloseButton onClick={onClose} /></div>

            <AnimatePresence mode="wait" initial={false}>
                {showSuccess ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="relative p-10 text-center">
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 16 }} className="mx-auto mb-5 grid place-items-center w-16 h-16 rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/40">
                            <DrawCheck size={30} color="#6ee7b7" />
                        </motion.div>
                        <h2 className="lp-display text-[24px] font-semibold text-white">You’re in.</h2>
                        <p className="mt-2 text-[13.5px] text-white/55">Account created. Check your inbox to verify your email.</p>
                    </motion.div>
                ) : (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative max-h-[88vh] overflow-y-auto st-scroll">
                        <div className="px-7 pt-8 pb-2 text-center">
                            <div className="inline-flex mb-4"><LogoMark size={40} /></div>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.h2 id="auth-title" key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="lp-display text-[24px] font-semibold text-white">
                                    {mode === 'signup' ? <>Create your <span className="lp-serif lp-prism-text text-[1.1em]">studio</span></> : <>Welcome <span className="lp-serif lp-prism-text text-[1.1em]">back</span></>}
                                </motion.h2>
                            </AnimatePresence>
                            <p className="mt-2 text-[13px] text-white/50">{message}</p>
                        </div>

                        <div className="px-7 pb-7 pt-4">
                            <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={handleGoogleSignIn}
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2.5 h-11 rounded-full bg-white text-black text-[13.5px] font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
                            >
                                {GoogleIcon} Continue with Google
                            </motion.button>

                            <div className="flex items-center gap-3 my-5 text-[11px] text-white/35">
                                <span className="flex-1 h-px bg-white/10" /> or with email <span className="flex-1 h-px bg-white/10" />
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                                <AnimatePresence initial={false}>
                                    {mode === 'signup' && (
                                        <motion.div key="name" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                            <Field label="Full name" error={errors.fullName}>
                                                <div className="relative">
                                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                                                    <input type="text" autoComplete="name" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} className={`${inputClass(!!errors.fullName)} pl-10`} placeholder="Jane Doe" />
                                                </div>
                                            </Field>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <Field label="Email" error={errors.email}>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                                        <input type="email" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={`${inputClass(!!errors.email)} pl-10`} placeholder="you@example.com" />
                                    </div>
                                </Field>

                                <Field
                                    label="Password"
                                    error={errors.password}
                                    aside={mode === 'login' ? <Link to="/forgot-password" onClick={onClose} className="text-[11.5px] text-violet-300 hover:text-violet-200">Forgot?</Link> : undefined}
                                >
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                                        <input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className={`${inputClass(!!errors.password)} pl-10`} placeholder="••••••••" />
                                    </div>
                                    {mode === 'signup' && formData.password && !errors.password && (
                                        <div className="mt-2 flex gap-1">
                                            {[1, 2, 3].map(l => (
                                                <motion.span key={l} className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
                                                    <motion.span className="block h-full rounded-full" animate={{ width: strengthLevel >= l ? '100%' : '0%', backgroundColor: strengthColor }} transition={{ duration: 0.35 }} />
                                                </motion.span>
                                            ))}
                                        </div>
                                    )}
                                </Field>

                                <AnimatePresence initial={false}>
                                    {mode === 'signup' && (
                                        <motion.div key="confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                            <Field label="Confirm password" error={errors.confirmPassword}>
                                                <div className="relative">
                                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                                                    <input type="password" autoComplete="new-password" value={formData.confirmPassword} onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })} className={`${inputClass(!!errors.confirmPassword)} pl-10`} placeholder="••••••••" />
                                                </div>
                                            </Field>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <AnimatePresence>
                                    {errors.submit && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -3, 3, 0] }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }} className="overflow-hidden">
                                            <div className="flex items-center gap-2 rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2.5 text-[12px] text-rose-100">
                                                <AlertCircle size={14} className="shrink-0" /> {errors.submit}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <motion.button
                                    type="submit"
                                    whileTap={{ scale: 0.98 }}
                                    disabled={isLoading}
                                    className="lp-btn-primary w-full h-11 justify-center text-[13.5px] disabled:opacity-70"
                                >
                                    {isLoading ? <><Spinner size={15} /> {mode === 'signup' ? 'Creating account…' : 'Signing in…'}</> : mode === 'signup' ? 'Create account' : 'Sign in'}
                                </motion.button>
                            </form>

                            <p className="mt-6 text-center text-[13px] text-white/50">
                                {mode === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
                                <button onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')} className="font-medium text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                                    {mode === 'signup' ? 'Sign in' : 'Create an account'}
                                </button>
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </Modal>
    );
};
