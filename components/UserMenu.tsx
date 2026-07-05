/**
 * User Menu Component
 * 
 * Dropdown menu showing user info, API key status, and actions.
 * Redesigned to be a premium glassmorphic popover and compact avatar trigger.
 * 
 * Location: src/components/UserMenu.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Zap, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { FREE_TIER_LIMIT } from '../config/constants';

interface UserMenuProps {}

export const UserMenu: React.FC<UserMenuProps> = () => {
  const navigate = useNavigate();
  const { user, signOut, freeUsageCount } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    setIsOpen(false);
  };

  if (!user) return null;

  return (
    <div className="relative animate-in fade-in duration-200" ref={menuRef}>
      {/* Menu Trigger Capsule */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="User Menu"
        aria-label="User Menu"
        className="flex items-center gap-1.5 p-1 pr-2 rounded-full border border-white/5 hover:border-white/15 bg-black/20 hover:bg-black/35 transition-all"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
          {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <ChevronDown
          size={13}
          className={`text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2.5 w-60 bg-neutral-950/95 border border-white/10 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] overflow-hidden z-50 py-1 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          {/* User Info Header */}
          <div className="p-3.5 border-b border-white/5">
            <p className="text-xs font-bold text-white truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-[10px] text-neutral-400 truncate mt-0.5 font-medium">
              {user?.email}
            </p>
          </div>

          {/* Usage Status Bar */}
          <div className="p-3 bg-white/[0.02] border-b border-white/5">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center text-[10px] font-bold text-blue-300">
                  <span>Usage Limit</span>
                  <span>{freeUsageCount}/{FREE_TIER_LIMIT}</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1 mt-1 overflow-hidden">
                  <div
                    className="bg-blue-400 h-full rounded-full transition-all"
                    style={{ width: `${(freeUsageCount / FREE_TIER_LIMIT) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items list */}
          <div className="py-1">

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/generate');
              }}
              className="w-full px-3.5 py-2 hover:bg-white/5 text-left text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-2.5 font-medium"
            >
              <Zap size={13} className="text-cyan-400" />
              <span>Generate Doodles</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/image-refinement');
              }}
              className="w-full px-3.5 py-2 hover:bg-white/5 text-left text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-2.5 font-medium"
            >
              <ImageIcon size={13} className="text-purple-400" />
              <span>Refine Images</span>
            </button>

            <div className="border-t border-white/5 my-1" />

            <button
              onClick={handleSignOut}
              className="w-full px-3.5 py-2 hover:bg-red-500/10 text-left text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-2.5 font-medium"
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;