import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
    const { freeUsageCount, freeUsageLoading, fetchFreeUsageCount, userApiKey, setUserApiKey, clearUserApiKey, apiKeyProvider } = useAuthStore();

    const [provider, setProvider] = useState<'openrouter' | 'openai' | 'anthropic'>(apiKeyProvider || 'openrouter');
    const [apiKey, setApiKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch usage count when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchFreeUsageCount();
        }
    }, [isOpen, fetchFreeUsageCount]);

    // Pre-fill API key if user already has one for current provider
    useEffect(() => {
        if (userApiKey && apiKeyProvider === provider) {
            setApiKey(userApiKey);
        } else {
            setApiKey(''); // Clear if switching to different provider
        }
    }, [userApiKey, apiKeyProvider, provider]);

    // Clear API key input when provider changes (force user to enter new key)
    useEffect(() => {
        setApiKey('');
    }, [provider]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!apiKey.trim()) {
            alert('Please enter an API key');
            return;
        }

        setIsSaving(true);
        try {
            setUserApiKey(apiKey.trim(), provider);
            alert(`API key saved successfully! You can now generate carousels using ${provider}.`);
            onClose();
        } catch (error) {
            console.error('Error saving API key:', error);
            alert('Failed to save API key. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleClearKey = () => {
        if (confirm('Are you sure you want to remove your API key? You will go back to using free tier.')) {
            clearUserApiKey();
            setApiKey('');
            alert('API key removed. You can now use the free tier again.');
        }
    };

    const progressPercent = Math.min((freeUsageCount / 3) * 100, 100);
    const isFreeTierExhausted = freeUsageCount >= 3;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-md bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-6 m-4">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    aria-label="Close modal"
                    title="Close modal"
                >
                    <X size={24} />
                </button>

                {/* Header */}
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {userApiKey ? 'Manage API Key' : 'Add Your API Key'}
                    </h2>
                    <p className="text-gray-400 text-sm">
                        {isFreeTierExhausted
                            ? 'Free credits exhausted. Add your API key to continue generating carousels.'
                            : 'Use your own API key for premium models and unlimited generations.'}
                    </p>
                </div>

                {/* Progress Bar - Free Trial Usage */}
                {!userApiKey && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-gray-300">Free Trial Usage</span>
                            <span className="text-sm font-bold text-blue-400">{freeUsageCount}/3 Used</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${isFreeTierExhausted
                                    ? 'bg-gradient-to-r from-red-500 to-red-600'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                    }`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        {isFreeTierExhausted && (
                            <p className="text-red-400 text-xs mt-2">
                                ⚠️ You've used all your free generations. Please add an API key below.
                            </p>
                        )}
                    </div>
                )}

                {userApiKey ? (
                    /* USER HAS KEY - Show provider and remove option */
                    <>
                        {/* Current Provider Display */}
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <p className="text-sm font-semibold text-green-300">API Key Active</p>
                            </div>
                            <p className="text-xs text-gray-400">
                                Provider: <span className="text-white font-medium">
                                    {apiKeyProvider === 'openrouter' ? 'OpenRouter' : apiKeyProvider === 'openai' ? 'OpenAI' : 'Anthropic'}
                                </span>
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                Key: <span className="text-white font-mono">{'•'.repeat(20)}...{userApiKey.slice(-4)}</span>
                            </p>
                        </div>

                        {/* Info Box */}
                        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                            <p className="text-sm text-blue-300">
                                <strong>Want to switch providers?</strong>
                                <br />
                                Remove your current key first, then you can add a new key with a different provider.
                            </p>
                        </div>

                        {/* Remove Button */}
                        <button
                            onClick={handleClearKey}
                            className="w-full px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors"
                        >
                            Remove API Key
                        </button>
                    </>
                ) : (
                    /* NO KEY - Show provider selection and input */
                    <>
                        {/* Provider Selection */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                                Choose Your API Provider
                            </label>
                            <div className="space-y-2">
                                {(['openrouter', 'openai', 'anthropic'] as const).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setProvider(p)}
                                        className={`w-full px-4 py-3 rounded-lg text-left transition-all border-2 ${provider === p
                                            ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {/* Radio dot indicator */}
                                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${provider === p
                                                ? 'border-blue-500 bg-blue-500'
                                                : 'border-gray-600'
                                                }`}>
                                                {provider === p && (
                                                    <div className="w-2 h-2 rounded-full bg-white" />
                                                )}
                                            </div>

                                            {/* Provider info */}
                                            <div className="flex-1">
                                                <div className={`font-semibold ${provider === p ? 'text-blue-300' : 'text-gray-300'}`}>
                                                    {p === 'openrouter' ? 'OpenRouter' : p === 'openai' ? 'OpenAI' : 'Anthropic'}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">
                                                    {p === 'openrouter' && 'All models (Recommended)'}
                                                    {p === 'openai' && 'GPT-4o, GPT-4 Turbo only'}
                                                    {p === 'anthropic' && 'Claude Sonnet, Claude Haiku only'}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                                💡 <strong>Recommended:</strong> OpenRouter works with all models (OpenAI, Anthropic, Google, xAI) using one key.
                            </p>
                        </div>

                        {/* API Key Input */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={`Enter your ${provider} API key`}
                                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-2">
                                {provider === 'openrouter' && 'Get your key: https://openrouter.ai/keys'}
                                {provider === 'openai' && 'Get your key: https://platform.openai.com/api-keys'}
                                {provider === 'anthropic' && 'Get your key: https://console.anthropic.com/'}
                            </p>
                        </div>

                        {/* Info Box */}
                        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                            <p className="text-sm text-blue-300">
                                <strong>💡 Why bring your own key?</strong>
                                <br />
                                • Access premium models (Claude, GPT-4, etc.)
                                <br />
                                • Unlimited carousel generations
                                <br />
                                • Pay only for what you use
                            </p>
                        </div>

                        {/* Security Warning */}
                        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                            <p className="text-sm text-yellow-300">
                                <strong>🔒 Security Notice</strong>
                                <br />
                                • Your API key is stored locally in your browser only
                                <br />
                                • We never send your key to our servers
                                <br />
                                • Keep your device secure and only install trusted browser extensions
                                <br />
                                • Clear your key if using a shared/public device
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !apiKey.trim()}
                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30"
                            >
                                {isSaving ? 'Saving...' : 'Save API Key'}
                            </button>

                            {!isFreeTierExhausted && (
                                <button
                                    onClick={onClose}
                                    className="w-full px-6 py-3 bg-transparent text-gray-400 font-medium hover:text-white transition-colors"
                                >
                                    Continue with Free Tier ({3 - freeUsageCount} left)
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
