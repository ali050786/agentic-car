/**
 * Share Modal - Phase 6 (FIXED)
 * 
 * Modal for sharing carousels with links and embed codes.
 * 
 * Location: src/components/ShareModal.tsx
 */

import React, { useState } from 'react';
import { Carousel } from '../services/carouselService';
import {
  X,
  Link as LinkIcon,
  Code,
  Copy,
  CheckCircle,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  carousel: Carousel;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  carousel,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  const shareUrl = `${window.location.origin}/view/${carousel.$id}`;
  const embedCode = `<iframe src="${shareUrl}" width="405" height="720" frameborder="0" allowfullscreen></iframe>`;

  const copyToClipboard = async (text: string, type: 'link' | 'embed') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const openInNewTab = () => {
    window.open(shareUrl, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-white/10 rounded-xl max-w-2xl w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Share Carousel</h2>
            <p className="text-sm text-neutral-400 mt-1">{carousel.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            title="Close Share Modal"
            aria-label="Close Share Modal"
          >
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Public Status */}
          {!carousel.isPublic && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg">
              <p className="text-sm text-yellow-200 flex items-center gap-2">
                <AlertCircle size={16} />
                This carousel is private. Make it public to share.
              </p>
            </div>
          )}

          {/* Share Link */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-300 mb-3">
              <LinkIcon size={16} />
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => copyToClipboard(shareUrl, 'link')}
                className={`px-4 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${copiedLink
                  ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
              >
                {copiedLink ? (
                  <>
                    <CheckCircle size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy
                  </>
                )}
              </button>
              <button
                onClick={openInNewTab}
                className="px-4 py-3 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg transition-colors"
                title="Open in new tab"
                aria-label="Open in new tab"
              >
                <ExternalLink size={16} />
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Anyone with this link can view your carousel
            </p>
          </div>

          {/* Embed Code */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-300 mb-3">
              <Code size={16} />
              Embed Code
            </label>
            <div className="relative">
              <textarea
                value={embedCode}
                readOnly
                rows={4}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white text-xs font-mono focus:outline-none focus:border-blue-500 resize-none"
              />
              <button
                onClick={() => copyToClipboard(embedCode, 'embed')}
                className={`absolute top-3 right-3 px-3 py-2 rounded-lg font-medium transition-all flex items-center gap-2 text-xs ${copiedEmbed
                  ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
              >
                {copiedEmbed ? (
                  <>
                    <CheckCircle size={14} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              Paste this code into your website to embed the carousel
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-black/40 border border-white/10 rounded-lg">
            <div>
              <p className="text-xs text-neutral-400 mb-1">Total Views</p>
              <p className="text-2xl font-bold text-white">{(carousel as any).views || 0}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-400 mb-1">Status</p>
              <p className="text-sm font-medium text-white">
                {carousel.isPublic ? (
                  <span className="text-green-400">Public</span>
                ) : (
                  <span className="text-yellow-400">Private</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-white/10 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;