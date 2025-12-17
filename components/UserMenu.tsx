/**
 * User Menu Component
 * 
 * Dropdown menu showing user info, API key status, and actions.
 * Displays in header when user is logged in.
 */

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, Library as LibraryIcon, Key, Zap, ChevronDown } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

interface UserMenuProps {
  onOpenApiKeyModal: () => void;
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenApiKeyModal }) => {
  const navigate = useNavigate();
  const { user, signOut, userApiKey, freeUsageCount } = useAuthStore();
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
    <div className="relative" ref={menuRef}>
      {/* Menu Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="User Menu"
        aria-label="User Menu"
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
          {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
        </div>
        <ChevronDown
          size={16}
          className={`text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* User Info */}
          <div className="p-4 border-b border-white/10">
            <p className="text-sm font-medium text-white truncate">
              {user?.name || 'User'}
            </p>
            <p className="text-xs text-neutral-400 truncate mt-0.5">
              {user?.email}
            </p>
          </div>

          {/* API Key Status */}
          <div className="p-3 bg-neutral-800/50 border-b border-white/10">
            {userApiKey ? (
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-green-400" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-green-400">Premium Access</p>
                  <p className="text-[10px] text-neutral-400">Using your API key</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-400">Free Tier: {freeUsageCount}/3</p>
                  <div className="w-full bg-neutral-700 rounded-full h-1.5 mt-1">
                    <div
                      className="bg-blue-400 h-1.5 rounded-full transition-all"
                      style={{ width: `${(freeUsageCount / 3) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenApiKeyModal();
              }}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
            >
              <Key size={16} className="text-neutral-400" />
              <span>API Key Settings</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
                navigate('/library');
              }}
              className="w-full px-4 py-3 text-left text-sm text-white hover:bg-white/5 transition-colors flex items-center gap-3"
            >
              <LibraryIcon size={16} className="text-neutral-400" />
              <span>My Library</span>
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;