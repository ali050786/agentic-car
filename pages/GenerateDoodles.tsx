import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Play, Pause, Download, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { storage, ID, config } from '../lib/appwriteClient';

interface DoodleItem {
    topic: string;
    tags: string[];
    prompt: string;
}

interface OutputItem {
    id: string;
    topic: string;
    tags: string[];
    url: string;
}

const GenerateDoodles: React.FC = () => {
    const [inputData, setInputData] = useState<DoodleItem[]>([]);
    const [outputData, setOutputData] = useState<OutputItem[]>([]);
    const outputRef = React.useRef<OutputItem[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [isFinished, setIsFinished] = useState(false);

    // Load the input JSON
    useEffect(() => {
        fetch('/api/doodles-input')
            .then(res => res.json())
            .then(data => {
                setInputData(data);
                addLog(`Loaded ${data.length} items from image-1.json`);
            })
            .catch(err => {
                addLog(`Error loading image-1.json: ${err.message}`);
            });
    }, []);

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev]);
    };

    const processNext = async (index: number) => {
        if (index >= inputData.length) {
            setIsProcessing(false);
            setIsFinished(true);
            addLog("All items processed!");
            return;
        }

        const item = inputData[index];
        addLog(`Processing ${index + 1}/${inputData.length}: ${item.topic}...`);

        try {
            // 1. Generate URL from Replicate (via backend proxy)
            const genResponse = await fetch('/api/generate-doodle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item),
            });

            if (!genResponse.ok) {
                const errData = await genResponse.json();
                throw new Error(errData.error || 'Failed to generate image');
            }

            const { replicateUrl } = await genResponse.json();
            addLog(`Image generated on Replicate. Downloading...`);

            // 2. Fetch image via proxy to avoid CORS
            const proxyResponse = await fetch(`/api/proxy-image?url=${encodeURIComponent(replicateUrl)}`);
            if (!proxyResponse.ok) throw new Error('Failed to download image via proxy');
            const blob = await proxyResponse.blob();

            // 3. Upload to Appwrite (using frontend authenticated session)
            addLog(`Uploading to Appwrite storage...`);
            const fileResponse = await storage.createFile(
                config.storageBucketId,
                ID.unique(),
                new File([blob], `${item.topic}.webp`, { type: 'image/webp' })
            );

            const finalUrl = `${config.endpoint}/storage/buckets/${config.storageBucketId}/files/${fileResponse.$id}/view?project=${config.projectId}`;

            const result: OutputItem = {
                id: fileResponse.$id,
                topic: item.topic,
                tags: item.tags,
                url: finalUrl
            };

            // FIX: Use ref to accumulate results instead of stale state
            outputRef.current = [...outputRef.current, result];
            setOutputData(outputRef.current);
            addLog(`Successfully stored ${item.topic}: ${finalUrl}`);

            // NEW: Auto-save to server JSON
            try {
                await fetch('/api/save-image-output', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(outputRef.current),
                });
                addLog(`Auto-saved progress to image_output.json`);
            } catch (saveErr) {
                addLog(`Warning: Auto-save failed`);
            }

            // Move to next index state
            const nextIndex = index + 1;
            setCurrentIndex(nextIndex);
        } catch (err: any) {
            addLog(`Error processing ${item.topic}: ${err.message}`);
            setIsProcessing(false);
            processingRef.current = false;
        }
    };

    // Use a ref for processing state to avoid stale issues in the timeout loop
    const processingRef = React.useRef(false);

    const runLoop = async (index: number) => {
        if (!processingRef.current) return;

        await processNext(index);

        if (processingRef.current && (index + 1) < inputData.length) {
            addLog(`Waiting 12 seconds before next item...`);
            setTimeout(() => runLoop(index + 1), 12000);
        } else if (index + 1 >= inputData.length) {
            setIsProcessing(false);
            processingRef.current = false;
        }
    };

    const startProcessing = () => {
        if (isProcessing) return;
        setIsProcessing(true);
        processingRef.current = true;
        addLog("Started generation process...");
        runLoop(currentIndex);
    };

    const pauseProcessing = () => {
        setIsProcessing(false);
        processingRef.current = false;
        addLog("Paused generation process.");
    };

    const downloadOutput = () => {
        const blob = new Blob([JSON.stringify(outputData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'image_output.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        addLog("Downloaded image_output.json");
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/app" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                        AI Doodle Generator
                    </h1>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6">
                        <p className="text-neutral-400 text-sm mb-1">Total Items</p>
                        <p className="text-3xl font-mono">{inputData.length}</p>
                    </div>
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6">
                        <p className="text-neutral-400 text-sm mb-1">Processed</p>
                        <p className="text-3xl font-mono text-cyan-400">{currentIndex}</p>
                    </div>
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6">
                        <p className="text-neutral-400 text-sm mb-1">Generated</p>
                        <p className="text-3xl font-mono text-green-400">{outputData.length}</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mb-8">
                    {!isProcessing && !isFinished && (
                        <button
                            onClick={startProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold transition-all shadow-lg shadow-blue-900/20"
                        >
                            <Play size={20} /> Start Generating
                        </button>
                    )}
                    {isProcessing && (
                        <button
                            onClick={pauseProcessing}
                            className="flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold transition-all shadow-lg shadow-amber-900/20"
                        >
                            <Pause size={20} /> Pause
                        </button>
                    )}
                    {(outputData.length > 0) && (
                        <>
                            <button
                                onClick={downloadOutput}
                                className="flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-xl font-semibold transition-all"
                            >
                                <Download size={20} /> Download JSON
                            </button>
                        </>
                    )}
                </div>

                {/* Progress Bar */}
                {inputData.length > 0 && (
                    <div className="mb-8">
                        <div className="flex justify-between text-xs text-neutral-500 mb-2 font-mono">
                            <span>PROGRESS</span>
                            <span>{Math.round((currentIndex / inputData.length) * 100)}%</span>
                        </div>
                        <div className="h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
                                style={{ width: `${(currentIndex / inputData.length) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Logs Area */}
                <div className="bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    <div className="bg-neutral-900/50 px-6 py-4 border-b border-white/10 flex justify-between items-center">
                        <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">Logs</h2>
                        {isProcessing && <Loader2 size={16} className="text-blue-400 animate-spin" />}
                    </div>
                    <div className="p-6 h-96 overflow-y-auto font-mono text-sm space-y-2 flex flex-col-reverse">
                        {logs.map((log, i) => (
                            <div key={i} className={`
                                border-l-2 pl-3 py-1
                                ${log.includes('Error') ? 'border-red-500 text-red-400 bg-red-500/5' :
                                    log.includes('Successfully') ? 'border-green-500 text-green-400 bg-green-500/5' :
                                        'border-neutral-700 text-neutral-400'}
                            `}>
                                {log}
                            </div>
                        ))}
                        {logs.length === 0 && (
                            <div className="text-neutral-600 italic">No logs yet...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GenerateDoodles;
