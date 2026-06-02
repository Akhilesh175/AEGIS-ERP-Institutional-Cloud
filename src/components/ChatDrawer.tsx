import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { ChatMessage, User } from '../types';
import { MessageSquare, Send, X, ArrowLeft } from 'lucide-react';
import { GlassCard } from './GlassCard';
import PremiumLock from './PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose }) => {
  const { session } = useStore();
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

  const [contacts, setContacts] = useState<(User & { lastMessage?: string; unreadCount: number })[]>([]);
  const [activeContact, setActiveContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load Contacts
  const loadContacts = async () => {
    if (!session) return;
    try {
      await mockApi.syncChatMessagesData(session.user.id);
      const data = await mockApi.getChatInbox(session.user.id);
      setContacts(data);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Message History
  const loadMessages = async (contactId: string) => {
    if (!session) return;
    try {
      const data = await mockApi.getChatHistory(session.user.id, contactId);
      setMessages(data);
      loadContacts(); // Update read counters
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadContacts();
    }
  }, [isOpen, session]);

  useEffect(() => {
    if (activeContact) {
      loadMessages(activeContact.id);
      const timer = setInterval(() => {
        loadMessages(activeContact.id);
      }, 5000); // Polling every 5s for chat updates
      return () => clearInterval(timer);
    }
    return;
  }, [activeContact]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !activeContact || !typedMessage.trim()) return;

    const originalMsg = typedMessage;
    setTypedMessage('');

    try {
      const newMsg = await mockApi.sendChatMessage(session.user.id, activeContact.id, originalMsg);
      setMessages(prev => [...prev, newMsg]);
      loadContacts();
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Background Closer click */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-md h-full bg-[#0b0f19] border-l border-slate-800 shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            {activeContact ? (
              <button 
                onClick={() => setActiveContact(null)}
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
                {activeContact ? activeContact.role : 'Direct Messaging Channels'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Messaging Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <PremiumLock 
            isLocked={currentPlanName !== 'enterprise'} 
            requiredTier="Enterprise" 
            featureName="Direct Messaging"
          >
            {!activeContact ? (
            // Contact list
            contacts.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">No active channels found.</div>
            ) : (
              contacts.map(c => (
                <div 
                  key={c.id}
                  onClick={() => setActiveContact(c)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-800/40 hover:border-brand-500/20 bg-slate-900/20 hover:bg-slate-900/40 cursor-pointer active:scale-[0.99] transition-all duration-200"
                >
                  <img 
                    src={c.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'} 
                    alt="" 
                    className="w-11 h-11 rounded-full object-cover border border-slate-800"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-slate-200 text-sm truncate">{c.firstName} {c.lastName}</h4>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{c.role}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {c.lastMessage || 'Start a new conversation...'}
                    </p>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              ))
            )
          ) : (
            // Conversations view
            <div className="h-full flex flex-col">
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 pb-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    This is the start of your secure chat thread. All messages are encrypted.
                  </div>
                ) : (
                  messages.map(m => {
                    const isMe = m.senderId === session?.user.id;
                    return (
                      <div 
                        key={m.id}
                        className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${
                          isMe 
                            ? 'bg-brand-600 text-white rounded-tr-none' 
                            : 'bg-slate-800 text-slate-100 rounded-tl-none'
                        }`}>
                          <p>{m.message}</p>
                          <span className="block text-[9px] text-right mt-1 opacity-70">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800 flex gap-2">
                <input 
                  type="text"
                  placeholder="Secure message..."
                  value={typedMessage}
                  onChange={(e) => setTypedMessage(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
                <button 
                  type="submit"
                  className="bg-brand-600 hover:bg-brand-500 text-white p-2.5 rounded-xl transition-colors active:scale-95"
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
