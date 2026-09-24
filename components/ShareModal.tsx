/**
 * Share Modal — public link + embed code for a carousel.
 *
 * Location: src/components/ShareModal.tsx
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Carousel } from '../services/carouselService';
import { Link as LinkIcon, Code, Copy, ExternalLink, Eye, Globe, Lock } from 'lucide-react';
import { CloseButton, DrawCheck, Modal, SPRING } from './studio/ui';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  carousel: Carousel;
}

const CopyButton: React.FC<{ copied: boolean; onClick: () => void; compact?: boolean }> = ({ copied, onClick, compact }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.94 }}
    onClick={onClick}
    className={`shrink-0 flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-colors ${compact ? 'h-8 px-3 text-[12px]' : 'h-10 px-4 text-[13px]'} ${copied ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/40' : 'bg-white text-black hover:bg-white/90'}`}
  >
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={copied ? 'y' : 'n'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="flex items-center gap-1.5">
        {copied ? <><DrawCheck size={14} color="#6ee7b7" /> Copied</> : <><Copy size={13} /> Copy</>}
      </motion.span>
    </AnimatePresence>
  </motion.button>
);

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, carousel }) => {
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

  return (
    <Modal open={isOpen} onClose={onClose} className="max-w-lg" labelledBy="share-title">
      <div className="flex items-start justify-between gap-4 p-6 pb-4">
        <div className="min-w-0">
          <div className="lp-mono text-[10.5px] uppercase tracking-[0.16em] text-white/40">Share</div>
          <h2 id="share-title" className="lp-display mt-1.5 text-[22px] font-semibold text-white truncate">{carousel.title || 'Untitled carousel'}</h2>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      <div className="px-6 pb-6 space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-3 rounded-2xl p-3.5 border ${carousel.isPublic ? 'border-emerald-300/20 bg-emerald-300/[0.05]' : 'border-amber-300/25 bg-amber-300/[0.06]'}`}
        >
          <span className={`grid place-items-center w-9 h-9 rounded-xl ${carousel.isPublic ? 'bg-emerald-300/15 text-emerald-200' : 'bg-amber-300/15 text-amber-200'}`}>
            {carousel.isPublic ? <Globe size={16} /> : <Lock size={16} />}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-white">{carousel.isPublic ? 'Public' : 'Private'}</div>
            <div className="text-[12px] text-white/50">{carousel.isPublic ? 'Anyone with the link can view it' : 'Make it public to share the link'}</div>
          </div>
          <div className="flex items-center gap-1.5 text-[12px] text-white/60 shrink-0">
            <Eye size={13} /> <span className="tabular-nums">{(carousel as any).views || 0}</span>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-2 text-[12px] font-medium text-white/60 mb-2"><LinkIcon size={13} /> Link</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 h-10 rounded-xl bg-black/35 border border-white/10 px-3.5 text-[13px] text-white/85 lp-mono outline-none focus:border-violet-400/50"
            />
            <CopyButton copied={copiedLink} onClick={() => copyToClipboard(shareUrl, 'link')} />
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => window.open(shareUrl, '_blank')}
              aria-label="Open in new tab"
              className="shrink-0 grid place-items-center w-10 h-10 rounded-xl border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ExternalLink size={15} />
            </motion.button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-[12px] font-medium text-white/60"><Code size={13} /> Embed</div>
            <CopyButton compact copied={copiedEmbed} onClick={() => copyToClipboard(embedCode, 'embed')} />
          </div>
          <pre className="rounded-xl bg-black/40 border border-white/10 p-3.5 text-[11.5px] leading-relaxed text-cyan-100/80 lp-mono whitespace-pre-wrap break-all">{embedCode}</pre>
        </motion.div>
      </div>
    </Modal>
  );
};

export default ShareModal;
