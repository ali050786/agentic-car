/**
 * User Menu Component
 * 
 * Dropdown menu showing user info and actions.
 * Displays in header when user is logged in.
 * 
 * Location: src/components/UserMenu.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { getUserCarousels } from '../services/carouselService';
import { getUserInitials, getDisplayName } from '../utils/authUtils';
import {
  User,
  LogOut,
  ChevronDown,
  Settings,
  HelpCircle
} from 'lucide-react';

export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [carouselCount, setCarouselCount] = useState<number>(0);
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

  // Fetch carousel count
  useEffect(() => {
    const fetchCarouselCount = async () => {
      if (user?.$id) {
        const { data } = await getUserCarousels(user.$id);
        if (data) {
          setCarouselCount(data.length);
        }
      }
    };

    if (isOpen) {
      fetchCarouselCount();
    }
  }, [user, isOpen]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
    setIsOpen(false);
  };

  if (!user) return null;

  const displayName = getDisplayName(profile?.full_name || null, user.email || '');
  const initials = getUserInitials(profile?.full_name || user.email || '');
  const avatarUrl = profile?.avatar_url;

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-medium overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>

        {/* User Info (desktop only) */}
        <div className="hidden md:block text-left">
          <div className="text-sm font-medium text-white">{displayName}</div>
          <div className="text-xs text-neutral-400">{user.email}</div>
        </div>

        <ChevronDown
          size={16}
          className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {/* User Info Header */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-medium overflow-hidden flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white truncate">{displayName}</div>
                <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                <div className={`text-xs mt-1 font-medium ${carouselCount >= 5 ? 'text-red-400' : 'text-neutral-500'
                  }`}>
                  Usage: {carouselCount}/5 carousels
                </div>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={() => {
                navigate('/profile');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <User size={16} />
              Profile Settings
            </button>

            <button
              onClick={() => {
                navigate('/help');
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left text-sm text-neutral-300 hover:bg-white/5 flex items-center gap-3 transition-colors"
            >
              <HelpCircle size={16} />
              Help & Support
            </button>
          </div>

          {/* Sign Out */}
          <div className="border-t border-white/10 py-2">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;