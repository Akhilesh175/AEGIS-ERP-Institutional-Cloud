import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { ChatMessage, User } from '../types';
import { MessageSquare, Send, X, ArrowLeft, Users, Clock } from 'lucide-react';
import { GlassCard } from './GlassCard';
import PremiumLock from './PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';
import { supabase } from '../lib/supabase';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type ContactWithMeta = User & { lastMessage?: string; unreadCount: number };

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose }) => {
  const { session, syncSubscriptionPlan } = useStore();
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

  // inbox = users with existing messages (sorted by recency)
  const [inbox, setInbox] = useState<ContactWithMeta[]>([]);
  // allAllowedContacts = every user this user can message
  const [allAllowedContacts, setAllAllowedContacts] = useState<User[]>([]);
  const [activeContact, setActiveContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'recent' | 'all'>('all');

  // ── Data loaders ───────────────────────────────────────────────────────────

  const loadInbox = async () => {
    if (!session) return;
    try {
      await mockApi.syncChatMessagesData(session.user.id);
      const data = await mockApi.getChatInbox(session.user.id);
      setInbox(data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAllAllowedContacts = async () => {
    if (!session) return;
    setContactsLoading(true);
    try {
      const data = await mockApi.getAllowedContacts(session.user.id);
      setAllAllowedContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setContactsLoading(false);
    }
  };

  const loadMessages = async (contactId: string) => {
    if (!session) return;
    try {
      const data = await mockApi.getChatHistory(session.user.id, contactId);
      setMessages(data);
      loadInbox();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      syncSubscriptionPlan();
      loadInbox();
      loadAllAllowedContacts();
    }
  }, [isOpen, session]);

  // Realtime subscription
  useEffect(() => {
    if (!session || !isOpen) return;
    const channel = supabase
      .channel(`chat-messages-realtime-${session.user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'communication_messages'
      }, async (payload) => {
        await mockApi.syncChatMessagesData(session.user.id);
        loadInbox();
        if (activeContact) loadMessages(activeContact.id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session, isOpen, activeContact]);

  // Polling when chat is open
  useEffect(() => {
    if (activeContact) {
      loadMessages(activeContact.id);
      const timer = setInterval(() => loadMessages(activeContact.id), 5000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [activeContact]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Derived lists ──────────────────────────────────────────────────────────

  /**
   * Merge allAllowedContacts with inbox data (lastMessage, unreadCount).
   * This way the full list is NEVER empty just because no messages exist yet.
   */
  const mergedAllContacts: ContactWithMeta[] = allAllowedContacts.map(c => {
    const inboxEntry = inbox.find(x => x.id === c.id);
    return {
      ...c,
      lastMessage: inboxEntry?.lastMessage,
      unreadCount: inboxEntry?.unreadCount || 0
    };
  });

  // Contacts with existing messages sorted by most recent
  const recentContacts: ContactWithMeta[] = inbox.length > 0
    ? inbox
    : []; // pure inbox, already sorted by recency from server

  // Search filter — applies to whichever tab is active
  const applySearch = (list: ContactWithMeta[]): ContactWithMeta[] => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter(c => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const email = (c.email || '').toLowerCase();
      if (fullName.includes(query) || email.includes(query) || c.role.toLowerCase().includes(query)) {
        return true;
      }
      if (c.role === 'STUDENT') {
        const student = mockDb.students.find(s => s.userId === c.id);
        if (student) {
          if (student.id.toLowerCase().includes(query)) return true;
          if ((student.admissionNumber || '').toLowerCase().includes(query)) return true;
        }
      }
      if (c.role === 'TEACHER') {
        const teacher = mockDb.teachers.find(t => t.userId === c.id);
        if (teacher && (teacher.employeeId || '').toLowerCase().includes(query)) return true;
      }
      if (c.role === 'WARDEN') {
        const warden = mockDb.hostelWardens.find(w => w.userId === c.id);
        if (warden && (warden.employeeId || '').toLowerCase().includes(query)) return true;
      }
      if (c.employeeId && c.employeeId.toLowerCase().includes(query)) return true;
      return false;
    });
  };

  const displayList = applySearch(activeTab === 'recent' ? recentContacts : mergedAllContacts);

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !activeContact || !typedMessage.trim()) return;
    const originalMsg = typedMessage;
    setTypedMessage('');
    try {
      const newMsg = await mockApi.sendChatMessage(session.user.id, activeContact.id, originalMsg);
      setMessages(prev => [...prev, newMsg]);
      loadInbox();
    } catch (err: any) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Background closer */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-md h-full bg-[#0b0f19] border-l border-slate-800 shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            {activeContact ? (
              <button
                onClick={() => { setActiveContact(null); setMessages([]); }}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <MessageSquare className="text-brand-500" size={24} />
            )}
            <div>
              <h3 className="font-semibold text-slate-100">
                {activeContact ? `${activeContact.firstName} ${activeContact.lastName}` : 'Aegis Communicator'}
              </h3>
              <p className="text-xs text-slate-400">
                {activeContact
                  ? activeContact.role
                  : `${mergedAllContacts.length} contact${mergedAllContacts.length !== 1 ? 's' : ''} available`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messaging Container */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          <PremiumLock
            isLocked={currentPlanName !== 'enterprise'}
            requiredTier="Enterprise"
            featureName="Direct Messaging"
            customMessage="Direct Messaging Channels are available only under the Enterprise Subscription."
          >
            {!activeContact ? (
              <div className="flex flex-col flex-1 p-4 gap-3">

                {/* Search Bar */}
                <input
                  type="text"
                  placeholder="Search by name, email, ID, admission no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />

                {/* Tabs */}
                <div className="flex gap-1 bg-slate-900/50 rounded-xl p-1 border border-slate-800">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'all'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Users size={12} />
                    All Contacts
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                      activeTab === 'all' ? 'bg-white/20' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {mergedAllContacts.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('recent')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === 'recent'
                        ? 'bg-brand-600 text-white shadow'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Clock size={12} />
                    Recent
                    {recentContacts.filter(c => c.unreadCount > 0).length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center animate-pulse">
                        {recentContacts.filter(c => c.unreadCount > 0).length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Contact List */}
                <div className="flex-1 overflow-y-auto space-y-1.5">
                  {contactsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Loading contacts...</span>
                    </div>
                  ) : displayList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                      {activeTab === 'recent' ? (
                        <>
                          <Clock size={32} className="text-slate-700" />
                          <div className="text-center">
                            <p className="text-sm font-semibold text-slate-400">No recent conversations</p>
                            <p className="text-xs mt-1">Switch to <button onClick={() => setActiveTab('all')} className="text-brand-400 underline">All Contacts</button> to start a new chat.</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <Users size={32} className="text-slate-700" />
                          <div className="text-center">
                            <p className="text-sm font-semibold text-slate-400">
                              {searchQuery.trim() ? 'No matching contacts' : 'No contacts available'}
                            </p>
                            <p className="text-xs mt-1 text-slate-600">
                              {searchQuery.trim() ? 'Try a different name, email, or ID.' : 'Contacts appear here based on your role and class assignments.'}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    displayList.map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveContact(c);
                          setSearchQuery('');
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/40 hover:border-brand-500/30 bg-slate-900/20 hover:bg-slate-900/50 cursor-pointer active:scale-[0.99] transition-all duration-200 group"
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={c.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover border border-slate-800 group-hover:border-brand-500/40 transition-colors"
                          />
                          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0b0f19] ${
                            c.isActive ? 'bg-emerald-500' : 'bg-slate-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-semibold text-slate-200 text-sm truncate group-hover:text-white transition-colors">
                              {c.firstName} {c.lastName}
                            </h4>
                            <span className={`text-[9px] uppercase font-bold tracking-wider flex-shrink-0 px-1.5 py-0.5 rounded-full ${
                              c.role === 'TEACHER' ? 'bg-blue-500/15 text-blue-400' :
                              c.role === 'ADMIN' ? 'bg-purple-500/15 text-purple-400' :
                              c.role === 'STUDENT' ? 'bg-green-500/15 text-green-400' :
                              c.role === 'PARENT' ? 'bg-amber-500/15 text-amber-400' :
                              'bg-slate-800 text-slate-500'
                            }`}>
                              {c.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {c.lastMessage
                              ? <span className="text-slate-400">{c.lastMessage}</span>
                              : <span className="italic text-slate-600">Start a new conversation...</span>
                            }
                          </p>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse flex-shrink-0">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* ── Conversation View ── */
              <div className="flex flex-col h-full p-4">
                <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
                      <MessageSquare size={32} className="text-slate-700" />
                      <div className="text-center">
                        <p className="text-xs font-semibold text-slate-400">Start your secure conversation</p>
                        <p className="text-[10px] mt-1 text-slate-600">All messages are end-to-end encrypted.</p>
                      </div>
                    </div>
                  ) : (
                    messages.map(m => {
                      const isMe = m.senderId === session?.user.id;
                      return (
                        <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                            isMe
                              ? 'bg-brand-600 text-white rounded-tr-none'
                              : 'bg-slate-800 text-slate-100 rounded-tl-none'
                          }`}>
                            <p>{m.message}</p>
                            <span className="block text-[9px] text-right mt-1 opacity-60">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input */}
                <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800 flex gap-2 flex-shrink-0">
                  <input
                    type="text"
                    placeholder="Secure message..."
                    value={typedMessage}
                    onChange={(e) => setTypedMessage(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                  <button
                    type="submit"
                    className="bg-brand-600 hover:bg-brand-500 text-white p-2.5 rounded-xl transition-colors active:scale-95 disabled:opacity-50"
                    disabled={!typedMessage.trim()}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            )}
          </PremiumLock>
        </div>
      </div>
    </div>
  );
};
