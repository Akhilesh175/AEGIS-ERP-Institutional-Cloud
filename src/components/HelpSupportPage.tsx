import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { 
  Mail, Phone, MessageSquare, Instagram, Search, ChevronDown, ChevronUp, 
  Upload, X, Send, History, Sparkles, Plus, Bug, LifeBuoy, CheckCircle, 
  AlertTriangle, Activity, AlertCircle, RefreshCw, User, Shield
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { SupportTicket, BugReport, SystemStatus, KnowledgeBaseArticle } from '../types';

export const HelpSupportPage: React.FC = () => {
  const { session } = useStore();
  const schoolId = session?.user?.schoolId || 'global';
  const userId = session?.user?.id || '';
  const userRole = session?.user?.role || 'STUDENT';
  const isAdminOrSuperAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  // Navigation Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'kb' | 'new-request' | 'status' | 'history'>('kb');

  // Search & Categories for KB
  const [kbSearch, setKbSearch] = useState('');
  const [selectedKbCategory, setSelectedKbCategory] = useState<string>('All');
  const [expandedKbArticle, setExpandedKbArticle] = useState<string | null>(null);

  // States for Tickets & Bugs
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [kbArticles, setKbArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [systemStatuses, setSystemStatuses] = useState<SystemStatus[]>([]);
  
  // Loading & Operations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Support Ticket Form State
  const [ticketTitle, setTicketTitle] = useState('');
  const [ticketCategory, setTicketCategory] = useState('General');
  const [ticketPriority, setTicketPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketAttachment, setTicketAttachment] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Bug Report Form State
  const [bugTitle, setBugTitle] = useState('');
  const [bugSeverity, setBugSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [bugDesc, setBugDesc] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [bugAttachment, setBugAttachment] = useState<File | null>(null);

  // Form Mode: Ticket vs Bug
  const [requestMode, setRequestMode] = useState<'ticket' | 'bug'>('ticket');

  // Load Data
  const loadSupportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [statuses, articles, userTickets] = await Promise.all([
        mockApi.fetchSystemStatuses(),
        mockApi.fetchKnowledgeBaseArticles(),
        mockApi.fetchSupportTickets(schoolId)
      ]);

      setSystemStatuses(statuses);
      setKbArticles(articles);
      setTickets(userTickets);
    } catch (err: any) {
      setError(err.message || 'Failed to load support center data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupportData();
  }, [schoolId, userRole]);

  // Support Ticket Submit Handler
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDesc.trim()) return;

    try {
      setLoading(true);
      setError(null);
      let attachmentUrl = '';

      if (ticketAttachment) {
        setUploadingAttachment(true);
        attachmentUrl = await mockApi.uploadSupportAttachment(schoolId, ticketAttachment);
        setUploadingAttachment(false);
      }

      await mockApi.createSupportTicket(
        schoolId,
        ticketTitle.trim(),
        ticketDesc.trim(),
        ticketCategory,
        ticketPriority,
        attachmentUrl
      );

      setSuccessMessage('Support ticket created successfully!');
      setTicketTitle('');
      setTicketDesc('');
      setTicketAttachment(null);
      
      // Reload tickets list
      const userTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(userTickets);
      
      // Auto switch to history
      setTimeout(() => {
        setActiveSubTab('history');
        setSuccessMessage(null);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to create support ticket');
    } finally {
      setLoading(false);
      setUploadingAttachment(false);
    }
  };

  // Bug Report Submit Handler
  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDesc.trim()) return;

    try {
      setLoading(true);
      setError(null);
      let attachmentUrl = '';

      if (bugAttachment) {
        setUploadingAttachment(true);
        attachmentUrl = await mockApi.uploadSupportAttachment(schoolId, bugAttachment);
        setUploadingAttachment(false);
      }

      await mockApi.createBugReport(
        schoolId,
        bugTitle.trim(),
        bugDesc.trim(),
        bugSteps.trim(),
        bugSeverity,
        attachmentUrl
      );

      setSuccessMessage('Bug report submitted successfully! Thank you for helping us improve.');
      setBugTitle('');
      setBugDesc('');
      setBugSteps('');
      setBugAttachment(null);

      // Reload tickets (since bugs might be displayed in the future or tickets includes them)
      const userTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(userTickets);

      setTimeout(() => {
        setActiveSubTab('history');
        setSuccessMessage(null);
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to submit bug report');
    } finally {
      setLoading(false);
      setUploadingAttachment(false);
    }
  };

  // Admin Ticket Status Update
  const handleStatusUpdate = async (ticketId: string, nextStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED') => {
    try {
      setError(null);
      await mockApi.updateSupportTicketStatus(ticketId, nextStatus);
      
      // Optimistic cache update locally
      setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: nextStatus, updatedAt: new Date().toISOString() } : t));
    } catch (err: any) {
      setError(err.message || 'Failed to update ticket status');
    }
  };

  // KB categories
  const categories = ['All', ...new Set(kbArticles.map(art => art.category))];

  // Filtering KB Articles
  const filteredKbArticles = kbArticles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(kbSearch.toLowerCase()) || 
                          art.content.toLowerCase().includes(kbSearch.toLowerCase());
    const matchesCategory = selectedKbCategory === 'All' || art.category === selectedKbCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* 1. Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-5">
        <div>
          <div className="flex items-center gap-2 text-brand-400">
            <LifeBuoy size={18} />
            <span className="text-xs font-mono uppercase tracking-widest font-bold">Institutional Portal Support</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-100 tracking-tight mt-1">Help & Support Center</h1>
          <p className="text-xs text-slate-400 mt-1">Get quick assistance, report issues, and connect with the Aegis ERP support team.</p>
        </div>

        {/* Action tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-850 self-start md:self-auto">
          {[
            { id: 'kb', label: 'Knowledge Base', icon: Search },
            { id: 'new-request', label: 'Create Request', icon: Plus },
            { id: 'status', label: 'System Status', icon: Activity },
            { id: 'history', label: isAdminOrSuperAdmin ? 'Resolve Tickets' : 'Ticket History', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive 
                    ? 'bg-brand-600/15 text-brand-400 border border-brand-500/20 shadow-md shadow-brand-500/5' 
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon size={13} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Global Success / Error Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs rounded-xl flex items-center gap-3 animate-slide-up">
          <CheckCircle size={16} className="shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/25 text-red-400 text-xs rounded-xl flex items-center gap-3 animate-slide-up">
          <AlertCircle size={16} className="shrink-0" />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* 2. Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Dynamic views */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* VIEW: Knowledge Base */}
          {activeSubTab === 'kb' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Self-Service Documentation</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Search guides, features walkthroughs, and FAQs.</p>
                  </div>
                  
                  {/* Category switcher */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
                    {categories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedKbCategory(cat)}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all shrink-0 ${
                          selectedKbCategory === cat 
                            ? 'bg-brand-500/10 border border-brand-500/25 text-brand-400' 
                            : 'bg-slate-900/40 text-slate-400 border border-slate-850 hover:border-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Search input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search for articles, features, errors..."
                    value={kbSearch}
                    onChange={(e) => setKbSearch(e.target.value)}
                    className="w-full bg-slate-950/60 border border-slate-850 text-slate-200 rounded-xl pl-10 pr-4 py-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                  {kbSearch && (
                    <button 
                      onClick={() => setKbSearch('')}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </GlassCard>

              {/* Articles List */}
              <div className="space-y-3">
                {loading ? (
                  <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                    <RefreshCw size={20} className="animate-spin text-brand-500" />
                    <span>Syncing articles database...</span>
                  </div>
                ) : filteredKbArticles.length === 0 ? (
                  <GlassCard className="p-8 text-center border-slate-850">
                    <div className="text-slate-600 text-3xl mb-2">🔍</div>
                    <h4 className="text-xs font-bold text-slate-300">No matching articles found</h4>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-sm mx-auto">Try refining your search terms or selecting another category.</p>
                  </GlassCard>
                ) : (
                  filteredKbArticles.map(art => {
                    const isExpanded = expandedKbArticle === art.id;
                    return (
                      <GlassCard 
                        key={art.id} 
                        className={`border-slate-850/60 hover:border-slate-800/80 transition-all overflow-hidden ${
                          isExpanded ? 'bg-slate-900/10' : ''
                        }`}
                      >
                        <button
                          onClick={() => setExpandedKbArticle(isExpanded ? null : art.id)}
                          className="w-full flex items-center justify-between p-4 text-left group"
                        >
                          <div className="space-y-1">
                            <span className="text-[9px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 uppercase tracking-wider">
                              {art.category}
                            </span>
                            <h4 className="text-xs font-bold text-slate-200 group-hover:text-slate-100 transition-colors mt-1">
                              {art.title}
                            </h4>
                          </div>
                          <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>
                        
                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-4 pb-5 pt-1 border-t border-slate-850/40 text-xs text-slate-300 leading-relaxed font-sans prose prose-invert max-w-none">
                            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900/60 space-y-2 whitespace-pre-line font-sans">
                              {art.content}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-3 pt-3 border-t border-slate-850/20">
                              <span>Article Ref: {art.id.substring(0, 8)}</span>
                              <span>Last updated: {new Date(art.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* VIEW: Create Request / Bug Form */}
          {activeSubTab === 'new-request' && (
            <div className="space-y-4">
              {/* Form type switcher */}
              <GlassCard className="p-4 border-slate-850 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRequestMode('ticket')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border ${
                    requestMode === 'ticket' 
                      ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' 
                      : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Plus size={13} />
                  <span>Open Support Ticket</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequestMode('bug')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border ${
                    requestMode === 'bug' 
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                      : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Bug size={13} />
                  <span>Submit Bug Report</span>
                </button>
              </GlassCard>

              {/* FORM: Support Ticket */}
              {requestMode === 'ticket' && (
                <GlassCard className="p-6 border-slate-850">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
                    <LifeBuoy size={16} className="text-brand-500" />
                    <span>Open a Support Ticket</span>
                  </h3>
                  <form onSubmit={handleTicketSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ticket Title</label>
                        <input
                          type="text"
                          required
                          placeholder="Brief summary of your issue"
                          value={ticketTitle}
                          onChange={(e) => setTicketTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 transition-all"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 transition-all"
                          >
                            <option value="General">General</option>
                            <option value="Academics">Academics</option>
                            <option value="Billing & Fees">Billing & Fees</option>
                            <option value="Communicator">Communicator</option>
                            <option value="Hostel Management">Hostel Management</option>
                            <option value="Transport & Transit">Transport & Transit</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Priority</label>
                          <select
                            value={ticketPriority}
                            onChange={(e) => setTicketPriority(e.target.value as any)}
                            className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 transition-all"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="URGENT">Urgent</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Detailed Description</label>
                      <textarea
                        required
                        rows={5}
                        placeholder="Please explain the issue. Include transaction IDs, student admission numbers, or details if relevant."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl p-3.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>

                    {/* File Attachment Upload */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Attachment (Screenshot or Logs)</label>
                      <div className="border border-dashed border-slate-800 hover:border-slate-750 bg-slate-950/40 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setTicketAttachment(e.target.files?.[0] || null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        {ticketAttachment ? (
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-brand-500/10 border border-brand-500/20 rounded-lg text-brand-400">
                              <CheckCircle size={16} />
                            </span>
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-200 max-w-[250px] truncate">{ticketAttachment.name}</p>
                              <p className="text-[9px] text-slate-500 font-mono">{(ticketAttachment.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTicketAttachment(null);
                              }}
                              className="p-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-500 group-hover:text-slate-400 transition-colors">
                            <Upload size={18} className="mx-auto" />
                            <p className="text-xs font-semibold">Drop or select file</p>
                            <p className="text-[9px]">Max file size 5MB. Supports PNG, JPG, WEBP.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || uploadingAttachment}
                      className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-brand-500/10 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Send size={13} />
                      <span>{loading ? 'Submitting ticket...' : 'Submit Support Ticket'}</span>
                    </button>
                  </form>
                </GlassCard>
              )}

              {/* FORM: Bug Report */}
              {requestMode === 'bug' && (
                <GlassCard className="p-6 border-slate-850">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
                    <Bug size={16} className="text-amber-500" />
                    <span>Submit a Bug Report</span>
                  </h3>
                  <form onSubmit={handleBugSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bug Title</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Invoices list crash on pagination"
                          value={bugTitle}
                          onChange={(e) => setBugTitle(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 transition-all"
                        />
                      </div>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Severity Level</label>
                        <select
                          value={bugSeverity}
                          onChange={(e) => setBugSeverity(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 transition-all"
                        >
                          <option value="LOW">Low (Cosmetic, spelling error)</option>
                          <option value="MEDIUM">Medium (Minor feature fails but workarounds exist)</option>
                          <option value="HIGH">High (Primary workflow breaks or outputs wrong data)</option>
                          <option value="CRITICAL">Critical (System crashes, data loss, security exposure)</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">What is happening?</label>
                      <textarea
                        required
                        rows={3}
                        placeholder="Describe what you did and the incorrect behavior you observed."
                        value={bugDesc}
                        onChange={(e) => setBugDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Steps to Reproduce</label>
                      <textarea
                        rows={3}
                        placeholder="1. Go to Invoicing Office&#10;2. Select Student Albert&#10;3. Click Pay Tuition Fee&#10;4. Observe TLS crash"
                        value={bugSteps}
                        onChange={(e) => setBugSteps(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl p-3 text-xs focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>

                    {/* Screenshot Upload */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Screenshot / Attachment</label>
                      <div className="border border-dashed border-slate-800 hover:border-slate-750 bg-slate-950/40 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setBugAttachment(e.target.files?.[0] || null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        {bugAttachment ? (
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                              <CheckCircle size={16} />
                            </span>
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-200 max-w-[250px] truncate">{bugAttachment.name}</p>
                              <p className="text-[9px] text-slate-500 font-mono">{(bugAttachment.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBugAttachment(null);
                              }}
                              className="p-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-500 group-hover:text-slate-400 transition-colors">
                            <Upload size={18} className="mx-auto" />
                            <p className="text-xs font-semibold">Drop or select file</p>
                            <p className="text-[9px]">Max file size 5MB. Supports PNG, JPG, WEBP.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || uploadingAttachment}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Send size={13} />
                      <span>{loading ? 'Submitting report...' : 'Submit Bug Report'}</span>
                    </button>
                  </form>
                </GlassCard>
              )}
            </div>
          )}

          {/* VIEW: System Status */}
          {activeSubTab === 'status' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Activity size={16} className="text-brand-500" />
                      <span>Live Service Health Telemetry</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time database and service status updates.</p>
                  </div>

                  <button 
                    onClick={loadSupportData} 
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg active:scale-95 transition-all"
                    title="Refresh Telemetry"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>

                {/* Overall status bar */}
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-xs font-bold">ALL SYSTEMS OPERATIONAL</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">LATEST CHECK: JUST NOW</span>
                </div>
              </GlassCard>

              {/* Status List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemStatuses.map(sys => {
                  const isOp = sys.status === 'OPERATIONAL';
                  const isDeg = sys.status === 'DEGRADED_PERFORMANCE';
                  return (
                    <GlassCard key={sys.id} className="p-4 border-slate-850/60 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-200">{sys.serviceName}</h4>
                        <p className="text-[10px] text-slate-500 leading-normal">{sys.description}</p>
                        <p className="text-[9px] text-slate-600 font-mono">Updated: {new Date(sys.updatedAt).toLocaleTimeString()}</p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isOp ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        isDeg ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {sys.status.replace('_', ' ')}
                      </span>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: Ticket History */}
          {activeSubTab === 'history' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                      {isAdminOrSuperAdmin ? <Shield size={16} className="text-brand-500" /> : <History size={16} className="text-brand-500" />}
                      <span>{isAdminOrSuperAdmin ? 'Institutional Support Console' : 'Your Ticket History'}</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {isAdminOrSuperAdmin ? 'Review and manage user tickets submitted to the portal.' : 'Monitor status changes, replies, and progression of your support requests.'}
                    </p>
                  </div>
                  
                  <button 
                    onClick={loadSupportData}
                    className="p-1.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg active:scale-95 transition-all self-start md:self-auto flex items-center gap-1 text-[10px] font-semibold"
                  >
                    <RefreshCw size={11} />
                    <span>Refresh Ledger</span>
                  </button>
                </div>

                {/* Tickets list */}
                {tickets.length === 0 ? (
                  <div className="text-center py-10">
                    <span className="text-3xl text-slate-700">🎟️</span>
                    <h4 className="text-xs font-bold text-slate-400 mt-2">No support tickets found</h4>
                    <p className="text-[10px] text-slate-500 mt-1 max-w-sm mx-auto">
                      {isAdminOrSuperAdmin ? 'No tickets require attention at this time.' : 'Submit a ticket under "Create Request" if you need technical or billing assistance.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tickets.map(t => {
                      const priorityColor = t.priority === 'URGENT' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                            t.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                            t.priority === 'MEDIUM' ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' :
                                            'bg-slate-800/40 text-slate-400 border-slate-850';
                      
                      const statusColor = t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                          t.status === 'CLOSED' ? 'bg-slate-900/60 text-slate-500 border-slate-850' :
                                          t.status === 'IN_PROGRESS' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                          'bg-amber-500/10 text-amber-400 border-amber-500/20';

                      return (
                        <div key={t.id} className="p-4 bg-slate-950/30 rounded-xl border border-slate-900 hover:border-slate-850 transition-all space-y-3">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${priorityColor}`}>
                                  {t.priority}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${statusColor}`}>
                                  {t.status}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">ID: {t.id.substring(0, 8)}</span>
                              </div>
                              <h4 className="text-xs font-bold text-slate-200 mt-1">{t.title}</h4>
                            </div>

                            {/* Admin Resolution Operations */}
                            {isAdminOrSuperAdmin ? (
                              <div className="flex items-center gap-1.5 self-start md:self-auto">
                                <span className="text-[9px] text-slate-500 font-bold uppercase mr-1">Admin Action:</span>
                                {['IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(st => (
                                  <button
                                    key={st}
                                    onClick={() => handleStatusUpdate(t.id, st as any)}
                                    className={`px-2 py-1 rounded text-[9px] font-semibold border transition-all ${
                                      t.status === st 
                                        ? 'bg-brand-500/10 border-brand-500/20 text-brand-400' 
                                        : 'bg-slate-900 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                    }`}
                                  >
                                    {st.replace('_', ' ')}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-medium font-mono shrink-0">
                                {new Date(t.createdAt).toLocaleString()}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/40 p-3 rounded-xl border border-slate-900/60 font-sans whitespace-pre-line">
                            {t.description}
                          </p>

                          {/* Attachment Link */}
                          {t.attachmentUrl && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-500 font-semibold">Attachment:</span>
                              <a
                                href={t.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-brand-400 hover:text-brand-300 font-medium underline flex items-center gap-1"
                              >
                                <Upload size={10} />
                                <span>View Attached File</span>
                              </a>
                            </div>
                          )}

                          {/* User details footer for Admin */}
                          {isAdminOrSuperAdmin && (
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900/50">
                              <div className="flex items-center gap-1.5">
                                <User size={12} className="text-slate-600" />
                                <span className="font-semibold">{t.userDetails?.firstName} {t.userDetails?.lastName}</span>
                                <span className="text-slate-600 font-mono">({t.userRole})</span>
                              </div>
                              <span className="font-mono">{new Date(t.createdAt).toLocaleString()}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

        </div>

        {/* Right 1 Column: Contact Cards */}
        <div className="space-y-6">
          <GlassCard className="p-6 border-slate-850 bg-gradient-to-b from-[#070a13]/80 to-slate-950/40">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-1.5">
              <LifeBuoy size={16} className="text-brand-500" />
              <span>Contact Support Desk</span>
            </h3>
            
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Our technical helpdesk operates Mon–Sat to assist institutions with portal provisioning, recovery, and invoicing issues.
            </p>

            <div className="space-y-4">
              {/* Card 1: Email */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl flex items-start gap-3 hover:border-brand-500/20 transition-all duration-200">
                <span className="p-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-lg shrink-0">
                  <Mail size={16} />
                </span>
                <div className="space-y-0.5 min-w-0">
                  <h4 className="text-xs font-bold text-slate-200">Email Support</h4>
                  <a 
                    href="mailto:aegis.erp.institutional.cloud@gmail.com" 
                    className="text-[10px] text-slate-400 hover:text-brand-400 transition-colors font-mono block truncate"
                  >
                    aegis.erp.institutional.cloud@gmail.com
                  </a>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase font-sans">Response within 24 hours</p>
                </div>
              </div>

              {/* Card 2: Phone */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl flex items-start gap-3 hover:border-brand-500/20 transition-all duration-200">
                <span className="p-2 bg-brand-500/10 border border-brand-500/20 text-brand-400 rounded-lg shrink-0">
                  <Phone size={16} />
                </span>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-200">Phone Hotline</h4>
                  <div className="text-[10px] text-slate-400 font-mono space-y-0.5">
                    <p>+91 93363 57874</p>
                    <p>+91 93054 26744</p>
                  </div>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Available Mon–Sat (9AM–6PM)</p>
                </div>
              </div>

              {/* Card 3: WhatsApp */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl flex items-start gap-3 hover:border-brand-500/20 transition-all duration-200">
                <span className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
                  <MessageSquare size={16} />
                </span>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-200">WhatsApp Support</h4>
                  <a 
                    href="https://wa.me/919336357874" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-slate-400 hover:text-emerald-400 transition-colors font-mono block"
                  >
                    +91 93363 57874
                  </a>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Instant Chat Support Available</p>
                </div>
              </div>

              {/* Card 4: Instagram */}
              <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl flex items-start gap-3 hover:border-brand-500/20 transition-all duration-200">
                <span className="p-2 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-lg shrink-0">
                  <Instagram size={16} />
                </span>
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-slate-200">Instagram Handle</h4>
                  <a 
                    href="https://instagram.com/aegis.erp.institutional.cloud" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-slate-400 hover:text-pink-400 transition-colors font-mono block"
                  >
                    @aegis.erp.institutional.cloud
                  </a>
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Latest system patches & release notes</p>
                </div>
              </div>
            </div>

            {/* Quick stats footer */}
            <div className="flex items-center gap-1.5 justify-center border-t border-slate-850 pt-5 mt-5 text-[9px] text-slate-500 font-mono">
              <Sparkles size={11} className="text-brand-400" />
              <span>TLS SECURE CHANNEL PROTECTED</span>
            </div>
          </GlassCard>
        </div>

      </div>
    </div>
  );
};
