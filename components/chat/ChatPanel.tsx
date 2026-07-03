/**
 * Chat Panel - the conversational control surface of the editor.
 *
 * First message creates the carousel (full agent pipeline, streamed as an
 * activity timeline). Every message after refines it via ChatRefineAgent,
 * optionally scoped to the selected slide.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCarouselStore } from '../../store/useCarouselStore';
import { ChatRefineAgent } from '../../core/agents/ChatRefineAgent';
import { FreeLimitError } from '../../services/aiService';
import { ArrowUp, SlidersHorizontal, Sparkles, X } from 'lucide-react';

const TONE_OPTIONS = [
    { id: 'contrarian', label: '🌶️ Contrarian', value: "Angle: Controversial/Debate. Challenge the status quo." },
    { id: 'analytical', label: '🧠 Analytical', value: "Angle: Data-driven. Use facts, numbers, and logical reasoning." },
    { id: 'storyteller', label: '📖 Storyteller', value: "Angle: Personal Narrative. Use 'I' statements and emotional hooks." },
    { id: 'actionable', label: '⚡ Actionable', value: "Angle: Tutorial. No fluff, step-by-step instructions only." }
];

const TEMPLATE_OPTIONS = [
    { id: 'template-1', label: 'The Truth' },
    { id: 'template-2', label: 'The Clarity' },
    { id: 'template-3', label: 'The Sketch' },
    { id: 'template-4', label: 'The Statement' },
];

const MODEL_OPTIONS = [
    { id: 'gpt-oss-120b', label: 'GPT-OSS 120B (Free)' },
    { id: 'claude-sonnet', label: 'Claude Sonnet' },
    { id: 'claude-haiku', label: 'Claude Haiku' },
];

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi'];

interface ChatPanelProps {
    onFirstPrompt: (text: string) => Promise<void>;
    onOpenApiKeyModal: () => void;
}

let msgSeq = 0;
const nextId = () => `msg-${Date.now()}-${msgSeq++}`;

export const ChatPanel: React.FC<ChatPanelProps> = ({ onFirstPrompt, onOpenApiKeyModal }) => {
    const {
        chatMessages, addChatMessage, updateChatMessage,
        slides, isGenerating, generationStatus, error,
        selectedSlideIndex, setSelectedSlideIndex,
        selectedTemplate, setTemplate,
        slideCount, setSlideCount,
        customInstructions, setCustomInstructions,
        outputLanguage, setOutputLanguage,
        selectedModel, setModel,
        setSlides, topic,
    } = useCarouselStore();

    const [draft, setDraft] = useState('');
    const [showTuning, setShowTuning] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const runMessageId = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);

    const hasSlides = slides.length > 0;
    const busy = isGenerating || isRefining;
    const activeTone = TONE_OPTIONS.find(t => t.value === customInstructions)?.id || null;

    // Stream agent statuses into the active run's event timeline
    useEffect(() => {
        if (!isGenerating || !runMessageId.current || !generationStatus) return;
        const id = runMessageId.current;
        const msg = useCarouselStore.getState().chatMessages.find(m => m.id === id);
        if (!msg) return;
        const events = [...(msg.events || [])];
        if (events.length && events[events.length - 1].label === generationStatus) return;
        const done = events.map(e => ({ ...e, done: true }));
        done.push({ label: generationStatus, done: false });
        updateChatMessage(id, { events: done });
    }, [generationStatus, isGenerating]);

    // Finalize the run message when generation ends
    useEffect(() => {
        if (isGenerating || !runMessageId.current) return;
        const id = runMessageId.current;
        runMessageId.current = null;
        const state = useCarouselStore.getState();
        const msg = state.chatMessages.find(m => m.id === id);
        if (!msg) return;
        const events = (msg.events || []).map(e => ({ ...e, done: true }));
        if (state.error) {
            updateChatMessage(id, { running: false, error: true, events, text: state.error });
        } else if (state.slides.length > 0) {
            updateChatMessage(id, {
                running: false, events,
                text: `Done — ${state.slides.length} slides. Tell me what to refine: a slide, the tone, or the whole angle.`
            });
        } else {
            updateChatMessage(id, { running: false, error: true, events, text: 'Something went wrong — try sending your prompt again.' });
        }
    }, [isGenerating]);

    // Keep the newest message in view
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [chatMessages, generationStatus]);

    const send = async () => {
        const text = draft.trim();
        if (!text || busy) return;
        setDraft('');
        addChatMessage({ id: nextId(), role: 'user', text });

        if (!hasSlides) {
            const runId = nextId();
            runMessageId.current = runId;
            addChatMessage({ id: runId, role: 'assistant', text: '', running: true, events: [] });
            try {
                await onFirstPrompt(text);
            } catch (e: any) {
                runMessageId.current = null;
                if (e instanceof FreeLimitError) {
                    updateChatMessage(runId, { running: false, error: true, text: 'Free generations used up. Add your own API key to continue.' });
                    onOpenApiKeyModal();
                } else {
                    updateChatMessage(runId, { running: false, error: true, text: e?.message || 'Generation failed.' });
                }
            }
            return;
        }

        // Refinement turn (read scope from the store at send time — never stale)
        setIsRefining(true);
        const runId = nextId();
        const scope = useCarouselStore.getState().selectedSlideIndex;
        addChatMessage({
            id: runId, role: 'assistant', text: '', running: true,
            events: [{ label: scope !== null ? `Editing slide ${scope + 1}...` : 'Editing the carousel...', done: false }]
        });
        try {
            const result = await ChatRefineAgent.refine(slides, text, selectedTemplate, scope);
            setSlides(result.slides);
            updateChatMessage(runId, {
                running: false,
                events: [{ label: scope !== null ? `Edited slide ${scope + 1}` : `Edited slide${result.changedIndices.length > 1 ? 's' : ''} ${result.changedIndices.map(i => i + 1).join(', ')}`, done: true }],
                text: result.summary
            });
        } catch (e: any) {
            if (e instanceof FreeLimitError) {
                updateChatMessage(runId, { running: false, error: true, events: [], text: 'Free generations used up. Add your own API key to continue.' });
                onOpenApiKeyModal();
            } else {
                updateChatMessage(runId, { running: false, error: true, events: [], text: e?.message || 'Edit failed — try rephrasing.' });
            }
        } finally {
            setIsRefining(false);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-neutral-925 bg-neutral-900/60 border-r border-white/10">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Sparkles size={15} className="text-blue-400" />
                <span className="text-sm font-medium text-white truncate">{hasSlides ? (topic || 'Carousel') : 'New carousel'}</span>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {chatMessages.length === 0 && (
                    <div className="text-center mt-16 px-4">
                        <p className="text-neutral-300 text-sm font-medium mb-1">What should we make?</p>
                        <p className="text-neutral-500 text-xs leading-relaxed">
                            Describe your topic — or paste an article, notes, anything.
                            The agents research, find an angle, and design the carousel.
                        </p>
                    </div>
                )}

                {chatMessages.map(msg => (
                    <div key={msg.id} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                        <div className={`max-w-[88%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${msg.role === 'user'
                            ? 'bg-blue-600/20 text-blue-100 border border-blue-500/20'
                            : msg.error
                                ? 'bg-red-500/10 text-red-200 border border-red-500/30'
                                : 'bg-white/5 text-neutral-200 border border-white/10'
                            }`}>
                            {msg.events && msg.events.length > 0 && (
                                <div className="flex flex-col gap-1 mb-1.5">
                                    {msg.events.map((ev, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                                            {ev.done
                                                ? <span className="text-green-400/80">✓</span>
                                                : <span className="w-2.5 h-2.5 border border-blue-400/50 border-t-blue-400 rounded-full animate-spin inline-block" />}
                                            <span className={ev.done ? '' : 'text-blue-300'}>{ev.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {msg.text && <div className="whitespace-pre-wrap">{msg.text}</div>}
                            {msg.running && !msg.text && (!msg.events || msg.events.length === 0) && (
                                <span className="text-neutral-400 text-xs">Thinking...</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Composer */}
            <div className="border-t border-white/10 p-3 space-y-2">
                {/* Creation settings ride with the composer until the carousel exists */}
                {!hasSlides && (
                    <div className="flex flex-wrap gap-1.5">
                        {TONE_OPTIONS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setCustomInstructions(activeTone === t.id ? '' : t.value)}
                                className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${activeTone === t.id
                                    ? 'border-blue-500 bg-blue-500/15 text-blue-200'
                                    : 'border-white/10 bg-black/30 text-neutral-400 hover:border-white/25'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-1.5">
                    <select
                        value={selectedTemplate}
                        onChange={e => setTemplate(e.target.value as any)}
                        className="bg-black/30 border border-white/10 rounded-md text-[11px] text-neutral-300 px-1.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                        title="Template"
                    >
                        {TEMPLATE_OPTIONS.map(t => <option key={t.id} value={t.id} className="bg-neutral-900">{t.label}</option>)}
                    </select>
                    {!hasSlides && (
                        <select
                            value={slideCount}
                            onChange={e => setSlideCount(parseInt(e.target.value, 10))}
                            className="bg-black/30 border border-white/10 rounded-md text-[11px] text-neutral-300 px-1.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                            title="Slide count"
                        >
                            {[5, 6, 7, 8, 9, 10].map(n => <option key={n} value={n} className="bg-neutral-900">{n} slides</option>)}
                        </select>
                    )}
                    <button
                        onClick={() => setShowTuning(!showTuning)}
                        className={`p-1.5 rounded-md border transition-colors ${showTuning ? 'border-blue-500 text-blue-300 bg-blue-500/10' : 'border-white/10 text-neutral-500 hover:text-neutral-300'}`}
                        title="Language and model"
                        aria-label="Language and model settings"
                    >
                        <SlidersHorizontal size={12} />
                    </button>
                </div>

                {showTuning && (
                    <div className="flex gap-1.5">
                        <select
                            value={outputLanguage}
                            onChange={e => setOutputLanguage(e.target.value)}
                            className="flex-1 bg-black/30 border border-white/10 rounded-md text-[11px] text-neutral-300 px-1.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            {LANGUAGES.map(l => <option key={l} value={l} className="bg-neutral-900">{l}</option>)}
                        </select>
                        <select
                            value={selectedModel}
                            onChange={e => setModel(e.target.value)}
                            className="flex-1 bg-black/30 border border-white/10 rounded-md text-[11px] text-neutral-300 px-1.5 py-1 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                            {MODEL_OPTIONS.map(m => <option key={m.id} value={m.id} className="bg-neutral-900">{m.label}</option>)}
                        </select>
                    </div>
                )}

                <div className="flex items-end gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 focus-within:border-blue-500 transition-colors">
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={draft.includes('\n') || draft.length > 80 ? 3 : 1}
                        placeholder={hasSlides ? 'Refine anything...' : 'A carousel about...'}
                        className="flex-1 bg-transparent text-[13px] text-white placeholder-neutral-500 resize-none focus:outline-none leading-relaxed"
                        disabled={busy}
                    />
                    <button
                        onClick={send}
                        disabled={busy || !draft.trim()}
                        className={`p-1.5 rounded-lg transition-all ${busy || !draft.trim()
                            ? 'bg-white/5 text-neutral-600'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                            }`}
                        aria-label="Send"
                    >
                        <ArrowUp size={14} />
                    </button>
                </div>

                {hasSlides && (
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500 px-1">
                        {selectedSlideIndex !== null ? (
                            <>
                                <span>Editing slide {selectedSlideIndex + 1}</span>
                                <button
                                    onClick={() => setSelectedSlideIndex(null)}
                                    className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300 ml-1"
                                >
                                    <X size={10} /> whole carousel
                                </button>
                            </>
                        ) : (
                            <span>Editing the whole carousel — select a slide to scope changes</span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
