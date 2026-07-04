/**
 * Chat Panel - the conversational control surface of the editor.
 *
 * First message creates the carousel (full agent pipeline, streamed as an
 * activity timeline). Every message after refines it via ChatRefineAgent,
 * optionally scoped to the selected slide.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCarouselStore } from '../../store/useCarouselStore';
import { OrchestratorAgent } from '../../core/agents/OrchestratorAgent';
import { MemoryAgent } from '../../core/agents/MemoryAgent';
import { generateDoodleWithRetry } from '../../utils/doodleGenerator';
import { getUserMemory, rememberUserPreference } from '../../services/memoryService';
import { FreeLimitError } from '../../services/aiService';
import { detectInputMode } from '../../utils/inputDetector';
import { fetchYouTubeContent, fetchUrlContent, extractDomain } from '../../utils/contentProcessor';
import { extractTextFromFile } from '../../utils/fileProcessor';
import { capSourceContent, assertUploadSizeOk, truncationNote } from '../../utils/contentLimits';
import { ArrowUp, SlidersHorizontal, Sparkles, X, Plus, Paperclip } from 'lucide-react';

// Must match the recentMessages window OrchestratorAgent sends as raw history —
// anything older than this is folded into chatSummary instead of just dropped.
const HISTORY_WINDOW = 10;

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
    const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; truncated: boolean; originalLength: number } | null>(null);
    const [isAttaching, setIsAttaching] = useState(false);
    const [attachError, setAttachError] = useState<string | null>(null);
    const runMessageId = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        if ((!text && !attachedFile) || busy) return;
        setDraft('');
        const pendingAttachment = attachedFile;
        setAttachedFile(null);
        addChatMessage({
            id: nextId(), role: 'user',
            text: text || `📎 Attached: ${pendingAttachment?.name}`,
        });

        if (!hasSlides) {
            const runId = nextId();
            runMessageId.current = runId;
            addChatMessage({ id: runId, role: 'assistant', text: '', running: true, events: [] });

            const store = useCarouselStore.getState();
            let topicForRun = text;

            try {
                if (pendingAttachment) {
                    const preEvents = [{ label: `Attached: ${pendingAttachment.name}`, done: true }];
                    if (pendingAttachment.truncated) {
                        preEvents.push({ label: truncationNote(pendingAttachment.originalLength), done: true });
                    }
                    updateChatMessage(runId, { events: preEvents });
                    store.setInputMode('pdf');
                    store.setSourceContent(pendingAttachment.content);
                    topicForRun = text || pendingAttachment.name.replace(/\.[^.]+$/, '');
                } else {
                    const detected = detectInputMode(text);

                    if (detected.mode === 'video' && detected.videoId) {
                        updateChatMessage(runId, { events: [{ label: 'Detected YouTube link — fetching transcript...', done: false }] });
                        const transcript = await fetchYouTubeContent(detected.videoId);
                        const capped = capSourceContent(transcript);
                        store.setInputMode('video');
                        store.setSourceContent(capped.content);
                        topicForRun = detected.instruction || 'Carousel from YouTube video';
                        const preEvents = [{ label: 'Transcript fetched', done: true }];
                        if (capped.truncated) preEvents.push({ label: truncationNote(capped.originalLength), done: true });
                        updateChatMessage(runId, { events: preEvents });
                    } else if (detected.mode === 'url' && detected.url) {
                        const domain = extractDomain(detected.url);
                        updateChatMessage(runId, { events: [{ label: `Reading article from ${domain}...`, done: false }] });
                        const article = await fetchUrlContent(detected.url);
                        store.setInputMode('url');
                        store.setSourceContent(article.content);
                        topicForRun = detected.instruction || `Carousel from ${domain}`;
                        const preEvents = [{ label: 'Article fetched', done: true }];
                        if (article.truncated) preEvents.push({ label: truncationNote(article.originalLength), done: true });
                        updateChatMessage(runId, { events: preEvents });
                    } else if (detected.mode === 'text') {
                        const capped = capSourceContent(detected.instruction);
                        store.setInputMode('text');
                        store.setSourceContent(capped.content);
                        topicForRun = detected.instruction;
                        if (capped.truncated) {
                            updateChatMessage(runId, { events: [{ label: truncationNote(capped.originalLength), done: true }] });
                        }
                    } else {
                        store.setInputMode('topic');
                        store.setSourceContent('');
                    }
                }

                await onFirstPrompt(topicForRun);
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

        // Conversational turn: the orchestrator classifies intent and routes
        setIsRefining(true);
        const runId = nextId();
        const state = useCarouselStore.getState();
        const scope = state.selectedSlideIndex;
        addChatMessage({
            id: runId, role: 'assistant', text: '', running: true,
            events: [{ label: 'Thinking...', done: false }]
        });
        try {
            const result = await OrchestratorAgent.handle({
                message: text,
                slides: state.slides,
                templateId: state.selectedTemplate,
                selectedSlideIndex: scope,
                recentMessages: state.chatMessages.filter(m => !m.running),
                conversationSummary: state.chatSummary,
                userMemory: getUserMemory(),
            });

            const events: { label: string; done: boolean }[] = [];

            if (result.intent === 'copy' && result.slides) {
                setSlides(result.slides);
                events.push({ label: `Edited slide${result.changedIndices.length > 1 ? 's' : ''} ${result.changedIndices.map(i => i + 1).join(', ')}`, done: true });
            } else if (result.intent === 'design' && result.designActions.length > 0) {
                const s = useCarouselStore.getState();
                for (const act of result.designActions) {
                    switch (act.action) {
                        case 'set_template': s.setTemplate(act.value as any); break;
                        case 'set_format': s.setFormat(act.value as any); break;
                        case 'set_preset': s.setPresetId(act.value); s.setBrandMode('preset'); break;
                        case 'set_pattern': s.setPattern(parseInt(act.value, 10) || 1); break;
                        case 'set_signature_position': s.setSignaturePosition(act.value as any); break;
                    }
                    events.push({ label: `${act.action.replace(/_/g, ' ')} → ${act.value}`, done: true });
                }
            } else if (result.intent === 'image' && result.imageBrief !== null && result.imageSlideIndex !== null) {
                const idx = result.imageSlideIndex;
                updateChatMessage(runId, {
                    running: true,
                    events: [{ label: `Sketching a new image for slide ${idx + 1}...`, done: false }]
                });
                const { url, prompt } = await generateDoodleWithRetry(result.imageBrief);
                useCarouselStore.getState().updateSlide(idx, { doodleUrl: url, doodlePrompt: prompt });
                events.push({ label: `New sketch on slide ${idx + 1}`, done: true });
            }

            updateChatMessage(runId, { running: false, events, text: result.reply });

            // Long-term memory: extracted in the same call, persisted quietly
            if (result.memoryNote) {
                const summary = useCarouselStore.getState().chatSummary;
                useCarouselStore.getState().setChatSummary(
                    summary ? `${summary}\n- ${result.memoryNote}` : `- ${result.memoryNote}`
                );
                rememberUserPreference(result.memoryNote);
            }

            // Fold older messages into the rolling summary once the raw-history
            // window the orchestrator sees would otherwise start losing them.
            // Fire-and-forget — never blocks the composer, never throws.
            const allMessages = useCarouselStore.getState().chatMessages;
            const summarizedUpTo = useCarouselStore.getState().chatSummarizedUpTo;
            const unsummarizedCount = allMessages.length - summarizedUpTo;
            if (unsummarizedCount > HISTORY_WINDOW) {
                const toFold = allMessages.slice(summarizedUpTo, allMessages.length - HISTORY_WINDOW);
                if (toFold.length > 0) {
                    const foldTarget = allMessages.length - HISTORY_WINDOW;
                    MemoryAgent.compactHistory(useCarouselStore.getState().chatSummary, toFold)
                        .then(updatedSummary => {
                            useCarouselStore.getState().setChatSummary(updatedSummary);
                            useCarouselStore.getState().setChatSummarizedUpTo(foldTarget);
                        })
                        .catch(err => console.warn('[ChatPanel] Compaction fire-and-forget failed unexpectedly:', err));
                }
            }
        } catch (e: any) {
            if (e instanceof FreeLimitError) {
                updateChatMessage(runId, { running: false, error: true, events: [], text: 'Free generations used up. Add your own API key to continue.' });
                onOpenApiKeyModal();
            } else {
                updateChatMessage(runId, { running: false, error: true, events: [], text: e?.message || 'That didn\'t work — try rephrasing.' });
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

    const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow re-selecting the same file later
        if (!file) return;

        setAttachError(null);
        try {
            assertUploadSizeOk(file);
        } catch (err: any) {
            setAttachError(err.message);
            return;
        }

        setIsAttaching(true);
        try {
            const extracted = await extractTextFromFile(file);
            const capped = capSourceContent(extracted);
            setAttachedFile({ name: file.name, ...capped });
        } catch (err: any) {
            setAttachError(err?.message || 'Could not read that file.');
        } finally {
            setIsAttaching(false);
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

                {!hasSlides && attachedFile && (
                    <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-1 text-[11px] text-blue-200 w-fit max-w-full">
                        <Paperclip size={11} className="flex-shrink-0" />
                        <span className="truncate">{attachedFile.name}</span>
                        {attachedFile.truncated && (
                            <span className="text-blue-400/70 flex-shrink-0" title={truncationNote(attachedFile.originalLength)}>
                                (truncated)
                            </span>
                        )}
                        <button
                            onClick={() => setAttachedFile(null)}
                            className="text-blue-300 hover:text-white flex-shrink-0"
                            aria-label="Remove attachment"
                        >
                            <X size={11} />
                        </button>
                    </div>
                )}
                {!hasSlides && attachError && (
                    <div className="text-[11px] text-red-400 px-1">{attachError}</div>
                )}

                <div className="flex items-end gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2 focus-within:border-blue-500 transition-colors">
                    {!hasSlides && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.docx,.doc,.md,.txt"
                                onChange={onFileSelected}
                                className="hidden"
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={busy || isAttaching}
                                title="Attach a PDF, Word doc, or text file"
                                aria-label="Attach a file"
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 flex-shrink-0"
                            >
                                {isAttaching
                                    ? <span className="w-3.5 h-3.5 border border-neutral-400/50 border-t-neutral-200 rounded-full animate-spin inline-block" />
                                    : <Plus size={14} />}
                            </button>
                        </>
                    )}
                    <textarea
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        rows={draft.includes('\n') || draft.length > 80 ? 3 : 1}
                        placeholder={hasSlides ? 'Refine anything...' : attachedFile ? 'Optional: add instructions...' : 'A carousel about... or paste a link'}
                        className="flex-1 bg-transparent text-[13px] text-white placeholder-neutral-500 resize-none focus:outline-none leading-relaxed"
                        disabled={busy}
                    />
                    <button
                        onClick={send}
                        disabled={busy || (!draft.trim() && !attachedFile)}
                        className={`p-1.5 rounded-lg transition-all ${busy || (!draft.trim() && !attachedFile)
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
