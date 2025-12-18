import React, { useState } from 'react';
import {
    Sparkles,
    AlertCircle,
    Plus,
    Loader,
    Lightbulb,
    FileText,
    Link,
    Video,
    FileUp,
    Upload,
    Shuffle,
    X,
    ChevronRight,
    ChevronLeft,
    ChevronDown
} from 'lucide-react';
import { Carousel } from '../services/carouselService';
import { useCarouselStore } from '../store/useCarouselStore';
import { useAuthStore } from '../store/useAuthStore';
import { extractTextFromFile, isSupportedFile, formatFileSize, getFileTypeDescription, SUPPORTED_EXTENSIONS } from '../utils/fileProcessor';
import {
    getVideoID,
    fetchUrlContent,
    fetchYouTubeContent,
    isYouTubeUrl,
    validateUrl
} from '../utils/contentProcessor';

interface FloatingSidebarProps {
    isOpen: boolean;
    onToggle: () => void;
    hasSlides?: boolean;
    editMode: boolean;
    editingCarousel: Carousel | null;
    localTopic: string;
    setLocalTopic: (topic: string) => void;
    selectedModel: string;
    setModel: (model: string) => void;
    isGenerating: boolean;
    error: string;
    onGenerate: () => void;
    onRandomTopic: () => void;
    onNewCarousel: () => void;
}

const MODEL_OPTIONS = [
    // OpenRouter Models
    {
        id: 'deepseek-r1t',
        name: 'DeepSeek R1T Chimera',
        description: '⚡ Fast reasoning (Free)',
        freeTier: true,
        freeTierOnly: false, // Available for both free tier and BYOK
        provider: 'openrouter',
    },
    {
        id: 'claude-haiku-openrouter',
        name: 'Claude Haiku 3.5',
        description: '🧠 Smart & efficient (Free)',
        freeTier: false,
        freeTierOnly: false, // Moved to paid tier
        provider: 'openrouter',
    },
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: '🚀 Google latest (Paid via OpenRouter)',
        freeTier: false,
        freeTierOnly: false,
        provider: 'openrouter',
    },
    {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash Exp',
        description: '🆓 Google experimental (Paid via OpenRouter)',
        freeTier: false,
        freeTierOnly: false,
        provider: 'openrouter',
    },
    {
        id: 'grok-4.1-fast',
        name: 'Grok 4.1 Fast',
        description: '⚡ xAI model (Paid via OpenRouter)',
        freeTier: false,
        freeTierOnly: false,
        provider: 'openrouter',
    },
    // OpenAI Models
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        description: '🚀 OpenAI latest model',
        freeTier: false,
        freeTierOnly: false,
        provider: 'openai',
    },
    {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: '⚡ Fast & powerful',
        freeTier: false,
        freeTierOnly: false,
        provider: 'openai',
    },
    // Anthropic Models (Direct API)
    {
        id: 'claude-sonnet',
        name: 'Claude Sonnet 3.5',
        description: '🧠 Best reasoning',
        freeTier: false,
        freeTierOnly: false,
        provider: 'anthropic',
    },
    {
        id: 'claude-haiku',
        name: 'Claude Haiku 3.5',
        description: '⚡ Fast & efficient',
        freeTier: false,
        freeTierOnly: false,
        provider: 'anthropic',
    },
];

type InputMode = 'topic' | 'text' | 'url' | 'video' | 'pdf';

const INPUT_MODES = [
    { id: 'topic' as InputMode, label: 'Topic', icon: Lightbulb },
    { id: 'text' as InputMode, label: 'Text', icon: FileText },
    { id: 'url' as InputMode, label: 'URL', icon: Link },
    { id: 'video' as InputMode, label: 'Video', icon: Video },
    { id: 'pdf' as InputMode, label: 'PDF', icon: FileUp },
];

const LANGUAGE_OPTIONS = [
    'English',
    'Spanish',
    'French',
    'German',
    'Italian',
    'Portuguese',
    'Chinese',
    'Japanese',
    'Korean',
    'Arabic',
    'Hindi',
];

