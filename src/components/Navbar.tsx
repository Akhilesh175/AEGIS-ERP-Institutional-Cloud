import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { Notification } from '../types';
import { Bell, MessageSquare, Sun, Moon, LogOut, ChevronDown, User as UserIcon, Shield } from 'lucide-react';
import { ChatDrawer } from './ChatDrawer';

export const Navbar: React.FC = () => {
  const { session, theme, toggleTheme, setSession } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifyDrop, setShowNotifyDrop] = useState(false);
  const [showProfileDrop, setShowProfileDrop] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const loadNotifications = async () => {
    if (!session) return;
    try {
      const data = await mockApi.getNotifications(session.user.id);
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 8000); // Poll notifications
    return () => clearInterval(interval);
  }, [session]);

  const handleNotificationClick = async (id: string) => {
    try {
      await mockApi.markNotificationRead(id);
      loadNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await mockApi.logout();
      setSession(null);
    } catch (err) {
      console.error(err);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!session) return null;

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass dark:glass-dark border-b border-slate-800 bg-[#070a13]/85 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        {/* Branding Title */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Shield className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-slate-100 font-sans text-lg flex items-center gap-1.5">
              AEGIS <span className="text-brand-500 text-glow-brand font-medium">ERP</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold font-mono">Institutional Cloud</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-4">
          
          {/* Theme Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-xl transition-all duration-200"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>

          {/* Chat Messenger Trigger */}
          <button 
            onClick={() => setIsChatOpen(true)}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-xl transition-all duration-200 relative"
            title="Secure Chats"
          >
            <MessageSquare size={19} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500 animate-pulse-subtle" />
          </button>

          {/* Notification Bell */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowNotifyDrop(!showNotifyDrop);
                setShowProfileDrop(false);
              }}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-xl transition-all duration-200 relative"
              title="Notifications"
            >
              <Bell size={19} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifyDrop && (
              <div className="absolute right-0 mt-3 w-80 rounded-2xl glass-dark border border-slate-800 shadow-2xl p-4 animate-slide-up z-50">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                  <h4 className="font-semibold text-sm text-slate-200">Alert Center</h4>
                  <span className="text-[10px] text-brand-500 font-bold uppercase">{unreadCount} New</span>
                </div>
                
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs">No active alerts found.</div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id}
                        onClick={() => handleNotificationClick(n.id)}
                        className={`p-2.5 rounded-xl text-xs transition-all border border-transparent cursor-pointer ${
                          n.isRead 
                            ? 'bg-slate-900/10 text-slate-400 hover:bg-slate-900/30' 
                            : 'bg-brand-500/5 hover:bg-brand-500/10 border-brand-500/20 text-slate-200 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold truncate">{n.title}</span>
                          <span className="text-[9px] text-slate-500">{new Date(n.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="line-clamp-2 leading-relaxed opacity-95">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Block */}
          <div className="relative">
            <button 
              onClick={() => {
                setShowProfileDrop(!showProfileDrop);
                setShowNotifyDrop(false);
              }}
              className="flex items-center gap-2 hover:bg-slate-800/40 p-1.5 pr-2 rounded-xl transition-all duration-200"
            >
              <img 
                src={session.user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                alt="" 
                className="w-8 h-8 rounded-lg object-cover border border-slate-700 shadow-md"
              />
              <div className="text-left hidden md:block">
                <p className="text-xs font-semibold text-slate-200 leading-none">{session.user.firstName}</p>
                <span className="text-[9px] font-bold text-brand-500 tracking-wide font-mono uppercase">{session.user.role}</span>
              </div>
              <ChevronDown size={14} className="text-slate-400" />
            </button>

            {/* Profile Dropdown */}
            {showProfileDrop && (
              <div className="absolute right-0 mt-3 w-56 rounded-2xl glass-dark border border-slate-800 shadow-2xl p-3 animate-slide-up z-50">
                <div className="p-2 border-b border-slate-850 mb-2">
                  <p className="text-xs font-bold text-slate-100">{session.user.firstName} {session.user.lastName}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{session.user.email}</p>
                </div>
                <div className="space-y-1">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 text-left text-xs text-red-400 hover:text-red-300 hover:bg-red-500/5 p-2 rounded-xl transition-all duration-200"
                  >
                    <LogOut size={14} />
                    <span>Secure Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Slideout communicator drawer */}
      <ChatDrawer isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  );
};
