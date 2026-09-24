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
import { Upload, Save, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloseButton, Field, Modal, SPRING, Spinner, inputClass } from './studio/ui';
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

    const initial = (brandKit.identity.name || 'U').charAt(0).toUpperCase();

    return (
        <Modal open={isOpen} onClose={onClose} variant="drawer" className="w-full max-w-[420px] flex flex-col" labelledBy="brand-title">
            <div className="flex items-start justify-between gap-4 p-6 pb-4">
                <div>
                    <div className="lp-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">Brand kit</div>
                    <h2 id="brand-title" className="lp-display mt-1.5 text-[22px] font-semibold text-white">Your signature</h2>
                    <p className="text-[12.5px] text-white/45 mt-1">Shows on every slide. Changes apply to all your carousels.</p>
                </div>
                <CloseButton onClick={onClose} label="Close brand editor" />
            </div>

            <div className="flex-1 overflow-y-auto st-scroll px-6 pb-6 space-y-6">
                {/* Live preview of the signature card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, ...SPRING }}
                    className="relative rounded-2xl p-[1px] bg-gradient-to-br from-cyan-300/40 via-violet-400/40 to-rose-300/40"
                >
                    <div className="rounded-[15px] p-5 st-canvas" style={{ background: `radial-gradient(120% 120% at 0% 0%, ${brandKit.colors.primary}22, transparent 60%), #0e0e17` }}>
                        <div className="lp-mono text-[10px] uppercase tracking-[0.16em] text-white/35 mb-4">Preview</div>
                        <div className="flex items-center gap-3">
                            <motion.div key={brandKit.identity.imageUrl || 'none'} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING} className="relative w-12 h-12 shrink-0">
                                {brandKit.identity.imageUrl ? (
                                    <img
                                        src={brandKit.identity.imageUrl}
                                        alt=""
                                        className="w-12 h-12 rounded-full object-cover ring-2 ring-white/15"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                ) : (
                                    <span className="grid place-items-center w-12 h-12 rounded-full text-[18px] font-semibold text-white" style={{ background: `linear-gradient(135deg, ${brandKit.colors.primary}, ${brandKit.colors.secondary})` }}>{initial}</span>
                                )}
                            </motion.div>
                            <div className="min-w-0">
                                <div className="text-[15px] font-semibold truncate" style={{ color: brandKit.colors.primary }}>{brandKit.identity.name || 'Your name'}</div>
                                <div className="text-[12.5px] text-white/70 truncate">{brandKit.identity.title || 'Your title'}</div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <div className="space-y-4">
                    <Field label="Name">
                        <input
                            type="text"
                            value={brandKit.identity.name}
                            onChange={(e) => setBrandKit({ ...brandKit, identity: { ...brandKit.identity, name: e.target.value } })}
                            placeholder="e.g. Acme Inc"
                            className={inputClass()}
                        />
                    </Field>
                    <Field label="Title">
                        <input
                            type="text"
                            value={brandKit.identity.title}
                            onChange={(e) => setBrandKit({ ...brandKit, identity: { ...brandKit.identity, title: e.target.value } })}
                            placeholder="e.g. Founder & CEO"
                            className={inputClass()}
                        />
                    </Field>

                    <div>
                        <span className="block text-[12px] font-medium text-white/60 mb-1.5">Photo</span>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                        <div className="flex items-center gap-3">
                            <motion.button
                                type="button"
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="group flex-1 flex items-center gap-3 rounded-xl border border-dashed border-white/15 hover:border-violet-300/50 hover:bg-violet-400/[0.05] px-3.5 py-3 text-left transition-colors disabled:opacity-60"
                            >
                                <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/[0.05] border border-white/10 text-white/70 group-hover:text-violet-200 transition-colors">
                                    {isUploading ? <Spinner size={15} /> : <Upload size={15} />}
                                </span>
                                <span>
                                    <span className="block text-[12.5px] font-medium text-white">{isUploading ? 'Uploading…' : brandKit.identity.imageUrl ? 'Replace photo' : 'Upload a photo'}</span>
                                    <span className="block text-[11px] text-white/40">SVG, PNG or JPG · up to 2MB</span>
                                </span>
                            </motion.button>
                            <AnimatePresence>
                                {brandKit.identity.imageUrl && !isUploading && (
                                    <motion.button
                                        type="button"
                                        initial={{ opacity: 0, scale: 0.6 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.6 }}
                                        onClick={() => setBrandKit({ ...brandKit, identity: { ...brandKit.identity, imageUrl: '' } })}
                                        aria-label="Remove photo"
                                        className="grid place-items-center w-10 h-10 rounded-xl border border-rose-300/25 text-rose-300 hover:bg-rose-400/10 transition-colors"
                                    >
                                        <Trash2 size={15} />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 border-t border-white/[0.07] flex gap-2.5">
                <motion.button whileTap={{ scale: 0.97 }} onClick={onClose} className="flex-1 h-11 rounded-full border border-white/12 text-[13.5px] text-white/80 hover:text-white hover:bg-white/[0.05] transition-colors">
                    Cancel
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} className="lp-btn-primary flex-1 h-11 justify-center text-[13.5px]">
                    <Save size={15} /> Save brand
                </motion.button>
            </div>
        </Modal>
    );
};

export default BrandEditorPanel;