const TONE_OPTIONS = [
    { id: 'contrarian', label: '🌶️ Contrarian', value: "Angle: Controversial/Debate. Challenge the status quo." },
    { id: 'analytical', label: '🧠 Analytical', value: "Angle: Data-driven. Use facts, numbers, and logical reasoning." },
    { id: 'storyteller', label: '📖 Storyteller', value: "Angle: Personal Narrative. Use 'I' statements and emotional hooks." },
    { id: 'actionable', label: '⚡ Actionable', value: "Angle: Tutorial. No fluff, step-by-step instructions only." }
];

export const FloatingSidebar: React.FC<FloatingSidebarProps> = ({
    isOpen,
    onToggle,
    hasSlides = false,
    editMode,
    editingCarousel,
    localTopic,
    setLocalTopic,
    selectedModel,
    setModel,
    isGenerating,
    error,
    onGenerate,
    onRandomTopic,
    onNewCarousel,
}) => {
    // Get user API key status and provider
    const { userApiKey, apiKeyProvider } = useAuthStore();
    const hasApiKey = !!userApiKey;

    // Filter models based on API provider
    const availableModels = hasApiKey && apiKeyProvider
        ? apiKeyProvider === 'openrouter'
            ? MODEL_OPTIONS.filter(m => m.provider === 'openrouter' && m.freeTier && !m.freeTierOnly) // OpenRouter BYOK: only non-exclusive free models (just DeepSeek)
            : MODEL_OPTIONS.filter(m => m.provider === apiKeyProvider) // OpenAI/Anthropic: all their models
        : MODEL_OPTIONS.filter(m => m.freeTier && m.provider === 'openrouter'); // Free tier: all free OpenRouter models (DeepSeek + Claude Haiku)

    // Local state for inputs
    const [activeInputMode, setActiveInputMode] = useState<InputMode>('topic');
    const [localSlideCount, setLocalSlideCount] = useState(8);
    const [localTextContent, setLocalTextContent] = useState('');
    const [localUrl, setLocalUrl] = useState('');
    const [localCustomInstructions, setLocalCustomInstructions] = useState('');
    const [localOutputLanguage, setLocalOutputLanguage] = useState('English');
    const [selectedToneId, setSelectedToneId] = useState<string | null>(null);
    const [isProcessingContent, setIsProcessingContent] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [fileUploadError, setFileUploadError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Global store actions
    const {
        setInputMode,
        setSlideCount,
        setSourceContent,
        setCustomInstructions,
        setOutputLanguage,
        isMobileMenuOpen,
        toggleMobileMenu,
    } = useCarouselStore();

    // Handle generate click - sync local state to global store and process content
    const handleGenerate = async () => {
        setContentError(null);

        // Final validation for slide count
        if (localSlideCount < 3 || localSlideCount > 12) {
            setContentError('Slide count must be between 3 and 12');
            return;
        }

        setIsProcessingContent(true);

        try {
            // Sync basic settings to store
            setInputMode(activeInputMode);
            setSlideCount(localSlideCount);

            // Combine tone with custom instructions if selected
            let finalInstructions = localCustomInstructions;
            if (selectedToneId) {
                const tone = TONE_OPTIONS.find(t => t.id === selectedToneId);
                if (tone) {
                    finalInstructions = `${tone.value} \n Additional User Notes: ${localCustomInstructions}`;
                }
            }
            setCustomInstructions(finalInstructions);

            setOutputLanguage(localOutputLanguage);

            let processedContent = '';

            // Process content based on input mode
            switch (activeInputMode) {
                case 'topic':
                    processedContent = localTopic;
                    break;

                case 'text':
                    processedContent = localTextContent;
                    break;

                case 'url':
                    // Validate and fetch URL content
                    try {
                        const validUrl = validateUrl(localUrl);
                        processedContent = await fetchUrlContent(validUrl);
                    } catch (err: any) {
                        throw new Error(`URL Error: ${err.message}`);
                    }
                    break;

                case 'video':
                    // Check if it's a YouTube URL and extract content
                    try {
                        const validUrl = validateUrl(localUrl);

                        if (isYouTubeUrl(validUrl)) {
                            const videoId = getVideoID(validUrl);
                            if (!videoId) {
                                throw new Error('Could not extract video ID from YouTube URL');
                            }
                            processedContent = await fetchYouTubeContent(videoId);
                        } else {
                            // For non-YouTube videos, just store the URL for now
                            processedContent = `Video URL: ${validUrl}\n\nNote: Currently only YouTube videos are supported. This URL will be processed in a future update.`;
                        }
                    } catch (err: any) {
                        throw new Error(`Video Error: ${err.message}`);
                    }
                    break;

                case 'pdf':
                    // PDF text was already extracted during file upload
                    // Use the sourceContent from store
                    const { sourceContent: pdfContent } = useCarouselStore.getState();
                    processedContent = pdfContent || '';
                    if (!processedContent) {
                        throw new Error('No content extracted from PDF. Please upload the file again.');
                    }
                    break;
            }

            // Set the processed content to store
            setSourceContent(processedContent);

            // Trigger generation
            onGenerate();
        } catch (error: any) {
            setContentError(error.message || 'Failed to process content');
            console.error('Content processing error:', error);
        } finally {
            setIsProcessingContent(false);
        }
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileUploadError(null);

        // Validate file type
        if (!isSupportedFile(file)) {
            setFileUploadError(`Unsupported file type. Please upload: ${SUPPORTED_EXTENSIONS.join(', ')}`);
            return;
        }

        try {
            console.log(`[FileUpload] Processing file: ${file.name}`);
            setUploadedFile(file);

            // Extract text from file
            const extractedText = await extractTextFromFile(file);

            console.log(`[FileUpload] Extracted ${extractedText.length} characters from ${file.name}`);

            // Store in source content immediately
            setSourceContent(extractedText);

        } catch (error: any) {
            console.error('[FileUpload] Error:', error);
            setFileUploadError(error.message || 'Failed to process file');
            setUploadedFile(null);
        }
    };

    // Handle clearing uploaded file
    const handleClearFile = () => {
        setUploadedFile(null);
        setFileUploadError(null);
        setSourceContent('');
    };

    // Check if generate button should be enabled
    const isGenerateEnabled = () => {
        if (editMode) return true;

        // Check if slide count is within valid range (3-12)
        const isSlideCountValid = localSlideCount >= 3 && localSlideCount <= 12;
        if (!isSlideCountValid) return false;

        switch (activeInputMode) {
            case 'topic':
                return localTopic.trim().length > 0;
            case 'text':
                return localTextContent.trim().length > 0;
            case 'url':
            case 'video':
                return localUrl.trim().length > 0;
            case 'pdf':
                return uploadedFile !== null; // Enable if file is uploaded
            default:
                return false;
        }
    };

    if (!isOpen) {
        return (
            <aside className="fixed left-6 top-24 bottom-24 w-16 bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col items-center py-6 gap-6 transition-all duration-300">

                {/* Expand Button */}
                <button
                    onClick={onToggle}
                    className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-colors group"
                    title="Expand Settings"
                    aria-label="Expand Settings"
                >
                    <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div className="w-8 h-[1px] bg-white/10" />

                {/* New Carousel Button */}
                <button
                    onClick={onNewCarousel}
                    className="p-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-white shadow-lg shadow-blue-900/20 transition-all hover:scale-105"
                    title="Create New Carousel"
                    aria-label="Create New Carousel"
                >
                    <Plus size={20} />
                </button>

                {/* Vertical Text Label */}
                <div className="mt-auto flex-1 flex items-end justify-center pb-4">
                    <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest [writing-mode:vertical-rl] rotate-180">
                        {editMode ? 'Editing' : 'Generator'}
                    </span>
                </div>
            </aside>
        );
    }

    return (
        <>
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-in fade-in duration-200"
                    onClick={toggleMobileMenu}
                />
            )}

            <aside className={`fixed top-20 bottom-24 md:top-24 md:bottom-24 w-80 bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col overflow-hidden transition-all duration-300 ease-out 
                ${isMobileMenuOpen ? 'left-4 translate-x-0' : 'left-4 -translate-x-[120%] md:translate-x-0 md:left-6'}
            `}>
                {/* Header with Collapse Button - Desktop Only */}
                <div className="absolute top-4 right-4 z-50 hidden md:block">
                    <button
                        onClick={onToggle}
                        className="p-1.5 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white transition-colors"
                        title="Collapse Sidebar"
                        aria-label="Collapse Sidebar"
                    >
                        <ChevronLeft size={16} />
                    </button>
                </div>

                {/* Mobile Header with Close */}
                <div className="flex md:hidden justify-between items-center p-4 border-b border-white/5">
                    <span className="text-sm font-bold text-white">Menu</span>
                    <button
                        onClick={toggleMobileMenu}
                        className="p-1 text-neutral-400 hover:text-white"
                        title="Close Menu"
                        aria-label="Close Menu"
                    >
                        <X size={20} />
                    </button>
                </div>
                {/* Edit Mode Alert */}
                {editMode && editingCarousel && (
                    <div className="p-6 pb-4 border-b border-white/5">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg">
                            <div className="flex items-start gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium text-blue-400 text-sm">Editing</h3>
                                    <p className="text-xs text-blue-200/80 mt-1">{editingCarousel.title}</p>
                                </div>
                            </div>
                            <button
                                onClick={onNewCarousel}
                                className="w-full mt-2 py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded text-xs font-medium text-blue-300 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus size={14} />
                                New Carousel
                            </button>
                        </div>
                    </div>
                )}

                {/* NEW CAROUSEL INFO ALERT */}
                {!editMode && hasSlides && (
                    <div className="p-6 pb-0">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                            <div className="flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-medium text-blue-300 text-xs">Ready for a new carousel?</h3>
                                    <p className="text-[10px] text-blue-200/60 mt-0.5 leading-relaxed">
                                        Your current work is auto-saved. Generating a new one will start fresh.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab Navigation - Only in Generate Mode */}
                {!editMode && (
                    <div className="px-6 pt-6 pb-4 border-b border-white/5">
                        <div className="flex gap-1 p-1 bg-black/40 rounded-lg">
                            {INPUT_MODES.map((mode) => {
                                const Icon = mode.icon;
                                const isActive = activeInputMode === mode.id;
                                return (
                                    <button
                                        key={mode.id}
                                        onClick={() => setActiveInputMode(mode.id)}
                                        className={`flex-1 flex flex-col items-center gap-1 py-2 px-2 rounded transition-all ${isActive
                                            ? 'bg-blue-600 text-white shadow-lg'
                                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        <Icon size={16} />
                                        <span className="text-[10px] font-medium">{mode.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                    {/* Dynamic Input Panel */}
                    {!editMode && (
                        <div className="flex flex-col gap-3">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                Input
                            </span>

                            {/* Topic Mode */}
                            {activeInputMode === 'topic' && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-medium text-neutral-500">Your Topic</label>

                                        </div>
                                        <button
                                            onClick={onRandomTopic}
                                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                                        >
                                            <Sparkles size={12} />
                                            Random
                                        </button>
                                    </div>
                                    <textarea
                                        className="w-full h-32 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                                        placeholder="What should this carousel be about?"
                                        value={localTopic}
                                        onChange={(e) => setLocalTopic(e.target.value)}
                                    />




                                </div>
                            )}

                            {/* Text Mode */}
                            {activeInputMode === 'text' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-medium text-neutral-500">Paste Article Content</label>
                                    <textarea
                                        className="w-full h-64 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm font-mono"
                                        placeholder="Paste your article, blog post, or any text content here..."
                                        value={localTextContent}
                                        onChange={(e) => setLocalTextContent(e.target.value)}
                                    />
                                    <p className="text-xs text-neutral-500">
                                        {localTextContent.length} characters
                                    </p>
                                </div>
                            )}

                            {/* URL Mode */}
                            {activeInputMode === 'url' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-medium text-neutral-500">Article URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://example.com/article"
                                        value={localUrl}
                                        onChange={(e) => setLocalUrl(e.target.value)}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors text-sm"
                                    />
                                    <p className="text-xs text-neutral-500">
                                        We'll extract content from the URL
                                    </p>
                                </div>
                            )}

                            {/* Video Mode */}
                            {activeInputMode === 'video' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-medium text-neutral-500">Video URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://youtube.com/watch?v=..."
                                        value={localUrl}
                                        onChange={(e) => setLocalUrl(e.target.value)}
                                        disabled={true}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500/50 transition-all text-sm opacity-50 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-neutral-500 text-center">
                                        Coming soon - YouTube transcript support
                                    </p>
                                </div>
                            )}

                            {/* PDF/Document Mode */}
                            {activeInputMode === 'pdf' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-medium text-neutral-500">
                                        Upload Document
                                    </label>

                                    {!uploadedFile ? (
                                        <>
                                            <label className="border-2 border-dashed border-white/20 rounded-xl p-8 bg-black/20 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer block">
                                                <input
                                                    type="file"
                                                    accept=".pdf,.docx,.doc,.md,.txt"
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                />
                                                <div className="flex flex-col items-center gap-3 text-center">
                                                    <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                        <FileUp className="w-6 h-6 text-blue-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-white mb-1">
                                                            Drop file here or click to browse
                                                        </p>
                                                        <p className="text-xs text-neutral-500">
                                                            Supports: PDF, DOCX, DOC, MD, TXT
                                                        </p>
                                                    </div>
                                                </div>
                                            </label>

                                            {fileUploadError && (
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                                    <p className="text-xs text-red-400">{fileUploadError}</p>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                        <FileText className="w-5 h-5 text-blue-400" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-white truncate">
                                                            {uploadedFile.name}
                                                        </p>
                                                        <p className="text-xs text-neutral-400 mt-0.5">
                                                            {getFileTypeDescription(uploadedFile)} • {formatFileSize(uploadedFile.size)}
                                                        </p>
                                                        <p className="text-xs text-green-400 mt-1">
                                                            ✓ Text extracted successfully
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleClearFile}
                                                    className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
                                                    title="Remove file"
                                                    aria-label="Remove file"
                                                >
                                                    <X className="w-4 h-4 text-neutral-400 hover:text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Edit Mode - Topic Display */}
                    {editMode && (
                        <div className="flex flex-col gap-3">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                                Context
                            </span>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-medium text-neutral-500">Topic</label>
                                <div className="p-3 bg-black/40 border border-white/10 rounded-xl text-white text-sm">
                                    {localTopic || 'No topic'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Global Style/Tone Selector (Always Visible) */}
                    <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
                        <label className="text-xs font-medium text-neutral-500">Choose a Style</label>
                        <div className="flex flex-wrap gap-2">
                            {TONE_OPTIONS.map((tone) => (
                                <button
                                    key={tone.id}
                                    onClick={() => setSelectedToneId(selectedToneId === tone.id ? null : tone.id)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${selectedToneId === tone.id
                                        ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                        : 'bg-neutral-800/50 border-white/5 text-neutral-400 hover:bg-neutral-800 hover:text-white hover:border-white/10'
                                        }`}
                                >
                                    {tone.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Collapsible Advanced Settings */}
                    <div className="pt-4 border-t border-white/5">
                        <button
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className="flex items-center justify-between w-full group"
                        >
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest group-hover:text-white transition-colors">
                                Advanced Settings
                            </span>
                            <ChevronDown
                                size={16}
                                className={`text-neutral-400 group-hover:text-white transition-transform duration-200 ${isSettingsOpen ? 'rotate-180' : ''}`}
                            />
                        </button>

                        {isSettingsOpen && (
                            <div className="mt-4 space-y-6 animate-in fade-in slide-in-from-top-2">
                                {/* Compact Model & Slide Count Row */}
                                <div className="flex gap-2">
                                    {/* Model Selector (Flex Grow) */}
                                    <div className="flex-1 space-y-1">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">AI Model {availableModels.length > 1 && `(${availableModels.length})`}</label>
                                        <div className="relative">
                                            <select
                                                value={selectedModel}
                                                onChange={(e) => setModel(e.target.value)}
                                                className="w-full pl-8 pr-4 py-2 bg-neutral-800/50 border border-white/10 rounded-lg text-xs text-white appearance-none focus:border-blue-500 focus:outline-none cursor-pointer hover:bg-neutral-800 transition-colors"
                                            >
                                                {availableModels.map(m => (
                                                    <option key={m.id} value={m.id} className="bg-neutral-900">{m.name} {m.freeTier ? '(Free)' : ''}</option>
                                                ))}
                                            </select>
                                            {/* Icon Overlay */}
                                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <Sparkles size={12} className="text-purple-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Slide Count (Fixed Width) */}
                                    <div className="w-20 space-y-1">
                                        <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Slides</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                min="3"
                                                max="12"
                                                value={localSlideCount}
                                                onChange={(e) => setLocalSlideCount(parseInt(e.target.value) || 0)}
                                                className={`w-full pl-2 pr-1 py-2 bg-neutral-800/50 border rounded-lg text-xs text-center text-white focus:border-blue-500 focus:outline-none hover:bg-neutral-800 transition-all ${localSlideCount < 3 || localSlideCount > 12
                                                    ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                    : 'border-white/10'
                                                    }`}
                                            />
                                            {(localSlideCount < 3 || localSlideCount > 12) && (
                                                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-32 bg-red-500 text-white text-[10px] py-1 px-2 rounded shadow-lg z-50 animate-in fade-in slide-in-from-top-1">
                                                    3-12 slides only
                                                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-transparent border-b-red-500" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Custom Instructions */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500">
                                        Custom Instructions (Optional)
                                    </label>
                                    <textarea
                                        className="w-full h-20 px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-blue-500 transition-colors resize-none text-sm"
                                        placeholder="Add any specific instructions for the AI..."
                                        value={localCustomInstructions}
                                        onChange={(e) => setLocalCustomInstructions(e.target.value)}
                                    />
                                </div>

                                {/* Output Language */}
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-neutral-500">Output Language</label>
                                    <select
                                        value={localOutputLanguage}
                                        onChange={(e) => setLocalOutputLanguage(e.target.value)}
                                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors text-sm appearance-none cursor-pointer"
                                    >
                                        {LANGUAGE_OPTIONS.map((lang) => (
                                            <option key={lang} value={lang} className="bg-neutral-900">
                                                {lang}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Button - Fixed at Bottom */}
                <div className="p-6 pt-4 border-t border-white/5">
                    {/* Content Processing Error */}
                    {contentError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-xs text-red-200">
                            <AlertCircle size={14} />
                            {contentError}
                        </div>
                    )}

                    {/* Generation Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-2 text-xs text-red-200">
                            <AlertCircle size={14} />
                            {error}
                        </div>
                    )}

                    {!editMode && (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || isProcessingContent || !isGenerateEnabled()}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${isGenerating || isProcessingContent || !isGenerateEnabled()
                                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                                }`}
                        >
                            {isProcessingContent ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Processing Content...
                                </>
                            ) : isGenerating ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Generate Carousel
                                </>
                            )}
                        </button>
                    )}

                    {editMode && (
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${isGenerating
                                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/30'
                                }`}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Regenerating...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Regenerate
                                </>
                            )}
                        </button>
                    )}
                </div>
            </aside >
        </>
    );
};
