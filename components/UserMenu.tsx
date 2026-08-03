/**
 * User Menu Component
 * 
 * Dropdown menu showing user info, API key status, and actions.
 * Redesigned to be a premium glassmorphic popover and compact avatar trigger.
 * 
 * Location: src/components/UserMenu.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface UserMenuProps {}

export const UserMenu: React.FC<UserMenuProps> = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
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

          {/* Menu Items list */}
          <div className="py-1">

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