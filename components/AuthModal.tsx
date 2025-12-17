import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import {
    isValidEmail,
    isValidPassword,
    getPasswordStrength,
    formatAuthError
} from '../utils/authUtils';
import { Layout, Mail, Lock, User, AlertCircle, CheckCircle, X } from 'lucide-react';

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

    if (!isOpen) return null;

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

    if (showSuccess) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-neutral-900 border border-green-500/50 rounded-xl p-8 text-center max-w-sm w-full relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-300">
                        <X size={20} />
                    </button>
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
                    <p className="text-neutral-400 mb-4">
                        Welcome aboard! You can now verify your email.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 pb-2 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 mb-3">
                            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-900/20">
                                <Layout className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1">
                            {mode === 'signup' ? 'Create your account' : 'Welcome back'}
                        </h2>
                        <p className="text-sm text-neutral-400">
                            {message}
                        </p>
                    </div>
                </div>

                <div className="overflow-y-auto px-6 pb-6 pt-2">
                    {/* OAuth Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white text-black hover:bg-neutral-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm mb-4"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>

                    <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="px-2 bg-neutral-900 text-neutral-500">Or continue with email</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Full Name - Only for SignUp */}
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                    <input
                                        type="text"
                                        value={formData.fullName}
                                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                                        className={`w-full pl-9 pr-3 py-2.5 bg-black/40 border rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors ${errors.fullName ? 'border-red-500' : 'border-white/10'
                                            }`}
                                        placeholder="John Doe"
                                    />
                                </div>
                                {errors.fullName && (
                                    <p className="mt-1 text-xs text-red-400">{errors.fullName}</p>
                                )}
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className={`w-full pl-9 pr-3 py-2.5 bg-black/40 border rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors ${errors.email ? 'border-red-500' : 'border-white/10'
                                        }`}
                                    placeholder="you@example.com"
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1 text-xs text-red-400">{errors.email}</p>
                            )}
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className={`w-full pl-9 pr-3 py-2.5 bg-black/40 border rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors ${errors.password ? 'border-red-500' : 'border-white/10'
                                        }`}
                                    placeholder="••••••••"
                                />
                            </div>
                            {errors.password && (
                                <p className="mt-1 text-xs text-red-400">{errors.password}</p>
                            )}

                            {/* Password Strength Indicator */}
                            {mode === 'signup' && formData.password && !errors.password && (
                                <div className="mt-2">
                                    <div className="flex gap-1 mb-1">
                                        <div className={`h-1 flex-1 rounded ${passwordStrength === 'weak' ? 'bg-red-500' : passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                                        <div className={`h-1 flex-1 rounded ${passwordStrength === 'medium' || passwordStrength === 'strong' ? passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500' : 'bg-neutral-700'}`} />
                                        <div className={`h-1 flex-1 rounded ${passwordStrength === 'strong' ? 'bg-green-500' : 'bg-neutral-700'}`} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password - Only for SignUp */}
                        {mode === 'signup' && (
                            <div>
                                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                                    Confirm Password
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                                    <input
                                        type="password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        className={`w-full pl-9 pr-3 py-2.5 bg-black/40 border rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors ${errors.confirmPassword ? 'border-red-500' : 'border-white/10'
                                            }`}
                                        placeholder="••••••••"
                                    />
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>
                                )}
                            </div>
                        )}

                        {/* Submit Error */}
                        {errors.submit && (
                            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                                <p className="text-xs text-red-200 flex items-center gap-2">
                                    <AlertCircle size={14} />
                                    {errors.submit}
                                </p>
                            </div>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${isLoading
                                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                                }`}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {mode === 'signup' ? 'Creating account...' : 'Signing in...'}
                                </div>
                            ) : (
                                mode === 'signup' ? 'Create Account' : 'Sign In'
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-sm text-neutral-400">
                            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                            <button
                                onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}
                                className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
                            >
                                {mode === 'signup' ? 'Sign in' : 'Sign up'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
