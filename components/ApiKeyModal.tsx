import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { FREE_TIER_LIMIT } from '../config/constants';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose }) => {
    const { freeUsageCount, freeUsageLoading, fetchFreeUsageCount, userApiKey, setUserApiKey, clearUserApiKey, apiKeyProvider } = useAuthStore();

    const BYOK_DISABLED = true; // Temporary security measure

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

    const progressPercent = Math.min((freeUsageCount / FREE_TIER_LIMIT) * 100, 100);
    const isFreeTierExhausted = freeUsageCount >= FREE_TIER_LIMIT;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-5 m-4">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                    aria-label="Close modal"
                    title="Close modal"
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-white mb-1">
                        {BYOK_DISABLED ? 'System Maintenance' : userApiKey ? 'Manage API Key' : 'Add Your API Key'}
                    </h2>
                    <p className="text-gray-400 text-xs">
                        {BYOK_DISABLED
                            ? 'BYOK feature is temporarily disabled for security updates.'
                            : isFreeTierExhausted
                                ? 'Free credits exhausted. Add your API key to continue generating carousels.'
                                : 'Use your own API key for premium models and unlimited generations.'}
                    </p>
                </div>

                {/* Progress Bar - Free Trial Usage */}
                {(BYOK_DISABLED || !userApiKey) && (
                    <div className="mb-4">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-gray-300">Free Trial Usage</span>
                            <span className="text-xs font-bold text-blue-400">{freeUsageCount}/{FREE_TIER_LIMIT} Used</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${isFreeTierExhausted
                                    ? 'bg-gradient-to-r from-red-500 to-red-600'
                                    : 'bg-gradient-to-r from-blue-500 to-cyan-500'
                                    }`}
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        {isFreeTierExhausted && (
                            <p className="text-red-400 text-[10px] mt-1.5">
                                ⚠️ You've used all your free generations. Please add an API key below.
                            </p>
                        )}
                    </div>
                )}

                {BYOK_DISABLED ? (
                    <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-semibold text-yellow-200 mb-1">
                                    BYOK Temporarily Disabled
                                </h3>
                                <p className="text-xs text-yellow-200/80 leading-relaxed">
                                    For security reasons, the "Bring Your Own Key" feature is currently unavailable.
                                    All users are being routed through the Free Tier system.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : userApiKey ? (
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
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-300 mb-2">
                                Choose Your API Provider
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['openrouter', 'openai', 'anthropic'] as const).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setProvider(p)}
                                        className={`flex flex-col items-center justify-center px-2 py-2 rounded-lg text-center transition-all border-2 h-full ${provider === p
                                            ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/20'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                            }`}
                                    >
                                        <div className={`w-3 h-3 rounded-full border-2 flex items-center justify-center mb-1.5 ${provider === p
                                            ? 'border-blue-500 bg-blue-500'
                                            : 'border-gray-600'
                                            }`}>
                                            {provider === p && (
                                                <div className="w-1 h-1 rounded-full bg-white" />
                                            )}
                                        </div>

                                        <div className={`font-semibold text-xs ${provider === p ? 'text-blue-300' : 'text-gray-300'}`}>
                                            {p === 'openrouter' ? 'OpenRouter' : p === 'openai' ? 'OpenAI' : 'Anthropic'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 mt-0.5 leading-tight scale-90 origin-center">
                                            {p === 'openrouter' && 'All models'}
                                            {p === 'openai' && 'GPT-4o only'}
                                            {p === 'anthropic' && 'Claude only'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1.5">
                                💡 <strong>Recommended:</strong> OpenRouter works with all models (OpenAI, Anthropic, Google, xAI) using one key.
                            </p>
                        </div>

                        {/* API Key Input */}
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-300 mb-1.5">
                                API Key
                            </label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={`Enter your ${provider} API key`}
                                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-[10px] text-gray-500 mt-1.5">
                                {provider === 'openrouter' && 'Get your key: https://openrouter.ai/keys'}
                                {provider === 'openai' && 'Get your key: https://platform.openai.com/api-keys'}
                                {provider === 'anthropic' && 'Get your key: https://console.anthropic.com/'}
                            </p>
                        </div>

                        {/* Info Boxes (Side by Side) */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-2.5 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                                <p className="text-[10px] text-blue-300 leading-relaxed">
                                    <strong>💡 Why bring your own key?</strong>
                                    <br />
                                    • Access premium models
                                    <br />
                                    • Unlimited generations
                                    <br />
                                    • Pay only for use
                                </p>
                            </div>

                            <div className="p-2.5 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                                <p className="text-[10px] text-yellow-300 leading-relaxed">
                                    <strong>🔒 Security Notice</strong>
                                    <br />
                                    • Stored locally in browser
                                    <br />
                                    • Never sent to our servers
                                    <br />
                                    • Safe & Secure
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={handleSave}
                                disabled={isSaving || !apiKey.trim()}
                                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 text-sm"
                            >
                                {isSaving ? 'Saving...' : 'Save API Key'}
                            </button>

                            {!isFreeTierExhausted && (
                                <button
                                    onClick={onClose}
                                    className="w-full px-4 py-2 bg-transparent text-gray-400 font-medium hover:text-white transition-colors text-xs"
                                >
                                    Continue with Free Tier ({FREE_TIER_LIMIT - freeUsageCount} left)
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
