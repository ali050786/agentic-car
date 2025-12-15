/**
 * Auth Callback Page
 * 
 * Handles OAuth redirect after Google/GitHub sign in.
 * Shows loading while processing, then redirects to home.
 * 
 * Location: src/pages/AuthCallback.tsx
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from 'lucide-react';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Appwrite handles the callback automatically
    // Just wait a moment then redirect to home
    const timer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-900/20">
            <Layout className="w-6 h-6 text-white" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Signing you in...</h2>
            <p className="text-neutral-400 text-sm">Please wait a moment</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;