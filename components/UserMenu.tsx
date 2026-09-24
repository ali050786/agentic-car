/**
 * User Menu — avatar trigger + animated account popover.
 *
 * Location: src/components/UserMenu.tsx
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Home } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { MenuItem, Popover } from './studio/ui';

interface UserMenuProps {}

export const UserMenu: React.FC<UserMenuProps> = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
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
  const initial = user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Account menu"
        aria-expanded={isOpen}
        className="relative grid place-items-center w-8 h-8 rounded-full p-[1.5px] bg-[conic-gradient(from_200deg,#3ee6f5,#4f8cff,#9b6bff,#ff7a8a,#3ee6f5)]"
      >
        <span className="grid place-items-center w-full h-full rounded-full bg-[#0f0f18] text-[12px] font-semibold text-white">{initial}</span>
      </motion.button>

      <Popover open={isOpen} className="absolute right-0 mt-2 w-64 p-1.5 z-50">
        <div className="flex items-center gap-3 px-3 py-3">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-white text-[13px] font-semibold shrink-0">{initial}</span>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-white truncate">{user?.name || 'Your account'}</p>
            <p className="text-[11.5px] text-white/45 truncate">{user?.email}</p>
          </div>
        </div>
        <div className="h-px bg-white/[0.07] mx-2 my-1" />
        <MenuItem i={0} icon={<Home size={13} className="text-white/70" />} label="Back to home" onClick={() => navigate('/')} />
        <MenuItem i={1} danger icon={<LogOut size={13} />} label="Sign out" onClick={handleSignOut} />
      </Popover>
    </div>
  );
};

export default UserMenu;
