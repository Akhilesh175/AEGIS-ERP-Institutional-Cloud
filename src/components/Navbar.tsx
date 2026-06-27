import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import type { Notification } from '../types';
import { Bell, MessageSquare, Sun, Moon, LogOut, ChevronDown, Camera, Upload, Trash2, X, Check, Menu, Settings, Key, Lock, Eye, EyeOff, Layers, ArrowLeft } from 'lucide-react';
import { ChatDrawer } from './ChatDrawer';
import { BrandLogo } from './common/BrandLogo';

interface NavbarProps {
  activeTab?: string;
  onBack?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab = 'dashboard', onBack }) => {
  const { session, theme, toggleTheme, setSession, isMobileMenuOpen, setMobileMenuOpen, warningLevel, daysRemaining } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifyDrop, setShowNotifyDrop] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [prefPush, setPrefPush] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  const [prefEmail, setPrefEmail] = useState(true);
  const [prefSMS, setPrefSMS] = useState(false);
  const [showProfileDrop, setShowProfileDrop] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);
  const notifyButtonRef = useRef<HTMLButtonElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 5242880) {
        alert('File size exceeds the 5MB limit.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadPhoto = async () => {
    if (!session || !selectedFile) return;
    setUploading(true);
    try {
      const publicUrl = await mockApi.uploadProfileImage(session.user.id, selectedFile);
      const updatedSession = {
        ...session,
        user: {
          ...session.user,
          avatarUrl: publicUrl
        }
      };
      setSession(updatedSession);
      localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
      setIsPhotoModalOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      alert('Profile photo updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!session) return;
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    setUploading(true);
    try {
      await mockApi.removeProfileImage(session.user.id);
      const updatedSession = {
        ...session,
        user: {
          ...session.user,
          avatarUrl: ''
        }
      };
      setSession(updatedSession);
      localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
      setIsPhotoModalOpen(false);
      setSelectedFile(null);
      setPreviewUrl(null);
      alert('Profile photo removed.');
    } catch (err: any) {
      alert(err.message || 'Failed to remove profile photo.');
    } finally {
      setUploading(false);
    }
  };

  const loadNotifications = async () => {
    if (!session) return;
    try {
      const data = await mockApi.getNotifications(session.user.id);
      setNotifications(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadNotificationsDebounced = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
    }
    loadTimeoutRef.current = setTimeout(() => {
      loadNotifications();
    }, 150);
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    loadNotifications();
    
    // Subscribe to real-time notification changes (wildcard: INSERT, UPDATE, DELETE)
    const channel = supabase
      .channel(`user-notifications-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          console.log('Realtime notification event:', payload.eventType, payload);
          loadNotificationsDebounced();
          
          if (payload.eventType === 'INSERT' && Notification.permission === 'granted' && document.hidden) {
            new Notification(payload.new.title, {
              body: payload.new.content,
              icon: '/aegis-logo.png'
            });
          }
        }
      )
      .subscribe();

    const interval = setInterval(loadNotifications, 12000); // Fallback poll
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [session]);

  // Outside Click / Touch handler for both dropdowns
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      // Profile Dropdown
      if (
        showProfileDrop &&
        profileRef.current &&
        !profileRef.current.contains(e.target as Node)
      ) {
        setShowProfileDrop(false);
      }
      // Notification Dropdown
      if (
        showNotifyDrop &&
        notifyRef.current &&
        !notifyRef.current.contains(e.target as Node)
      ) {
        setShowNotifyDrop(false);
      }
    };

    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showProfileDrop, showNotifyDrop]);

  // Profile dropdown accessibility (Issue 6)
  useEffect(() => {
    if (!showProfileDrop) {
      // Restore focus to button when closed, if we were focused inside or just closed it
      if (document.activeElement && profileRef.current?.contains(document.activeElement)) {
        profileButtonRef.current?.focus();
      }
      return;
    }

    // Focus the first focusable element inside profile dropdown when opened
    const focusable = profileRef.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
      'button:not([disabled]), a:not([disabled])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowProfileDrop(false);
        profileButtonRef.current?.focus();
      } else if (e.key === 'Tab') {
        const elements = profileRef.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>(
          'button:not([disabled]), a:not([disabled])'
        );
        if (!elements || elements.length === 0) return;
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showProfileDrop]);

  // Notification dropdown accessibility (Issue 7)
  useEffect(() => {
    if (!showNotifyDrop) {
      if (document.activeElement && notifyRef.current?.contains(document.activeElement)) {
        notifyButtonRef.current?.focus();
      }
      return;
    }

    // Focus the first focusable element inside notification dropdown when opened
    const focusable = notifyRef.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement | HTMLInputElement>(
      'button:not([disabled]), a:not([disabled]), input:not([disabled])'
    );
    if (focusable && focusable.length > 0) {
      focusable[0].focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifyDrop(false);
        notifyButtonRef.current?.focus();
      } else if (e.key === 'Tab') {
        const elements = notifyRef.current?.querySelectorAll<HTMLButtonElement | HTMLAnchorElement | HTMLInputElement>(
          'button:not([disabled]), a:not([disabled]), input:not([disabled])'
        );
        if (!elements || elements.length === 0) return;
        const first = elements[0];
        const last = elements[elements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNotifyDrop]);

  const handlePushToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setPrefPush(checked);
    if (checked && session) {
      try {
        const { requestNotificationPermission } = await import('../lib/firebase');
        const token = await requestNotificationPermission(session.user.id, session.user.role);
        if (token) {
          alert('Browser Push Notifications configured successfully!');
        } else {
          alert('Failed to configure Push Notifications. Please verify browser permissions.');
          setPrefPush(false);
        }
      } catch (err) {
        console.error('Failed to register notifications:', err);
        setPrefPush(false);
      }
    }
  };

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
      window.location.hash = '';
      window.location.reload();
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('Current password is required.');
      return;
    }
    if (!newPassword) {
      setErrorMessage('New password is required.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword === currentPassword) {
      setErrorMessage('New password cannot be the same as your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('New password confirmation does not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await mockApi.changePassword(currentPassword, newPassword);
      setSuccessMessage(response.message || 'Password changed successfully!');
      
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (!session) return null;

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass dark:glass-dark border-b border-slate-800 bg-[#070a13]/85 backdrop-blur-md px-6 py-3 flex items-center justify-between">
        {/* Branding Title — AEGIS ERP Official Logo */}
        <div className="flex items-center gap-3">
          {(() => {
            const isDashboard = session?.user?.role === 'COACH'
              ? (activeTab === 'sports' || activeTab === 'sports/dashboard')
              : (activeTab === 'dashboard');

            if (isDashboard) {
              return (
                <button
                  onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
                  className="flex items-center justify-center w-9 h-9 text-slate-350 hover:text-white hover:bg-slate-800/60 active:bg-slate-700/60 border border-slate-800 hover:border-slate-700 rounded-lg transition-all duration-200 shadow-md"
                  title="Toggle Menu"
                  id="header-menu-button"
                >
                  <Menu size={18} />
                </button>
              );
            } else {
              return (
                <button
                  onClick={onBack}
                  className="flex items-center justify-center w-9 h-9 text-slate-350 hover:text-white hover:bg-slate-800/60 active:bg-slate-700/60 border border-slate-800 hover:border-slate-700 rounded-lg transition-all duration-200 shadow-md"
                  title="Go Back"
                  id="header-back-button"
                >
                  <ArrowLeft size={18} />
                </button>
              );
            }
          })()}

          <BrandLogo variant="horizontal" size="sm" showTagline={true} />
        </div>

        {/* Expiry Warning Banner (Center of Navbar) */}
        {session?.user?.role === 'ADMIN' && warningLevel && (() => {
          let text = '';
          let bgStyle = '';
          let textStyle = '';
          let borderStyle = '';
          let icon = '';

          if (warningLevel === 'expired') {
            text = 'Your subscription has expired. Premium features are now locked. Renew your subscription to restore access.';
            bgStyle = 'bg-red-500/10';
            textStyle = 'text-red-400';
            borderStyle = 'border-red-500/30';
            icon = '🚨';
          } else if (warningLevel === 'today') {
            text = 'Your subscription expires today. Please renew immediately.';
            bgStyle = 'bg-red-500/10';
            textStyle = 'text-red-400';
            borderStyle = 'border-red-500/30';
            icon = '🚨';
          } else if (warningLevel === 'warning_1') {
            text = 'Your subscription expires tomorrow. Renew now to avoid service interruption.';
            bgStyle = 'bg-orange-500/10';
            textStyle = 'text-orange-400';
            borderStyle = 'border-orange-500/30';
            icon = '⚠️';
          } else if (warningLevel === 'warning_2') {
            text = 'Your subscription expires in 2 days. Please renew your plan.';
            bgStyle = 'bg-yellow-500/10';
            textStyle = 'text-yellow-450';
            borderStyle = 'border-yellow-500/30';
            icon = '⚠️';
          } else if (warningLevel === 'warning_3') {
            text = 'Your subscription will expire in 3 days. Renew now to avoid losing access to Premium features.';
            bgStyle = 'bg-yellow-500/8';
            textStyle = 'text-yellow-450';
            borderStyle = 'border-yellow-500/25';
            icon = '⚠️';
          }

          if (!text) return null;

          return (
            <div className={`hidden lg:flex items-center gap-3 px-4 py-1.5 rounded-full border text-xs font-semibold animate-pulse ${bgStyle} ${borderStyle} ${textStyle}`}>
              <span>{icon}</span>
              <span>{text}</span>
              <button
                onClick={() => {
                  const evt = new CustomEvent('aegis:set-tab', { detail: 'subscriptions' });
                  window.dispatchEvent(evt);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-white transition-all shadow-sm ${
                  warningLevel === 'expired' || warningLevel === 'today'
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-amber-600 hover:bg-amber-500'
                }`}
              >
                Renew Now
              </button>
            </div>
          );
        })()}

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
          <div ref={notifyRef} className="relative">
            <button 
              ref={notifyButtonRef}
              onClick={async () => {
                const isOpening = !showNotifyDrop;
                setShowNotifyDrop(isOpening);
                setShowProfileDrop(false);
                if (isOpening && session?.user?.id) {
                  try {
                    await mockApi.markAllNotificationsRead(session.user.id);
                    await loadNotifications();
                  } catch (err) {
                    console.error('Failed to mark notifications read:', err);
                  }
                }
              }}
              aria-haspopup="true"
              aria-expanded={showNotifyDrop}
              aria-label="Notifications panel"
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
              <div 
                role="region"
                aria-label="Notifications list"
                className="absolute right-0 mt-3 w-80 rounded-2xl glass-dark border border-slate-800 shadow-2xl p-4 animate-slide-up z-50"
              >
                <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-sm text-slate-200">Alert Center</h4>
                    <button 
                      onClick={() => setShowPreferences(!showPreferences)}
                      className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
                      title="Notification Settings"
                    >
                      <Settings size={13} className={showPreferences ? 'text-brand-400 rotate-45 transition-transform' : ''} />
                    </button>
                  </div>
                  <span className="text-[10px] text-brand-500 font-bold uppercase">
                    {showPreferences ? 'Settings' : `${unreadCount} New`}
                  </span>
                </div>
                
                {showPreferences ? (
                  <div className="space-y-4 py-2 animate-fade-in">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none font-bold">Preferences</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-2.5 bg-slate-900/35 border border-slate-850 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">Browser Push Alerts</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Show desktop & PWA notification toasts</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={prefPush} 
                          onChange={handlePushToggle}
                          className="w-4 h-4 rounded text-brand-600 bg-slate-950 border-slate-800 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-900/35 border border-slate-850 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">SMTP Email Alerts</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Receive reminders in your secure inbox</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={prefEmail} 
                          onChange={(e) => setPrefEmail(e.target.checked)}
                          className="w-4 h-4 rounded text-brand-600 bg-slate-950 border-slate-800 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-slate-900/35 border border-slate-850 rounded-xl">
                        <div>
                          <p className="text-xs font-semibold text-slate-200">Twilio SMS Alerts</p>
                          <p className="text-[9px] text-slate-500 mt-0.5">Send high-priority reminders to mobile</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={prefSMS} 
                          onChange={(e) => setPrefSMS(e.target.checked)}
                          className="w-4 h-4 rounded text-brand-600 bg-slate-950 border-slate-800 focus:ring-brand-500 cursor-pointer"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setShowPreferences(false);
                        alert('Notification preferences updated successfully!');
                      }}
                      className="w-full glass-btn-primary py-2 text-xs font-bold rounded-xl"
                    >
                      Save Configuration
                    </button>
                  </div>
                ) : (
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
                )}
              </div>
            )}
          </div>

          {/* User Profile Block */}
          <div ref={profileRef} className="relative">
            <button 
              ref={profileButtonRef}
              onClick={() => {
                setShowProfileDrop(!showProfileDrop);
                setShowNotifyDrop(false);
              }}
              aria-haspopup="menu"
              aria-expanded={showProfileDrop}
              aria-label="Profile menu"
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
              <div 
                role="menu"
                aria-label="Profile actions"
                className="absolute right-0 mt-3 w-56 rounded-2xl glass-dark border border-slate-800 shadow-2xl p-3 animate-slide-up z-50"
              >
                <div className="p-2 border-b border-slate-850 mb-2">
                  <p className="text-xs font-bold text-slate-100">{session.user.firstName} {session.user.lastName}</p>
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">{session.user.email}</p>
                </div>
                <div className="space-y-1">
                  <button 
                    onClick={() => {
                      setShowProfileDrop(false);
                      setIsPhotoModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2 text-left text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 p-2 rounded-xl transition-all duration-200"
                  >
                    <Camera size={14} className="text-brand-400" />
                    <span>Update Profile Photo</span>
                  </button>
                  <button 
                    onClick={() => {
                      setShowProfileDrop(false);
                      setIsChangePasswordOpen(true);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="w-full flex items-center gap-2 text-left text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 p-2 rounded-xl transition-all duration-200"
                  >
                    <Key size={14} className="text-brand-400" />
                    <span>Change Password</span>
                  </button>
                  {session.user.roles && session.user.roles.length > 1 && (
                    <button 
                      onClick={() => {
                        setShowProfileDrop(false);
                        const updatedUser = {
                          ...session.user,
                          activeRoleSelected: false
                        };
                        const updatedSession = { ...session, user: updatedUser };
                        setSession(updatedSession);
                        localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
                      }}
                      className="w-full flex items-center gap-2 text-left text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 p-2 rounded-xl transition-all duration-200"
                    >
                      <Layers size={14} className="text-brand-400" />
                      <span>Switch Role</span>
                    </button>
                  )}
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

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 to-[#070a13] border border-slate-800 shadow-2xl p-6 md:p-8 animate-fade-in relative">
            {/* Close Button */}
            <button 
              onClick={() => {
                setIsChangePasswordOpen(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-full transition-all"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
                <Lock className="text-brand-400" size={20} />
                Change Password
              </h3>
              <p className="text-xs text-slate-400 mt-1">Update your security credentials for Aegis ERP</p>
            </div>

            {/* Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              
              {errorMessage && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium text-center">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-medium text-center">
                  {successMessage}
                </div>
              )}

              {/* Current Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full bg-[#0c101f] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all outline-none"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 transition-colors"
                  >
                    {showCurrentPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min. 8 chars)"
                    className="w-full bg-[#0c101f] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all outline-none"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 transition-colors"
                  >
                    {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className="w-full bg-[#0c101f] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all outline-none"
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 transition-colors"
                  >
                    {showConfirmPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-slate-850 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 glass-btn-primary text-xs flex items-center justify-center gap-2 font-bold py-2.5 rounded-xl disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-350 border-t-brand-500 rounded-full animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangePasswordOpen(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-slate-100 font-semibold rounded-xl text-xs transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Profile Photo Modal */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-gradient-to-b from-slate-900 to-[#070a13] border border-slate-800 shadow-2xl p-6 md:p-8 animate-fade-in relative">
            {/* Close Button */}
            <button 
              onClick={() => {
                setIsPhotoModalOpen(false);
                setSelectedFile(null);
                setPreviewUrl(null);
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-full transition-all"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-slate-100 flex items-center justify-center gap-2">
                <Camera className="text-brand-400" size={20} />
                Update Profile Photo
              </h3>
              <p className="text-xs text-slate-400 mt-1">Enhance your digital identity across portals</p>
            </div>

            {/* Avatar Display & Ring */}
            <div className="flex flex-col items-center justify-center mb-8">
              <div className="relative group">
                {/* Glowing Ring */}
                <div className="absolute inset-0 -m-1 rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 blur-sm opacity-75" />
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-slate-800 bg-[#0c101f] flex items-center justify-center">
                  <img 
                    src={previewUrl || session.user.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Selection & Form Actions */}
            <div className="space-y-4">
              <div className="flex justify-center gap-3">
                <label className="glass-btn-primary text-xs flex items-center gap-2 cursor-pointer transition-all">
                  <Upload size={14} />
                  <span>Choose Photo</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden" 
                  />
                </label>

                {session.user.avatarUrl && !session.user.avatarUrl.includes('unsplash.com') && (
                  <button 
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Remove
                  </button>
                )}
              </div>

              <div className="text-[10px] text-slate-500 text-center uppercase tracking-wider font-mono">
                Formats: PNG, JPG, WEBP, GIF (Max 5MB)
              </div>

              {selectedFile && (
                <div className="pt-4 border-t border-slate-850 flex gap-3">
                  <button
                    onClick={handleUploadPhoto}
                    disabled={uploading}
                    className="flex-1 glass-btn-primary text-xs flex items-center justify-center gap-2 font-bold"
                  >
                    {uploading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-slate-350 border-t-brand-500 rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                    }}
                    disabled={uploading}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-slate-100 font-semibold rounded-xl text-xs transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
