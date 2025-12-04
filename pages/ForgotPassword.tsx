/**
 * Forgot Password Page
 * 
 * Request password reset email.
 * User enters email, receives reset link.
 * 
 * Location: src/pages/ForgotPassword.tsx
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { isValidEmail, formatAuthError } from '../utils/authUtils';
import { Layout, Mail, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

export const ForgotPassword: React.FC = () => {
  const { resetPassword } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Email is required');
      return;
    }
    
    if (!isValidEmail(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    setError('');

    const { error: resetError } = await resetPassword(email);

    setIsLoading(false);

    if (resetError) {
      setError(formatAuthError(resetError));
    } else {
      setIsSuccess(true);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-neutral-900 border border-green-500/50 rounded-xl p-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            
            <h2 className="text-2xl font-bold text-white text-center mb-2">
              Check your email
            </h2>
            
            <p className="text-neutral-400 text-center mb-6">
              We've sent a password reset link to <span className="text-white font-medium">{email}</span>
            </p>
            
            <div className="space-y-3">
              <p className="text-sm text-neutral-500 text-center">
                Click the link in the email to reset your password.
              </p>
              
              <p className="text-sm text-neutral-500 text-center">
                Didn't receive the email? Check your spam folder.
              </p>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <Link 
                to="/login"
                className="flex items-center justify-center gap-2 w-full py-3 bg-black/40 hover:bg-black/60 border border-white/10 rounded-lg text-white transition-colors"
              >
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-900/20">
              <Layout className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Forgot password?</h1>
          <p className="text-neutral-400">No worries, we'll send you reset instructions</p>
        </div>

        {/* Reset Form */}
        <div className="bg-neutral-900 border border-white/10 rounded-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full pl-11 pr-4 py-3 bg-black/40 border rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors ${
                    error ? 'border-red-500' : 'border-white/10'
                  }`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              {error && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle size={14} />
                  {error}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                isLoading
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </div>
              ) : (
                'Send Reset Link'
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <Link 
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;