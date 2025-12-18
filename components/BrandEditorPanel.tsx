/**
 * Brand Editor Panel Component
 * 
 * Side panel for editing brand kit details including:
 * - Brand identity (name, title, image)
 * - Brand colors (primary, secondary, text, background)
 * - Save to global or local scope
 * 
 * Location: src/components/BrandEditorPanel.tsx
 */

import React, { useState, useEffect } from 'react';
import { X, Upload, Save } from 'lucide-react';
import { BrandKit } from '../types';
import { useAuthStore } from '../store/useAuthStore';
import { storage, ID, config } from '../lib/appwriteClient';

interface BrandEditorPanelProps {
    isOpen: boolean;
    initialBrandKit: BrandKit | null;
    onSave: (brandKit: BrandKit) => void;
    onClose: () => void;
}

export const BrandEditorPanel: React.FC<BrandEditorPanelProps> = ({
    isOpen,
    initialBrandKit,
    onSave,
    onClose,
}) => {
    const { updateGlobalBrandKit } = useAuthStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Local state for editing
    const [brandKit, setBrandKit] = useState<BrandKit>({
        enabled: true,
        identity: {
            name: 'Sikandar Ali',
            title: 'Founder',
            imageUrl: 'https://sgp.cloud.appwrite.io/v1/storage/buckets/693df05200140fb6514a/files/694278bd001f8831ffc8/view?project=6932ab3b00290095e2e1',
        },
        colors: {
            primary: '#3b82f6',
            secondary: '#8b5cf6',
            text: '#ffffff',
            background: '#000000',
        },
    });

    // Sync with initialBrandKit when it changes
    useEffect(() => {
        if (initialBrandKit) {
            setBrandKit(initialBrandKit);
        }
    }, [initialBrandKit]);

    const handleSave = async () => {
        try {
            await updateGlobalBrandKit(brandKit);
            onSave(brandKit);
            onClose();
        } catch (error) {
            console.error('Failed to save global brand kit:', error);
            alert('Failed to save brand identity. Please try again.');
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!config.storageBucketId) {
            alert('Appwrite storage bucket ID is not configured. Please check your .env file.');
            return;
        }

        setIsUploading(true);
        try {
            // 1. Upload file to Appwrite Storage
            const response = await storage.createFile(
                config.storageBucketId,
                ID.unique(),
                file
            );

            // 2. Get file view URL
            const fileUrl = storage.getFileView(
                config.storageBucketId,
                response.$id
            );

            // 3. Update state with new URL
            setBrandKit({
                ...brandKit,
                identity: { ...brandKit.identity, imageUrl: fileUrl }
            });
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-[400px] bg-neutral-900 border-l border-white/10 shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-lg font-bold text-white">
                            Edit Brand Identity
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1">
                            Changes apply to all your carousels
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                        title="Close Brand Editor"
                        aria-label="Close Brand Editor"
                    >
                        <X className="w-5 h-5 text-neutral-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Brand Identity Section */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Brand Identity
                        </h3>

                        {/* Brand Name */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Brand Name
                            </label>
                            <input
                                type="text"
                                value={brandKit.identity.name}
                                onChange={(e) => setBrandKit({
                                    ...brandKit,
                                    identity: { ...brandKit.identity, name: e.target.value }
                                })}
                                placeholder="e.g. Acme Inc"
                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Brand Title */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Brand Title
                            </label>
                            <input
                                type="text"
                                value={brandKit.identity.title}
                                onChange={(e) => setBrandKit({
                                    ...brandKit,
                                    identity: { ...brandKit.identity, title: e.target.value }
                                })}
                                placeholder="e.g. Founder & CEO"
                                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                            />
                        </div>

                        {/* Brand Image Upload Widget */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Brand Avatar
                            </label>

                            <div className="flex flex-col gap-3">
                                {/* Hidden File Input */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />

                                {brandKit.identity.imageUrl ? (
                                    /* Image Preview State */
                                    <div className="relative group w-24 h-24 mx-auto">
                                        <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-white/30 transition-colors">
                                            <img
                                                src={brandKit.identity.imageUrl}
                                                alt="Brand Avatar"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    // Fallback if image fails to load
                                                    e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(brandKit.identity.name)}&background=random`;
                                                }}
                                            />
                                        </div>

                                        {/* Overlay Actions */}
                                        <div className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                                                title="Change Image"
                                            >
                                                <Upload className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setBrandKit({
                                                    ...brandKit,
                                                    identity: { ...brandKit.identity, imageUrl: '' }
                                                })}
                                                className="p-1.5 bg-red-500/20 hover:bg-red-500/40 rounded-full text-red-400 transition-colors"
                                                title="Remove Image"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {isUploading && (
                                            <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center z-10">
                                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    /* Upload Placeholder State */
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`
                                            cursor-pointer group
                                            w-full h-32 
                                            border-2 border-dashed border-white/10 hover:border-blue-500/50
                                            bg-black/20 hover:bg-blue-500/5
                                            rounded-xl
                                            flex flex-col items-center justify-center gap-3
                                            transition-all duration-200
                                            ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                                        `}
                                    >
                                        {isUploading ? (
                                            <div className="w-6 h-6 border-2 border-white/30 border-t-blue-500 rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                <div className="p-3 rounded-full bg-white/5 group-hover:bg-blue-500/10 group-hover:text-blue-500 text-neutral-400 transition-colors">
                                                    <Upload className="w-5 h-5" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-xs font-medium text-neutral-300 group-hover:text-blue-400 transition-colors">
                                                        Click to upload image
                                                    </p>
                                                    <p className="text-[10px] text-neutral-500 mt-1">
                                                        SVG, PNG, JPG (max 2MB)
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Brand Colors Section */}
                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                            Brand Colors
                        </h3>

                        {/* Primary Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Primary Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.primary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, primary: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.primary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, primary: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Secondary Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Secondary Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.secondary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, secondary: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.secondary}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, secondary: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Text Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Text Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.text}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, text: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.text}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, text: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>

                        {/* Background Color */}
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Background Color
                            </label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={brandKit.colors.background}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, background: e.target.value }
                                    })}
                                    className="w-12 h-10 rounded border border-white/20 cursor-pointer"
                                />
                                <input
                                    type="text"
                                    value={brandKit.colors.background}
                                    onChange={(e) => setBrandKit({
                                        ...brandKit,
                                        colors: { ...brandKit.colors, background: e.target.value }
                                    })}
                                    className="flex-1 px-3 py-2 bg-black/40 border border-white/10 rounded-lg text-white text-sm font-mono focus:outline-none focus:border-blue-500 transition-colors"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white font-medium hover:bg-white/5 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-white font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Brand
                    </button>
                </div>
            </div>
        </>
    );
};

export default BrandEditorPanel;
