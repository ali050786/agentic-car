/**
 * Auth Callback Page
 * 
 * Handles OAuth redirect after Google/GitHub sign in.
 * Exchanges OAuth tokens for a session (Safari-compatible token-based flow).
 * 
 * Location: src/pages/AuthCallback.tsx
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Layout, AlertCircle } from 'lucide-react';
import { account } from '../lib/appwriteClient';
import { useAuthStore } from '../store/useAuthStore';

export const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { initialize } = useAuthStore();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Extract OAuth tokens from URL parameters
        const userId = searchParams.get('userId');
        const secret = searchParams.get('secret');

        // Validate tokens are present
        if (!userId || !secret) {
          console.error('Missing OAuth tokens in callback URL');
          setError('Authentication failed: Invalid callback parameters');
          setTimeout(() => {
            navigate('/login?error=oauth_invalid_tokens', { replace: true });
          }, 3000);
          return;
        }

        // Exchange tokens for a session
        console.log('[AuthCallback] Creating session from OAuth tokens...');
        await account.createSession(userId, secret);

        // Initialize auth store to fetch user data
        await initialize();

        console.log('[AuthCallback] Authentication successful, redirecting...');

        // Redirect to app
        setTimeout(() => {
          navigate('/app', { replace: true });
        }, 1000);
      } catch (err: any) {
        console.error('[AuthCallback] Error creating session:', err);
        setError(err.message || 'Failed to complete authentication');

        // Redirect to login with error
        setTimeout(() => {
          navigate('/login?error=oauth_session_failed', { replace: true });
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [navigate, searchParams, initialize]);

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg shadow-blue-900/20">
            <Layout className="w-6 h-6 text-white" />
          </div>
        </div>

        {error ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Authentication Error</h2>
              <p className="text-neutral-400 text-sm max-w-md">{error}</p>
              <p className="text-neutral-500 text-xs mt-2">Redirecting to login...</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Signing you in...</h2>
              <p className="text-neutral-400 text-sm">Please wait a moment</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;