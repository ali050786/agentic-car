/**
 * Save Carousel Modal - FIXED VERSION
 * 
 * Modal dialog for saving generated carousel to database.
 * Handles template type conversion for database compatibility.
 * 
 * Location: src/components/SaveCarouselModal.tsx
 */

import React, { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { createCarousel } from '../services/carouselService';
import { appToDbTemplate, type AppTemplateType } from '../utils/templateConverter';
import { X, Save, Lock, Globe, AlertCircle, CheckCircle } from 'lucide-react';

interface SaveCarouselModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateType: AppTemplateType;  // App uses 'template-1' and 'template-2'
  theme: any;
  slides: any[];
  defaultTitle?: string;
}

export const SaveCarouselModal: React.FC<SaveCarouselModalProps> = ({
  isOpen,
  onClose,
  templateType,
  theme,
  slides,
  defaultTitle = '',
}) => {
  const { user } = useAuthStore();
  
  const [title, setTitle] = useState(defaultTitle);
  const [isPublic, setIsPublic] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    if (!user) {
      setError('You must be logged in to save carousels');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    if (title.length > 200) {
      setError('Title must be less than 200 characters');
      return;
    }

    setIsSaving(true);
    setError('');

    // Convert app template format to database format
    const dbTemplateType = appToDbTemplate(templateType);

    const { data, error: saveError } = await createCarousel(
      user.id,
      title.trim(),
      dbTemplateType,  // Use converted template type
      theme,
      slides,
      isPublic
    );

    setIsSaving(false);

    if (saveError) {
      console.error('Save error:', saveError);
      setError('Failed to save carousel. Please try again.');
    } else {
      setSuccess(true);
      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
        // Reset state
        setTitle('');
        setIsPublic(false);
        setSuccess(false);
      }, 1500);
    }
  };

  const handleClose = () => {
    if (!isSaving && !success) {
      setTitle('');
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-xl font-bold text-white">Save Carousel</h2>
          <button
            onClick={handleClose}
            disabled={isSaving || success}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Saved Successfully!</h3>
              <p className="text-neutral-400 text-sm">Your carousel has been saved</p>
            </div>
          ) : (
            <>
              {/* Title Input */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  Carousel Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title for your carousel"
                  className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                  maxLength={200}
                  autoFocus
                />
                <p className="mt-1 text-xs text-neutral-500">
                  {title.length}/200 characters
                </p>
              </div>

              {/* Public/Private Toggle */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-3">
                  Visibility
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setIsPublic(false)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      !isPublic
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Lock size={20} className={!isPublic ? 'text-blue-400' : 'text-neutral-500'} />
                      <div>
                        <div className="font-medium text-white mb-1">Private</div>
                        <div className="text-xs text-neutral-400">Only you can see this carousel</div>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsPublic(true)}
                    className={`w-full p-4 rounded-lg border text-left transition-all ${
                      isPublic
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-white/10 bg-black/20 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Globe size={20} className={isPublic ? 'text-blue-400' : 'text-neutral-500'} />
                      <div>
                        <div className="font-medium text-white mb-1">Public</div>
                        <div className="text-xs text-neutral-400">Anyone with the link can view</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-sm text-red-200 flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="flex gap-3 p-6 border-t border-white/10">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !title.trim()}
              className={`flex-1 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                isSaving || !title.trim()
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white'
              }`}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Carousel
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SaveCarouselModal;