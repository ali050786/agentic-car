/**
 * Chat Panel - the conversational control surface of the editor.
 *
 * First message creates the carousel (full agent pipeline, streamed as an
 * activity timeline). Every message after refines it via ChatRefineAgent,
 * optionally scoped to the selected slide.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useCarouselStore } from '../../store/useCarouselStore';
import { useAuthStore } from '../../store/useAuthStore';
import { MemoryAgent } from '../../core/agents/MemoryAgent';
import { CreativeDirectorAgent, isSpecificRequest, parseExplicitSlideCount } from '../../core/agents/CreativeDirectorAgent';
import { GatekeeperAgent } from '../../core/agents/GatekeeperAgent';
import { createJob, cancelJob } from '../../services/jobService';
import { detectInputMode } from '../../utils/inputDetector';
import { fetchYouTubeContent, fetchUrlContent, extractDomain } from '../../utils/contentProcessor';
import { extractTextFromFile } from '../../utils/fileProcessor';
import { capSourceContent, assertUploadSizeOk, truncationNote } from '../../utils/contentLimits';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowUp, ArrowRight, Sparkles, X, Paperclip, Layers, Check, ChevronRight, Square, RotateCcw, Zap, FileText, Link2, Youtube,
    Lightbulb, Scissors, BarChart3, Palette, Megaphone,
} from 'lucide-react';
import { DrawCheck, EASE, IconButton, Kbd, PHASE_COLOR, SPRING, Segmented, Spinner, phaseLabel, phaseOf } from '../studio/ui';
import type { CreativeBrief } from '../../types';
import { UNDO_RE, previousPoint, restorePoints } from '../../core/agents/undo';
import { commitRestore, restoreToReply } from '../../services/restoreService';


const HISTORY_WINDOW = 10;


const TEMPLATE_OPTIONS = [
    { id: 'template-1', label: 'The Truth' },
    { id: 'template-3', label: 'The Sketch' },
    { id: 'template-4', label: 'The Statement' },
];

const MODEL_OPTIONS = [
    { id: 'gpt-oss-120b', label: 'Free Models Router (Auto)' },
    { id: 'deepseek-v4-flash', label: 'DeepSeek v4 Flash' },
    { id: 'claude-sonnet', label: 'Claude Sonnet' },
    { id: 'claude-haiku', label: 'Claude Haiku' },
];

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi'];

interface ChatPanelProps {
    onFirstPrompt: (text: string, brief?: CreativeBrief, userMessage?: string, options?: { briefInWorker?: boolean }) => Promise<void>;
}


let msgSeq = 0;
const nextId = () => `msg-${Date.now()}-${msgSeq++}`;

export const ChatPanel: React.FC<ChatPanelProps> = ({ onFirstPrompt }) => {
    const {
        chatMessages, addChatMessage, updateChatMessage,
        slides, isGenerating, generationStatus, error, theme,
        selectedSlideIndex, selectedSlideIndices, setSelectedSlideIndices,
        selectedTemplate, setTemplate,
        slideCount, setSlideCount,
        customInstructions, setCustomInstructions,
        outputLanguage, setOutputLanguage,
        selectedModel, setModel,
        topic, activeCarouselId, activeJobId,
        setActiveJobId, setGenerating, generationProgress,
        restoredTo,
    } = useCarouselStore();

    // A prompt typed on the landing page is handed over via sessionStorage so
    // visitors land in the studio with their idea already in the composer.
    const [draft, setDraft] = useState(() => {
        try { return sessionStorage.getItem('ac:landing-prompt') || ''; } catch { return ''; }
    });
    useEffect(() => {
        try { sessionStorage.removeItem('ac:landing-prompt'); } catch { /* ignore */ }
    }, []);

    const [attachedFile, setAttachedFile] = useState<{ name: string; content: string; truncated: boolean; originalLength: number } | null>(null);
    const [isAttaching, setIsAttaching] = useState(false);
    const [attachError, setAttachError] = useState<string | null>(null);
    // Restore points: the reply being restored right now, and a short note (e.g. a point that's too old).
    const [restoringId, setRestoringId] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 4000);
        return () => clearTimeout(t);
    }, [notice]);
    const runMessageId = useRef<string | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const hasSlides = slides.length > 0;
    const busy = isGenerating;

    const handleCancelJob = async () => {
        if (!activeJobId) return;
        try {
            await cancelJob(activeJobId);
            setGenerating(false);
            setActiveJobId(null);
            
            const runningMsg = chatMessages.find(m => m.running);
            if (runningMsg) {
                updateChatMessage(runningMsg.id, {
                    running: false,
                    error: true,
                    text: 'Generation stopped.',
                });
            }
        } catch (err) {
            console.error('[ChatPanel] Failed to cancel generation job:', err);
        }
    };

    // Creative Director state — tracks a pending brief and any quick-reply
    // questions waiting for the user to answer before generation starts.
    const [pendingBrief, setPendingBrief] = useState<CreativeBrief | null>(null);
    const [pendingTopic, setPendingTopic] = useState<string>('');
    // Map from resumeToken → set of selected chip values
    const [chipSelections, setChipSelections] = useState<Record<string, string[]>>({});


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

    // Clear the local run ref once the tracked job resolves — hooks/useJobWatcher.ts
    // (mounted at the app root) is what actually finalizes the chat message, since
    // it's the one that knows the job's result; this just stops this effect's
    // status-tick streaming above from running past the end of the run.
    useEffect(() => {
        if (!isGenerating) runMessageId.current = null;
    }, [isGenerating]);

    // Ensure chat messages are initialized and runMessageId is set if a background job is running
    useEffect(() => {
        const store = useCarouselStore.getState();
        const currentActiveJobId = store.activeJobId;
        if (currentActiveJobId && isGenerating) {
            const runningMsg = store.chatMessages.find(m => m.role === 'assistant' && m.running);
            if (!runningMsg) {
                const userMsgId = `user-init-${currentActiveJobId}`;
                const assistMsgId = `assist-init-${currentActiveJobId}`;
                runMessageId.current = assistMsgId;
                
                // Set the default layout for the generating message
                store.setChatMessages([
                    { id: userMsgId, role: 'user', text: `Generate a carousel about: ${store.topic || 'Topic'}` },
                    { id: assistMsgId, role: 'assistant', text: '', running: true, events: [{ label: generationStatus || 'Running...', done: false }] }
                ]);
            } else {
                runMessageId.current = runningMsg.id;
            }
        }
    }, [activeJobId, isGenerating]);

    // Keep the newest message in view
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, [chatMessages, generationStatus]);

    const send = async (override?: unknown) => {
        const text = (typeof override === 'string' ? override : draft).trim();
        if ((!text && !attachedFile) || busy || restoringId) return;

        // A typed "undo" works like the restore buttons: back one step, no chat message.
        if (hasSlides && !attachedFile && UNDO_RE.test(text)) {
            setDraft('');
            const target = previousPoint(useCarouselStore.getState().chatMessages, useCarouselStore.getState().restoredTo);
            if (!target) { setNotice("There's nothing earlier to go back to."); return; }
            await restoreTo(target.id);
            return;
        }

        setDraft('');
        const pendingAttachment = attachedFile;
        setAttachedFile(null);
        // Sending after a restore: the faded replies go, and the worker trims the saved thread to match.
        const trimTo = hasSlides ? commitRestore() : undefined;
        // The verbatim message (full URL included) — shown in the bubble AND
        // persisted as the user turn, so the saved thread is a faithful record.
        const userMessageText = text || `📎 Attached: ${pendingAttachment?.name}`;
        const userMsgId = nextId();
        addChatMessage({
            id: userMsgId, role: 'user',
            text: userMessageText,
        });

        if (!hasSlides) {
            const runId = nextId();
            runMessageId.current = runId;
            addChatMessage({ id: runId, role: 'assistant', text: '', running: true, events: [] });

            const store = useCarouselStore.getState();
            let topicForRun = text;
            let sourceContentForRun = '';

            try {
                if (pendingAttachment) {
                    const preEvents = [{ label: `Attached: ${pendingAttachment.name}`, done: true }];
                    if (pendingAttachment.truncated) {
                        preEvents.push({ label: truncationNote(pendingAttachment.originalLength), done: true });
                    }
                    updateChatMessage(runId, { events: preEvents });
                    store.setInputMode('pdf');
                    store.setSourceContent(pendingAttachment.content);
                    sourceContentForRun = pendingAttachment.content;
                    topicForRun = text || pendingAttachment.name.replace(/\.[^.]+$/, '');
                } else {
                    const detected = detectInputMode(text);

                    if (detected.mode === 'video' && detected.videoId) {
                        updateChatMessage(runId, { events: [{ label: 'Detected YouTube link — fetching transcript...', done: false }] });
                        const transcript = await fetchYouTubeContent(detected.videoId);
                        const capped = capSourceContent(transcript);
                        store.setInputMode('video');
                        store.setSourceContent(capped.content);
                        sourceContentForRun = capped.content;
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
                        sourceContentForRun = article.content;
                        topicForRun = detected.instruction
                            ? `${detected.instruction}${article.title ? ` (Reference: ${article.title})` : ''}`
                            : article.title || `Carousel from ${domain}`;
                        const preEvents = [{ label: 'Article fetched', done: true }];
                        if (article.truncated) preEvents.push({ label: truncationNote(article.originalLength), done: true });
                        updateChatMessage(runId, { events: preEvents });
                    } else if (detected.mode === 'text') {
                        const capped = capSourceContent(detected.instruction);
                        store.setInputMode('text');
                        store.setSourceContent(capped.content);
                        sourceContentForRun = capped.content;
                        topicForRun = detected.instruction;
                        if (capped.truncated) {
                            updateChatMessage(runId, { events: [{ label: truncationNote(capped.originalLength), done: true }] });
                        }
                    } else {
                        store.setInputMode('topic');
                        store.setSourceContent('');
                    }
                }

                // Guardrail (instant, zero-cost): reject obvious off-purpose or
                // instruction-override prompts before spending any model calls.
                // The authoritative gate still runs server-side in the worker.
                const preGate = GatekeeperAgent.preScreen(topicForRun, sourceContentForRun);
                if (preGate && !preGate.allowed) {
                    runMessageId.current = null;
                    updateChatMessage(runId, { running: false, events: [], text: preGate.reason });
                    return;
                }

                // A specific request (enough words, or real source material) never needs a
                // clarifying question: start the job right away and let the worker write the
                // brief alongside its safety check and research, instead of a model round
                // trip here first.
                if (isSpecificRequest(topicForRun, sourceContentForRun)) {
                    await onFirstPrompt(topicForRun, undefined, userMessageText, { briefInWorker: true });
                    return;
                }

                // Creative Director: analyse intent before dispatching the job.
                // If intent is clear → brief is attached directly and generation starts.
                // If ambiguous → show quick-reply chips and wait for user answer.
                updateChatMessage(runId, { events: [{ label: 'Understanding your intent...', done: false }] });
                const intentResult = await CreativeDirectorAgent.analyseIntent(topicForRun, sourceContentForRun);

                if (!intentResult.ready) {
                    // Creative Director needs more info — show questions and stop.
                    const notReady = intentResult as { ready: false; questions: import('../../core/agents/CreativeDirectorAgent').ClarifyingQuestions };
                    const resumeToken = `cd-${Date.now()}`;
                    setPendingTopic(topicForRun);
                    updateChatMessage(runId, {
                        running: false,
                        text: notReady.questions.message,
                        quickReplies: {
                            groups: notReady.questions.groups,
                            resumeToken,
                        },
                    });
                    return;
                }


                // Brief is ready — store it and proceed to generation.
                // ── Deterministic slide count override ──────────────────────────────
                // The Creative Director estimates a natural count, but if the user
                // explicitly wrote "N slides" we always honour that number.
                // Regex is far more reliable than the LLM for this extraction.
                const requestedCount = parseExplicitSlideCount(text);
                if (requestedCount !== null) {
                    const SLIDE_MIN = 2, SLIDE_MAX = 20;
                    const clamped = Math.max(SLIDE_MIN, Math.min(SLIDE_MAX, requestedCount));
                    intentResult.brief.suggestedSlideCount = clamped;
                    if (requestedCount < SLIDE_MIN && !intentResult.brief.slideCountNote) {
                        intentResult.brief.slideCountNote = `Minimum is ${SLIDE_MIN} slides — generating ${SLIDE_MIN} for you.`;
                    } else if (requestedCount > SLIDE_MAX && !intentResult.brief.slideCountNote) {
                        intentResult.brief.slideCountNote = `Maximum allowed is ${SLIDE_MAX} slides — I'll generate ${SLIDE_MAX} for you and we can always add more!`;
                    }
                }
                // ────────────────────────────────────────────────────────────────────
                setPendingBrief(intentResult.brief);

                // If the Creative Director had to adjust the slide count (out of bounds),
                // show a friendly note in the chat before generation begins.
                if (intentResult.brief.slideCountNote) {
                    updateChatMessage(runId, {
                        running: true,
                        text: intentResult.brief.slideCountNote,
                        events: [{ label: 'Preparing your carousel...', done: false }],
                    });
                }

                await onFirstPrompt(topicForRun, intentResult.brief, userMessageText);



            } catch (e: any) {
                runMessageId.current = null;
                updateChatMessage(runId, { running: false, error: true, text: e?.message || 'Generation failed.' });
            }
            return;
        }

        // Conversational turn: dispatch an edit job to the background worker.
        // hooks/useJobWatcher.ts (mounted at the app root) applies the result —
        // slide patches, design actions, or a new sketch — once it resolves,
        // which is what lets this keep running if the user navigates away.
        const runId = nextId();
        runMessageId.current = runId;
        const state = useCarouselStore.getState();
        const scope = state.selectedSlideIndex;
        const scopeIndices = state.selectedSlideIndices;
        addChatMessage({
            id: runId, role: 'assistant', text: '', running: true,
            events: [{ label: 'Thinking...', done: false }]
        });
        try {
            // Server-authoritative: the worker loads the deck + thread from Appwrite
            // by carouselId, so the client ships only the message + which slide(s) are
            // in focus. Never re-send slides/theme (that was the stale-state bug).
            const { jobId } = await createJob({
                type: 'edit',
                carouselId: activeCarouselId,
                payload: {
                    message: text,
                    selectedSlideIndex: scope,
                    selectedSlideIndices: scopeIndices,
                    // Older turns folded by MemoryAgent; the worker only loads the recent thread.
                    conversationSummary: (state.chatSummary || '').slice(0, 2000),
                    // Restored to an earlier reply: the worker drops the later messages first.
                    ...(trimTo ? { restoredTo: trimTo } : {}),
                    // The ids shown here, so the saved thread (and later restores) match.
                    messageIds: { user: userMsgId, assistant: runId },
                },
            });
            setActiveJobId(jobId);
            setGenerating(true);

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
                    const foldCarouselId = activeCarouselId;
                    MemoryAgent.compactHistory(useCarouselStore.getState().chatSummary, toFold)
                        .then(updatedSummary => {
                            // The user may have opened another carousel meanwhile: never leak this summary into it.
                            if (useCarouselStore.getState().activeCarouselId !== foldCarouselId) return;
                            useCarouselStore.getState().setChatSummary(updatedSummary);
                            useCarouselStore.getState().setChatSummarizedUpTo(foldTarget);
                        })
                        .catch(err => console.warn('[ChatPanel] Compaction fire-and-forget failed unexpectedly:', err));
                }
            }
        } catch (e: any) {
            runMessageId.current = null;
            updateChatMessage(runId, { running: false, error: true, events: [], text: e?.message || 'That didn\'t work — try rephrasing.' });
        }
    };

    /** Puts the carousel back to how it was right after a reply (no chat message, no agent run). */
    const restoreTo = async (messageId: string) => {
        if (busy || restoringId) return;
        setRestoringId(messageId);
        try {
            const outcome = await restoreToReply(messageId);
            if (outcome === 'missing') {
                setNotice('That restore point is too old to bring back (the last 30 are kept).');
                updateChatMessage(messageId, { versionId: undefined });
            } else if (outcome === 'unavailable') {
                setNotice("This reply can't be restored.");
            }
        } catch (err) {
            console.warn('[ChatPanel] restore failed:', err);
            setNotice("Couldn't restore that version. Try again.");
        } finally {
            setRestoringId(null);
        }
    };

    const handleRetry = async (failedMsgId: string) => {
        const msgIndex = chatMessages.findIndex(m => m.id === failedMsgId);
        if (msgIndex === -1) return;

        // The user prompt is the user message immediately before this error message
        const userMsg = msgIndex > 0 ? chatMessages[msgIndex - 1] : null;
        const promptText = userMsg ? userMsg.text : (topic || draft);

        // Remove the failed message from the store
        const filteredMessages = chatMessages.filter(m => m.id !== failedMsgId);
        useCarouselStore.getState().setChatMessages(filteredMessages);

        if (!hasSlides) {
            // Creation flow
            const runId = nextId();
            runMessageId.current = runId;
            addChatMessage({ id: runId, role: 'assistant', text: '', running: true, events: [] });
            try {
                await onFirstPrompt(promptText, undefined, promptText);
            } catch (e: any) {
                runMessageId.current = null;
                updateChatMessage(runId, { running: false, error: true, events: [], text: e?.message || 'That didn\'t work — try rephrasing.' });
            }
        } else {
            // Edit flow
            const runId = nextId();
            runMessageId.current = runId;
            addChatMessage({
                id: runId, role: 'assistant', text: '', running: true,
                events: [{ label: 'Thinking...', done: false }]
            });
            try {
                const { jobId } = await createJob({
                    type: 'edit',
                    carouselId: activeCarouselId,
                    payload: {
                        message: promptText,
                        selectedSlideIndex: selectedSlideIndex,
                        selectedSlideIndices: selectedSlideIndices,
                        messageIds: { user: userMsg?.id, assistant: runId },
                    },
                });
                setActiveJobId(jobId);
                setGenerating(true);
            } catch (e: any) {
                runMessageId.current = null;
                updateChatMessage(runId, { running: false, error: true, events: [], text: e?.message || 'That didn\'t work — try rephrasing.' });
            }
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

    // ── Studio UX helpers (presentation only) ────────────────────────────────
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [composerFocused, setComposerFocused] = useState(false);
    const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});

    // Auto-grow the composer up to ~6 lines.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = '0px';
        el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
    }, [draft]);

    // "/" focuses the composer from anywhere that isn't already a text field.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))) return;
            e.preventDefault();
            textareaRef.current?.focus();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Other panels can send requests through the chat (studio:chat-send).
    const sendRef = useRef(send);
    sendRef.current = send;
    useEffect(() => {
        const onSend = (e: Event) => {
            const text = (e as CustomEvent<{ text?: string }>).detail?.text;
            if (typeof text === 'string' && text.trim()) sendRef.current(text);
        };
        window.addEventListener('studio:chat-send', onSend);
        return () => window.removeEventListener('studio:chat-send', onSend);
    }, []);

    const fillDraft = (text: string) => {
        setDraft(text);
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(text.length, text.length);
        });
    };

    const detected = !hasSlides && !attachedFile && draft.trim() ? detectInputMode(draft).mode : null;
    const lastMsg = chatMessages[chatMessages.length - 1];
    // Restore points: the newest one, and where the carousel is restored to (replies after it are faded).
    const latestPoint = restorePoints(chatMessages).slice(-1)[0];
    const restoredIndex = restoredTo ? chatMessages.findIndex(m => m.id === restoredTo) : -1;
    const canSend = !busy && (!!draft.trim() || !!attachedFile);

    return (
        <div className="st-panel rounded-2xl flex flex-col h-full w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2.5 pl-4 pr-3 h-12 border-b border-white/[0.06] shrink-0">
                <AgentStack busy={busy} />
                <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                        key={hasSlides ? (topic || 'Carousel') : 'new'}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        className="text-[13px] font-medium text-white truncate flex-1"
                    >
                        {hasSlides ? (topic || 'Carousel') : 'New carousel'}
                    </motion.span>
                </AnimatePresence>
                <AnimatePresence>
                    {hasSlides && (
                        <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={SPRING} className="lp-mono text-[10.5px] text-white/45 rounded-full border border-white/10 px-2 py-0.5 shrink-0">
                            {slides.length} slides
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto st-scroll px-4 py-5 space-y-4 min-h-0">
                {chatMessages.length === 0 && (
                    <EmptyState
                        onPick={fillDraft}
                        onAttach={() => fileInputRef.current?.click()}
                    />
                )}

                <AnimatePresence initial={false}>
                    {chatMessages.flatMap((msg, msgIndex) => [(
                        <motion.div
                            key={msg.id}
                            layout="position"
                            initial={{ opacity: 0, y: 14, scale: 0.98 }}
                            // Replies after a restore point fade until the next message (or going forward again).
                            animate={{ opacity: restoredIndex >= 0 && msgIndex > restoredIndex ? 0.38 : 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.4, ease: EASE }}
                            className={msg.role === 'user' ? 'flex justify-end' : 'group/msg flex justify-start gap-2.5'}
                        >
                            {msg.role === 'user' ? (
                                <div className="max-w-[86%] rounded-2xl rounded-br-md bg-white text-[#0b0b12] px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words shadow-[0_8px_24px_-12px_rgba(255,255,255,0.35)]">
                                    {msg.text}
                                </div>
                            ) : (
                                <>
                                    <AssistantAvatar running={!!msg.running} error={!!msg.error} />
                                    <div className={`min-w-0 max-w-[88%] rounded-2xl rounded-tl-md px-3.5 py-3 text-[13.5px] leading-relaxed border ${msg.error
                                        ? 'bg-rose-500/[0.07] text-rose-100 border-rose-400/25'
                                        : 'bg-white/[0.035] text-white/85 border-white/[0.08]'
                                        }`}>
                                        {msg.events && msg.events.length > 0 && (
                                            msg.running ? (
                                                <div className="mb-1">
                                                    <AgentTimeline events={msg.events} progress={generationProgress} />
                                                    <div className="mt-3 flex items-center justify-between gap-3">
                                                        <span className="lp-mono text-[10.5px] text-white/35">{activeJobId ? 'Runs in the background · safe to close' : 'Working on it…'}</span>
                                                        {activeJobId && <motion.button
                                                            whileTap={{ scale: 0.94 }}
                                                            onClick={handleCancelJob}
                                                            className="group flex items-center gap-1.5 rounded-full border border-white/12 px-2.5 py-1 text-[11px] text-white/60 hover:text-rose-200 hover:border-rose-400/40 hover:bg-rose-500/10 transition-colors"
                                                            title="Stop generation"
                                                        >
                                                            <Square size={9} className="fill-current" /> Stop
                                                        </motion.button>}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="mb-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenSteps(p => ({ ...p, [msg.id]: !p[msg.id] }))}
                                                        className="flex items-center gap-1.5 text-[11.5px] text-white/45 hover:text-white/80 transition-colors"
                                                        aria-expanded={!!openSteps[msg.id]}
                                                    >
                                                        <span className="grid place-items-center w-4 h-4 rounded-full bg-emerald-400/15 text-emerald-300"><Check size={10} strokeWidth={3} /></span>
                                                        {msg.events.length} {msg.events.length === 1 ? 'step' : 'steps'} completed
                                                        <motion.span animate={{ rotate: openSteps[msg.id] ? 90 : 0 }} transition={SPRING}><ChevronRight size={12} /></motion.span>
                                                    </button>
                                                    <AnimatePresence initial={false}>
                                                        {openSteps[msg.id] && (
                                                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
                                                                <div className="mt-2 ml-2 pl-3 border-l border-white/10 space-y-1.5">
                                                                    {msg.events.map((ev, i) => {
                                                                        const c = PHASE_COLOR[phaseOf(ev.label)];
                                                                        return (
                                                                            <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-2 text-[11.5px] text-white/50">
                                                                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                                                                                <span className="truncate">{phaseLabel(ev.label)}</span>
                                                                            </motion.div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            )
                                        )}
                                        {msg.text && <div className="whitespace-pre-wrap break-words">{msg.text}</div>}

                                        {msg.tokenUsage && (
                                            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 lp-mono text-[10px] text-white/35 select-none">
                                                <span className="flex items-center gap-1 text-violet-300/80"><Zap size={10} /> {msg.tokenUsage.totalTokens.toLocaleString()} tokens</span>
                                                <span>in {msg.tokenUsage.promptTokens.toLocaleString()}</span>
                                                <span>out {msg.tokenUsage.completionTokens.toLocaleString()}</span>
                                                {msg.tokenUsage.cachedTokens > 0 && <span className="text-emerald-300/70">cached {msg.tokenUsage.cachedTokens.toLocaleString()}</span>}
                                                {(msg.tokenUsage.costUsd ?? 0) > 0 && <span className="text-amber-200/70">${msg.tokenUsage.costUsd! < 0.01 ? msg.tokenUsage.costUsd!.toFixed(4) : msg.tokenUsage.costUsd!.toFixed(3)}</span>}
                                            </div>
                                        )}

                                        {/* Quick-reply chip UI for Creative Director clarifying questions */}
                                        {msg.quickReplies && !msg.running && (() => {
                                            const { groups, resumeToken } = msg.quickReplies;
                                            const toggleChip = (groupKey: string, value: string, multiSelect?: boolean) => {
                                                setChipSelections(prev => {
                                                    const cur = prev[groupKey] || [];
                                                    if (multiSelect) {
                                                        return { ...prev, [groupKey]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] };
                                                    }
                                                    return { ...prev, [groupKey]: cur.includes(value) ? [] : [value] };
                                                });
                                            };
                                            const handleChipSubmit = async () => {
                                                if (busy) return;
                                                const allSelections: string[] = [];
                                                groups.forEach((_, gi) => {
                                                    const groupKey = `${resumeToken}-${gi}`;
                                                    const groupSels = chipSelections[groupKey] || [];
                                                    allSelections.push(...groupSels);
                                                });
                                                const customSels = chipSelections[`${resumeToken}-custom`] || [];
                                                allSelections.push(...customSels);
                                                const combinedAnswers = allSelections.join(', ') || 'general audience, factual';

                                                updateChatMessage(msg.id, { quickReplies: undefined });
                                                addChatMessage({ id: nextId(), role: 'user', text: combinedAnswers });
                                                const runId2 = nextId();
                                                runMessageId.current = runId2;
                                                addChatMessage({ id: runId2, role: 'assistant', text: '', running: true, events: [{ label: 'Got it — preparing your carousel...', done: false }] });
                                                try {
                                                    const state = useCarouselStore.getState();
                                                    const brief = await CreativeDirectorAgent.synthesiseBrief(pendingTopic, combinedAnswers, state.sourceContent);
                                                    setPendingBrief(brief);
                                                    await onFirstPrompt(pendingTopic, brief, pendingTopic);
                                                } catch (e: any) {
                                                    updateChatMessage(runId2, { running: false, error: true, text: e?.message || 'Generation failed.' });
                                                }
                                            };

                                            const customSels = chipSelections[`${resumeToken}-custom`] || [];
                                            const hasAnySelection =
                                                groups.some((_, gi) => (chipSelections[`${resumeToken}-${gi}`] || []).length > 0) ||
                                                customSels.length > 0;

                                            return (
                                                <div className="mt-3.5 space-y-3.5">
                                                    {groups.map((g, gi) => {
                                                        const groupKey = `${resumeToken}-${gi}`;
                                                        const selections = chipSelections[groupKey] || [];
                                                        return (
                                                            <motion.div key={gi} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + gi * 0.08 }}>
                                                                <p className="text-[11.5px] text-white/50 mb-2 font-medium">{g.question}{g.multiSelect && <span className="text-white/30 font-normal"> · pick any</span>}</p>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {g.chips.map((chip, ci) => {
                                                                        const label = typeof chip === 'string' ? chip : ((chip as any)?.label || (chip as any)?.text || '');
                                                                        const value = typeof chip === 'string' ? chip : ((chip as any)?.value || (chip as any)?.id || label || `chip-${ci}`);
                                                                        const selected = selections.includes(value);
                                                                        return (
                                                                            <motion.button
                                                                                key={value}
                                                                                layout
                                                                                whileTap={{ scale: 0.94 }}
                                                                                onClick={() => toggleChip(groupKey, value, g.multiSelect)}
                                                                                aria-pressed={selected}
                                                                                transition={SPRING}
                                                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${selected
                                                                                    ? 'border-white bg-white text-black'
                                                                                    : 'border-white/12 bg-white/[0.03] text-white/75 hover:border-white/30 hover:text-white'
                                                                                    }`}
                                                                            >
                                                                                <AnimatePresence initial={false}>
                                                                                    {selected && (
                                                                                        <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: 'auto', opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="overflow-hidden flex">
                                                                                            <Check size={12} strokeWidth={3} />
                                                                                        </motion.span>
                                                                                    )}
                                                                                </AnimatePresence>
                                                                                {label}
                                                                            </motion.button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        );
                                                    })}
                                                    {customSels.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {customSels.map(v => (
                                                                <motion.span key={v} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-full bg-violet-400/15 border border-violet-300/30 px-2.5 py-1 text-[11.5px] text-violet-100">{v}</motion.span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 pt-0.5">
                                                        <input
                                                            type="text"
                                                            placeholder="Or say it in your own words, then Enter"
                                                            className="flex-1 min-w-0 rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-[12px] text-white placeholder-white/30 outline-none focus:border-violet-400/50 focus:shadow-[0_0_0_4px_rgba(155,107,255,0.12)] transition-[border-color,box-shadow]"
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') {
                                                                    const v = (e.target as HTMLInputElement).value.trim();
                                                                    if (v) {
                                                                        setChipSelections(prev => ({ ...prev, [`${resumeToken}-custom`]: [...(prev[`${resumeToken}-custom`] || []), v] }));
                                                                        (e.target as HTMLInputElement).value = '';
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <motion.button
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={handleChipSubmit}
                                                            disabled={busy}
                                                            className={`shrink-0 h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors disabled:opacity-50 ${hasAnySelection ? 'lp-btn-primary' : 'border border-white/15 text-white/70 hover:text-white hover:bg-white/[0.06]'}`}
                                                        >
                                                            {hasAnySelection ? 'Go' : 'Skip'} <ArrowRight size={12} className="inline -mt-px" />
                                                        </motion.button>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {msg.error && (
                                            <motion.button
                                                whileTap={{ scale: 0.95 }}
                                                onClick={() => handleRetry(msg.id)}
                                                className="group mt-2.5 flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-400/10 px-3 py-1 text-[11.5px] font-medium text-rose-100 hover:bg-rose-400/20 transition-colors"
                                            >
                                                <RotateCcw size={11} className="transition-transform duration-500 group-hover:-rotate-180" /> Try again
                                            </motion.button>
                                        )}
                                        {msg.running && !msg.text && (!msg.events || msg.events.length === 0) && <TypingDots />}
                                    </div>
                                    {/* Restore point: the carousel as it was right after this reply. */}
                                    {msg.versionId && !msg.running && (() => {
                                        const isCurrent = msg.id === (restoredTo ?? latestPoint?.id);
                                        return (
                                            <div className="self-end shrink-0 pb-1">
                                                <motion.button
                                                    type="button"
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => restoreTo(msg.id)}
                                                    disabled={busy || !!restoringId}
                                                    title={isCurrent ? 'The carousel is at this point. Click to reset it to this reply.' : 'Restore the carousel to this point'}
                                                    aria-label="Restore the carousel to this point"
                                                    className={`grid place-items-center w-6 h-6 rounded-full border transition-[color,border-color,background-color,opacity] disabled:cursor-default ${isCurrent
                                                        ? 'border-amber-200/45 bg-amber-200/[0.12] text-amber-100'
                                                        : 'border-white/12 text-white/40 opacity-50 group-hover/msg:opacity-100 hover:text-white hover:border-white/35 hover:bg-white/[0.06]'}`}
                                                >
                                                    {restoringId === msg.id ? <Spinner size={11} /> : <RotateCcw size={11} />}
                                                </motion.button>
                                            </div>
                                        );
                                    })()}
                                </>
                            )}
                        </motion.div>
                    ), msg.id === restoredTo ? (
                        <motion.div
                            key={`restored-${msg.id}`}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="flex items-center gap-2 text-[11px] text-amber-100/75"
                        >
                            <div className="h-px flex-1 bg-amber-200/20" />
                            <span className="shrink-0">Restored to this point</span>
                            {latestPoint && latestPoint.id !== msg.id && (
                                <button
                                    type="button"
                                    onClick={() => restoreTo(latestPoint.id)}
                                    disabled={busy || !!restoringId}
                                    className="shrink-0 rounded-full border border-amber-200/25 px-2 py-0.5 text-amber-100/85 hover:text-white hover:border-amber-200/50 transition-colors disabled:opacity-50"
                                >
                                    Back to latest
                                </button>
                            )}
                            <div className="h-px flex-1 bg-amber-200/20" />
                        </motion.div>
                    ) : null])}
                </AnimatePresence>
            </div>

            {/* Composer */}
            <div className="shrink-0 px-3 pb-3 pt-2 space-y-2">
                {/* Refinement suggestions (fill the composer, never auto-send) */}
                <AnimatePresence>
                    {hasSlides && !busy && !draft && !(lastMsg && lastMsg.quickReplies) && (
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
                            className="flex gap-1.5 overflow-x-auto lp-scrollbar-none -mx-1 px-1 pb-0.5"
                        >
                            {REFINE_SUGGESTIONS.map((sug, i) => (
                                <motion.button
                                    key={sug.label}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 + i * 0.05, ...SPRING }}
                                    whileHover={{ y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => fillDraft(sug.prompt)}
                                    className="shrink-0 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11.5px] text-white/65 hover:text-white hover:border-white/25 transition-colors"
                                >
                                    <sug.icon size={11} style={{ color: sug.color }} /> {sug.label}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {!hasSlides && attachedFile && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={SPRING}
                            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] pl-2 pr-1.5 py-1.5 w-fit max-w-full"
                        >
                            <span className="grid place-items-center w-7 h-7 rounded-lg bg-rose-400/10 border border-rose-300/20 shrink-0"><FileText size={13} className="text-rose-300" /></span>
                            <div className="min-w-0">
                                <div className="text-[12px] text-white truncate">{attachedFile.name}</div>
                                <div className="text-[10.5px] text-white/40" title={attachedFile.truncated ? truncationNote(attachedFile.originalLength) : undefined}>
                                    {attachedFile.truncated ? 'Long file · trimmed to fit' : 'Ready to use as source'}
                                </div>
                            </div>
                            <button onClick={() => setAttachedFile(null)} className="grid place-items-center w-6 h-6 rounded-full text-white/50 hover:text-white hover:bg-white/10 shrink-0" aria-label="Remove attachment">
                                <X size={12} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
                <AnimatePresence>
                    {notice && (
                        <motion.div key="notice" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-[11.5px] text-amber-100/80 px-1">{notice}</motion.div>
                    )}
                    {!hasSlides && attachError && (
                        <motion.div key="attach-error" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto', x: [0, -4, 4, 0] }} exit={{ opacity: 0, height: 0 }} className="text-[11.5px] text-rose-300 px-1">{attachError}</motion.div>
                    )}
                </AnimatePresence>

                <div
                    className={`relative rounded-2xl border transition-[border-color,box-shadow,background-color] duration-300 ${composerFocused
                        ? 'lp-conic border-transparent bg-black/40'
                        : 'border-white/10 bg-black/30 hover:border-white/20'}`}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.doc,.md,.txt"
                        onChange={onFileSelected}
                        className="hidden"
                    />
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onKeyDown={onKeyDown}
                        onFocus={() => setComposerFocused(true)}
                        onBlur={() => setComposerFocused(false)}
                        rows={1}
                        aria-label="Message the studio"
                        placeholder={busy ? 'Agents are working…' : hasSlides ? 'Ask for any change, like you would a designer…' : attachedFile ? 'Optional: add instructions (e.g. "keep it funny")…' : 'What should this carousel be about?'}
                        className="block w-full bg-transparent text-[14px] text-white placeholder-white/30 resize-none outline-none leading-relaxed px-3.5 pt-3 pb-1 max-h-[168px] st-scroll"
                        disabled={busy}
                    />
                    <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
                        {!hasSlides && (
                            <IconButton
                                tip="Attach PDF, DOCX, MD or TXT"
                                tipPos="top"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={busy || isAttaching}
                            >
                                {isAttaching ? <Spinner size={14} /> : <Paperclip size={15} />}
                            </IconButton>
                        )}
                        <Segmented
                            id="chat-template"
                            size="xs"
                            value={selectedTemplate}
                            onChange={(v) => setTemplate(v as any)}
                            options={TEMPLATE_OPTIONS.map(t => ({ value: t.id, label: t.label.replace('The ', ''), title: `Style: ${t.label}` }))}
                        />
                        <AnimatePresence>
                            {detected && (
                                <motion.span
                                    key={detected}
                                    initial={{ opacity: 0, scale: 0.8, filter: 'blur(4px)' }}
                                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                                    exit={{ opacity: 0, scale: 0.8 }}
                                    transition={SPRING}
                                    className="hidden sm:flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2 py-1 lp-mono text-[10px] text-white/70 whitespace-nowrap"
                                    title="Detected automatically"
                                >
                                    {React.createElement(MODE_META[detected].icon, { size: 11, className: MODE_META[detected].tint })}
                                    {MODE_META[detected].label}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        <div className="flex-1" />
                        <motion.button
                            onClick={() => send()}
                            disabled={!canSend}
                            whileTap={canSend ? { scale: 0.88 } : undefined}
                            animate={{ scale: canSend ? 1 : 0.92 }}
                            transition={SPRING}
                            className={`grid place-items-center w-8 h-8 rounded-full transition-colors ${canSend
                                ? 'bg-white text-black shadow-[0_6px_20px_-6px_rgba(155,107,255,0.8)]'
                                : 'bg-white/[0.06] text-white/30'
                                }`}
                            aria-label="Send"
                        >
                            {busy ? <Spinner size={14} /> : <ArrowUp size={15} strokeWidth={2.4} />}
                        </motion.button>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-1 min-h-[22px]">
                    <AnimatePresence mode="wait" initial={false}>
                        {hasSlides && selectedSlideIndices.length > 0 ? (
                            <motion.div
                                key="scope"
                                initial={{ opacity: 0, scale: 0.9, x: -6 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={SPRING}
                                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full bg-violet-400/15 border border-violet-300/35 text-violet-100"
                            >
                                <Layers size={11} className="text-violet-300 shrink-0" />
                                <span className="text-[11px] font-medium whitespace-nowrap">
                                    {selectedSlideIndices.length === 1
                                        ? `Editing slide ${selectedSlideIndices[0] + 1}`
                                        : `Editing slides ${[...selectedSlideIndices].sort((a, b) => a - b).map(i => i + 1).join(', ')}`}
                                </span>
                                <button
                                    onClick={() => setSelectedSlideIndices([])}
                                    title="Clear selection — edit the whole carousel"
                                    aria-label="Clear slide selection"
                                    className="grid place-items-center w-4 h-4 rounded-full text-violet-200/80 hover:text-white hover:bg-violet-400/40 transition-colors"
                                >
                                    <X size={10} />
                                </button>
                            </motion.div>
                        ) : (
                            <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-white/30 truncate">
                                {hasSlides ? 'Whole carousel · click a slide to focus · ⌘-click for several' : 'Topic, link, YouTube video or a file'}
                            </motion.span>
                        )}
                    </AnimatePresence>
                    <span className="hidden lg:flex items-center gap-1 text-[10.5px] text-white/25 shrink-0">
                        <Kbd>↵</Kbd> send <Kbd>⇧↵</Kbd> line <Kbd>/</Kbd> focus
                    </span>
                </div>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------ */
/* Presentational helpers                                               */
/* ------------------------------------------------------------------ */

const MODE_META = {
    topic: { label: 'Topic', icon: Lightbulb, tint: 'text-amber-300' },
    text: { label: 'Long text', icon: FileText, tint: 'text-emerald-300' },
    url: { label: 'Article link', icon: Link2, tint: 'text-sky-300' },
    video: { label: 'YouTube', icon: Youtube, tint: 'text-rose-300' },
} as const;

const REFINE_SUGGESTIONS = [
    { label: 'Punchier hook', prompt: 'Make the hook on slide 1 punchier', icon: Zap, color: '#3ee6f5' },
    { label: 'Tighten copy', prompt: 'Tighten the copy on every slide, fewer words', icon: Scissors, color: '#9b6bff' },
    { label: 'Add a stat slide', prompt: 'Add a stat slide with a strong number', icon: BarChart3, color: '#4f8cff' },
    { label: 'Warmer palette', prompt: 'Switch to a warmer color palette', icon: Palette, color: '#ff7a8a' },
    { label: 'Stronger CTA', prompt: 'Make the final call to action stronger', icon: Megaphone, color: '#b6f36a' },
];

const STARTERS = [
    { icon: Lightbulb, tint: '#fcd34d', title: 'Start from a topic', example: '7 lessons from 3 years of building in public', fill: '7 lessons from 3 years of building in public' },
    { icon: Link2, tint: '#7dd3fc', title: 'Turn an article into slides', example: 'Paste any blog or news link', fill: 'https://' },
    { icon: Youtube, tint: '#fda4af', title: 'Summarize a YouTube video', example: 'Paste a video link, add an angle', fill: 'https://youtu.be/' },
];

const EmptyState: React.FC<{ onPick: (text: string) => void; onAttach: () => void }> = ({ onPick, onAttach }) => (
    <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } } }} className="pt-6 pb-2">
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } }} className="px-1">
            <div className="lp-mono text-[10.5px] uppercase tracking-[0.18em] text-white/35">New carousel</div>
            <h2 className="lp-display mt-3 text-[30px] leading-[1.05] font-semibold text-white">
                What should we <span className="lp-serif lp-prism-text text-[1.12em]">make</span> today?
            </h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/50">
                Give the agents a topic, a link or a file. They research, find the angle and design every slide.
            </p>
        </motion.div>
        <div className="mt-6 space-y-2">
            {STARTERS.map(s => (
                <motion.button
                    key={s.title}
                    type="button"
                    variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onPick(s.fill)}
                    className="group w-full flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/20 p-3 text-left transition-colors"
                >
                    <span className="grid place-items-center w-9 h-9 rounded-xl border border-white/10 bg-black/30 shrink-0">
                        <s.icon size={16} style={{ color: s.tint }} />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-medium text-white">{s.title}</span>
                        <span className="block text-[12px] text-white/40 truncate">{s.example}</span>
                    </span>
                    <ArrowRight size={14} className="text-white/30 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                </motion.button>
            ))}
            <motion.button
                type="button"
                variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={onAttach}
                className="group w-full flex items-center gap-3 rounded-2xl border border-dashed border-white/15 hover:border-violet-300/40 hover:bg-violet-400/[0.04] p-3 text-left transition-colors"
            >
                <span className="grid place-items-center w-9 h-9 rounded-xl border border-white/10 bg-black/30 shrink-0">
                    <Paperclip size={15} className="text-violet-300" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-white">Upload a document</span>
                    <span className="block text-[12px] text-white/40">PDF, DOCX, Markdown or plain text</span>
                </span>
                <ArrowRight size={14} className="text-white/30 -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
            </motion.button>
        </div>
    </motion.div>
);

/** Small "crew" mark in the header; orbits while agents are working. */
const AgentStack: React.FC<{ busy: boolean }> = ({ busy }) => (
    <div className="relative w-7 h-7 shrink-0">
        <motion.div className="absolute inset-0" animate={busy ? { rotate: 360 } : { rotate: 0 }} transition={busy ? { duration: 3, repeat: Infinity, ease: 'linear' } : { duration: 0.6 }}>
            {['#3ee6f5', '#9b6bff', '#ff7a8a'].map((c, i) => (
                <span key={c} className="absolute w-2 h-2 rounded-full" style={{ background: c, left: `${50 + 34 * Math.cos((i * 2 * Math.PI) / 3) - 14}%`, top: `${50 + 34 * Math.sin((i * 2 * Math.PI) / 3) - 14}%`, boxShadow: `0 0 8px ${c}` }} />
            ))}
        </motion.div>
        <span className="absolute inset-[9px] rounded-full bg-white/90" />
    </div>
);

const AssistantAvatar: React.FC<{ running: boolean; error: boolean }> = ({ running, error }) => (
    <div className="relative w-7 h-7 shrink-0 mt-0.5">
        {running && <motion.span className="absolute -inset-[3px] rounded-full bg-[conic-gradient(from_0deg,transparent,#9b6bff,#3ee6f5,transparent)]" animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} />}
        <span className={`relative grid place-items-center w-7 h-7 rounded-full ${error ? 'bg-rose-400/20' : 'bg-gradient-to-br from-[#1b1b2a] to-[#10101a]'} ring-1 ring-white/15`}>
            <Sparkles size={13} className={error ? 'text-rose-300' : 'text-white'} />
        </span>
    </div>
);

const TypingDots: React.FC = () => (
    <span className="inline-flex items-center gap-1 py-1" aria-label="Thinking">
        {[0, 1, 2].map(i => (
            <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-white/60" animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
        ))}
    </span>
);

/** Live agent run: phase-coloured steps, an animated rail and the job's progress. */
const AgentTimeline: React.FC<{ events: { label: string; done: boolean }[]; progress?: number }> = ({ events, progress }) => {
    const current = events.find(e => !e.done) || events[events.length - 1];
    const color = PHASE_COLOR[phaseOf(current?.label)];
    return (
        <div>
            <div className="relative space-y-2.5">
                <span className="absolute left-[9px] top-2 bottom-2 w-px bg-white/10" />
                {events.map((ev, i) => {
                    const c = PHASE_COLOR[phaseOf(ev.label)];
                    const phase = phaseOf(ev.label);
                    return (
                        <motion.div
                            key={`${i}-${ev.label}`}
                            initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
                            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                            transition={{ duration: 0.4, ease: EASE }}
                            className="relative flex items-start gap-2.5"
                        >
                            <span className="relative z-10 grid place-items-center w-[19px] h-[19px] rounded-full shrink-0 bg-[#10101a]" style={{ boxShadow: `0 0 0 1px ${ev.done ? 'rgba(255,255,255,0.15)' : c}` }}>
                                {ev.done ? <DrawCheck size={11} color="#6ee7b7" /> : <Spinner size={11} color={c} />}
                            </span>
                            <span className="min-w-0 pt-px">
                                {phase !== 'THINK' && <span className="lp-mono text-[9.5px] tracking-[0.14em] mr-1.5" style={{ color: ev.done ? 'rgba(255,255,255,0.3)' : c }}>{phase}</span>}
                                <span className={`text-[12px] ${ev.done ? 'text-white/45' : 'lp-shimmer'}`}>{phaseLabel(ev.label)}</span>
                            </span>
                        </motion.div>
                    );
                })}
            </div>
            <div className="mt-3 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div
                    className="h-full rounded-full st-sheen"
                    style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
                    animate={{ width: `${Math.max(4, progress || 0)}%` }}
                    transition={{ duration: 0.7, ease: EASE }}
                />
            </div>
        </div>
    );
};
