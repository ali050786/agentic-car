import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, RefreshCw, Download, ArrowLeft, Loader2, Image as ImageIcon, ExternalLink, Check } from 'lucide-react';
import { storage, ID, config } from '../lib/appwriteClient';

interface OutputItem {
    id: string;
    topic: string;
    tags: string[];
    url: string;
}

const ImageRefinement: React.FC = () => {
    const [images, setImages] = useState<OutputItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null); // item.id
    const [logs, setLogs] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [replaceId, setReplaceId] = useState<string | null>(null);

    useEffect(() => {
        fetchImages();
    }, []);

    const fetchImages = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/image-output');
            const data = await response.json();
            setImages(data || []);
            addLog(`Loaded ${data.length} images from storage.`);
        } catch (err: any) {
            addLog(`Error loading images: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const addLog = (message: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${message}`, ...prev.slice(0, 49)]);
    };

    const persistChanges = async (updatedImages: OutputItem[]) => {
        try {
            const response = await fetch('/api/save-image-output', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedImages),
            });
            if (!response.ok) throw new Error('Failed to save changes to server.');
            addLog('Changes persisted to image_output.json');
            return true;
        } catch (err: any) {
            addLog(`Persistence error: ${err.message}`);
            return false;
        }
    };

    const handleDelete = async (item: OutputItem) => {
        if (!window.confirm(`Are you sure you want to delete "${item.topic}"?`)) return;

        setIsProcessing(item.id);
        try {
            // 1. Delete from Appwrite Storage
            addLog(`Deleting ${item.topic} from Appwrite...`);
            await storage.deleteFile(config.storageBucketId, item.id);

            // 2. Update local state
            const updated = images.filter(img => img.id !== item.id);
            setImages(updated);

            // 3. Persist to JSON
            await persistChanges(updated);
            addLog(`Successfully deleted ${item.topic}`);
        } catch (err: any) {
            addLog(`Delete error: ${err.message}`);
            // If it's a 404 in storage, we should still remove it from the list
            if (err.code === 404) {
                const updated = images.filter(img => img.id !== item.id);
                setImages(updated);
                await persistChanges(updated);
                addLog(`Item removed from list (was already missing from storage).`);
            }
        } finally {
            setIsProcessing(null);
        }
    };

    const handleReplaceClick = (id: string) => {
        setReplaceId(id);
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !replaceId) return;

        setIsProcessing(replaceId);
        const item = images.find(img => img.id === replaceId);
        if (!item) return;

        try {
            addLog(`Replacing ${item.topic} with new upload...`);

            // 1. Upload new file to Appwrite
            const fileResponse = await storage.createFile(
                config.storageBucketId,
                ID.unique(),
                file
            );

            const newUrl = `${config.endpoint}/storage/buckets/${config.storageBucketId}/files/${fileResponse.$id}/view?project=${config.projectId}`;

            // 2. Optional: Delete old file from Appwrite
            try {
                await storage.deleteFile(config.storageBucketId, item.id);
            } catch (delErr) {
                console.warn('Failed to delete old file during replacement:', delErr);
            }

            // 3. Update state
            const updated = images.map(img =>
                img.id === replaceId
                    ? { ...img, id: fileResponse.$id, url: newUrl }
                    : img
            );
            setImages(updated);

            // 4. Persist to JSON
            await persistChanges(updated);
            addLog(`Successfully replaced ${item.topic}`);
        } catch (err: any) {
            addLog(`Replacement error: ${err.message}`);
        } finally {
            setIsProcessing(null);
            setReplaceId(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileUpload}
            />

            <div className="max-w-7xl mx-auto">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/app" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <ArrowLeft size={24} />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                Image Refinement
                            </h1>
                            <p className="text-neutral-400 text-sm">Manage, refine and optimize your generated doodles</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-4 py-2 bg-neutral-900 border border-white/10 rounded-lg flex items-center gap-2">
                            <ImageIcon size={18} className="text-purple-400" />
                            <span className="font-mono">{images.length} Images</span>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Main Content Area */}
                    <div className="lg:col-span-3">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-neutral-900/50 border border-dashed border-white/10 rounded-3xl">
                                <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                                <p className="text-neutral-400">Loading your gallery...</p>
                            </div>
                        ) : images.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-neutral-900/50 border border-dashed border-white/10 rounded-3xl">
                                <ImageIcon size={48} className="text-neutral-700 mb-4" />
                                <p className="text-neutral-400">No images found. Generate some in the Doodle Generator!</p>
                                <Link to="/generate" className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold transition-colors">
                                    Go to Generator
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                                {images.map((item) => (
                                    <div key={item.id} className="group relative bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 shadow-xl">
                                        {/* Image Preview */}
                                        <div className="aspect-[2/3] relative overflow-hidden bg-neutral-800">
                                            <img
                                                src={item.url}
                                                alt={item.topic}
                                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                loading="lazy"
                                            />
                                            {/* Overlay info */}
                                            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black via-black/40 to-transparent pt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <h3 className="text-sm font-bold truncate">{item.topic.replace(/_/g, ' ')}</h3>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {item.tags.slice(0, 2).map(tag => (
                                                        <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-white/10 rounded border border-white/5">{tag}</span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Action Spinner */}
                                            {isProcessing === item.id && (
                                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                                                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions Bar */}
                                        <div className="p-3 grid grid-cols-3 gap-2 bg-neutral-900/80 backdrop-blur-md">
                                            <button
                                                onClick={() => handleDelete(item)}
                                                disabled={!!isProcessing}
                                                className="flex items-center justify-center p-2 rounded-lg bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all order-3"
                                                title="Delete"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleReplaceClick(item.id)}
                                                disabled={!!isProcessing}
                                                className="flex items-center justify-center p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white transition-all order-2"
                                                title="Replace"
                                            >
                                                <RefreshCw size={18} />
                                            </button>
                                            <a
                                                href={`${item.url}&download=1`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center p-2 rounded-lg bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white transition-all order-1"
                                                title="Download"
                                            >
                                                <Download size={18} />
                                            </a>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar / Logs */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden h-[600px] flex flex-col">
                            <div className="px-6 py-4 border-b border-white/10 bg-neutral-900/50 flex items-center justify-between">
                                <h2 className="text-xs font-bold uppercase tracking-tighter text-neutral-400">Activity Log</h2>
                                <button onClick={() => setLogs([])} className="text-[10px] text-neutral-600 hover:text-neutral-400 uppercase font-bold">Clear</button>
                            </div>
                            <div className="flex-1 p-6 overflow-y-auto font-mono text-xs space-y-3 flex flex-col-reverse">
                                {logs.map((log, i) => (
                                    <div key={i} className={`
                                        border-l-2 pl-3 py-1 bg-white/5 rounded-r
                                        ${log.includes('error') || log.includes('Failed') ? 'border-red-500 text-red-400' :
                                            log.includes('Successfully') ? 'border-green-500 text-green-400' :
                                                'border-purple-500/30 text-neutral-500'}
                                    `}>
                                        {log}
                                    </div>
                                ))}
                                {logs.length === 0 && (
                                    <div className="text-neutral-700 italic text-center py-12">No activity recorded yet.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/20 rounded-2xl p-6 shadow-2xl">
                            <h3 className="text-sm font-bold mb-2">Pro Tip</h3>
                            <p className="text-xs text-neutral-300 leading-relaxed">
                                Replacing an image will automatically update your <code className="text-purple-300">image_output.json</code> file and clean up the old file from Appwrite storage to save space.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageRefinement;
