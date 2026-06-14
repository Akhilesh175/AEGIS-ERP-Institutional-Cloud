import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabaseAdmin } from '../lib/supabase';
import { 
  Mail, Phone, MessageSquare, Instagram, Search, ChevronDown, ChevronUp, 
  Upload, X, Send, History, Sparkles, Plus, Bug, LifeBuoy, CheckCircle, 
  AlertTriangle, Activity, AlertCircle, RefreshCw, User, Shield, Bell,
  FileText, ArrowLeft, Filter, Calendar, BarChart2, Check, Download, ExternalLink
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { SupportTicket, BugReport, SystemStatus, KnowledgeBaseArticle, SupportTicketMessage, SupportNotification, SupportInternalNote, SupportTicketStatusLog } from '../types';

export const HelpSupportPage: React.FC = () => {
  const { session } = useStore();
  const schoolId = session?.user?.schoolId || 'global';
  const userId = session?.user?.id || '';
  const userName = session?.user ? `${session.user.firstName} ${session.user.lastName}` : 'System User';
  const userRole = session?.user?.role || 'STUDENT';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const isAdmin = userRole === 'ADMIN';
  const isAdminOrSuperAdmin = isSuperAdmin;

  // Navigation Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'kb' | 'new-request' | 'status' | 'history' | 'notifications' | 'bugs'>('kb');

  // Master Lists
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [kbArticles, setKbArticles] = useState<KnowledgeBaseArticle[]>([]);
  const [systemStatuses, setSystemStatuses] = useState<SystemStatus[]>([]);
  const [notifications, setNotifications] = useState<SupportNotification[]>([]);
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);

  // Selected Detail View (Ticket Details)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportTicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [messageAttachment, setMessageAttachment] = useState<File | null>(null);

  // Super Admin / Agent Ticket Drawer Tabs and Sub-resources
  const [drawerTab, setDrawerTab] = useState<'chat' | 'notes' | 'logs'>('chat');
  const [internalNotes, setInternalNotes] = useState<SupportInternalNote[]>([]);
  const [statusLogs, setStatusLogs] = useState<SupportTicketStatusLog[]>([]);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(false);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);

  // States
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters for Super Admin
  const [filterSchool, setFilterSchool] = useState<string>('All');
  const [filterRole, setFilterRole] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterSearch, setFilterSearch] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });

  // KB Search & Accordion
  const [kbSearch, setKbSearch] = useState('');
  const [selectedKbCategory, setSelectedKbCategory] = useState<string>('All');
  const [expandedKbArticle, setExpandedKbArticle] = useState<string | null>(null);

  // Form: Support Ticket
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('General');
  const [ticketPriority, setTicketPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketAttachment, setTicketAttachment] = useState<File | null>(null);

  // Form: Bug Report
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugAttachment, setBugAttachment] = useState<File | null>(null);

  // Form Switcher: Ticket vs Bug
  const [requestMode, setRequestMode] = useState<'ticket' | 'bug'>('ticket');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Master Data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch database resources
      const [statuses, articles, userTickets, bugs, notifs] = await Promise.all([
        mockApi.fetchSystemStatuses(),
        mockApi.fetchKnowledgeBaseArticles(),
        mockApi.fetchSupportTickets(schoolId),
        mockApi.fetchBugReports(schoolId),
        mockApi.fetchSupportNotifications()
      ]);

      setSystemStatuses(statuses);
      setKbArticles(articles);
      setTickets(userTickets);
      setBugReports(bugs);
      setNotifications(notifs);

      // Super Admin: fetch all schools for filters
      if (isSuperAdmin) {
        const { data: schoolsData } = await supabaseAdmin.from('schools').select('id, name');
        if (schoolsData) {
          setSchools(schoolsData);
        }

        // Fetch recent global replies from database
        try {
          const { data: recentMsgsData } = await supabaseAdmin
            .from('support_ticket_messages')
            .select('*, senderDetails:users(*), ticket:support_tickets(ticket_number)')
            .order('created_at', { ascending: false })
            .limit(5);

          if (recentMsgsData) {
            setRecentMessages(recentMsgsData.map((m: any) => ({
              id: m.id,
              ticketId: m.ticket_id,
              ticketNumber: m.ticket?.ticket_number || 'TKT-????',
              senderName: m.senderDetails ? `${m.senderDetails.first_name} ${m.senderDetails.last_name}` : 'Support Agent',
              senderRole: m.sender_role,
              message: m.message,
              createdAt: m.created_at
            })));
          }
        } catch (msgErr) {
          console.warn('Failed to load recent replies:', msgErr);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync with helpdesk services.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [schoolId, userRole]);

  // Scroll messages to bottom on list update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticketMessages]);

  // Load ticket conversation
  const openTicketDetails = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    setTicketMessages([]);
    setInternalNotes([]);
    setStatusLogs([]);
    setDrawerTab('chat');
    try {
      setMessagesLoading(true);
      const msgs = await mockApi.fetchTicketMessages(ticket.id);
      setTicketMessages(msgs);

      if (isSuperAdmin) {
        setNotesLoading(true);
        const notesData = await mockApi.fetchInternalNotes(ticket.id);
        setInternalNotes(notesData);
        setNotesLoading(false);
      }

      setLogsLoading(true);
      const logsData = await mockApi.fetchTicketStatusLogs(ticket.id);
      setStatusLogs(logsData);
      setLogsLoading(false);
    } catch (err: any) {
      setError('Failed to fetch conversation history.');
    } finally {
      setMessagesLoading(false);
      setNotesLoading(false);
      setLogsLoading(false);
    }
  };

  const handleSendInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newInternalNote.trim()) return;

    try {
      setSubmittingNote(true);
      await mockApi.createInternalNote(selectedTicket.id, newInternalNote.trim());
      setNewInternalNote('');
      const notesData = await mockApi.fetchInternalNotes(selectedTicket.id);
      setInternalNotes(notesData);
    } catch (err) {
      setError('Failed to transmit internal note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Submit support ticket
  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketDesc.trim()) return;

    try {
      setLoading(true);
      setError(null);
      let attachmentUrl = '';

      if (ticketAttachment) {
        attachmentUrl = await mockApi.uploadSupportAttachment(schoolId, ticketAttachment);
      }

      await mockApi.createSupportTicket(
        schoolId,
        ticketSubject.trim(),
        ticketDesc.trim(),
        ticketCategory,
        ticketPriority,
        attachmentUrl
      );

      setSuccessMessage('Ticket opened successfully. Ticket number will be generated shortly.');
      setTicketSubject('');
      setTicketDesc('');
      setTicketAttachment(null);

      // Reload
      const userTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(userTickets);

      setTimeout(() => {
        setSuccessMessage(null);
        setActiveSubTab('history');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit support ticket.');
    } finally {
      setLoading(false);
    }
  };

  // Submit bug report
  const handleBugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugTitle.trim() || !bugDesc.trim()) return;

    try {
      setLoading(true);
      setError(null);
      let screenshotUrl = '';

      if (bugAttachment) {
        screenshotUrl = await mockApi.uploadSupportAttachment(schoolId, bugAttachment);
      }

      // Automatically capture user's active page hash
      const activePageUrl = window.location.href;

      await mockApi.createBugReport(
        schoolId,
        activePageUrl,
        bugTitle.trim(),
        bugDesc.trim(),
        screenshotUrl
      );

      setSuccessMessage('Bug report filed successfully. Our engineers have been alerted.');
      setBugTitle('');
      setBugDesc('');
      setBugAttachment(null);

      // Reload bug reports
      const bugs = await mockApi.fetchBugReports(schoolId);
      setBugReports(bugs);

      setTimeout(() => {
        setSuccessMessage(null);
        setActiveSubTab('bugs');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to file bug report.');
    } finally {
      setLoading(false);
    }
  };

  // Send message inside ticket conversation
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || (!newMessage.trim() && !messageAttachment)) return;

    try {
      setSubmittingMessage(true);
      setError(null);
      let attachmentUrl = '';

      if (messageAttachment) {
        attachmentUrl = await mockApi.uploadSupportAttachment(schoolId, messageAttachment);
      }

      await mockApi.sendTicketMessage(selectedTicket.id, newMessage.trim(), attachmentUrl);
      setNewMessage('');
      setMessageAttachment(null);

      // Reload messages list
      const msgs = await mockApi.fetchTicketMessages(selectedTicket.id);
      setTicketMessages(msgs);

      // Update parent list
      const updatedTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(updatedTickets);
    } catch (err: any) {
      setError('Failed to transmit message.');
    } finally {
      setSubmittingMessage(false);
    }
  };

  // Change ticket status
  const handleStatusChange = async (nextStatus: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED') => {
    if (!selectedTicket) return;
    try {
      setError(null);
      await mockApi.updateSupportTicketStatus(selectedTicket.id, selectedTicket.status as any, nextStatus);
      
      // Update local state
      setSelectedTicket(prev => prev ? { ...prev, status: nextStatus } : null);
      
      // Reload tickets
      const updatedTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(updatedTickets);

      // Reload status logs
      const logsData = await mockApi.fetchTicketStatusLogs(selectedTicket.id);
      setStatusLogs(logsData);
    } catch (err: any) {
      setError('Failed to update ticket status.');
    }
  };

  // Change ticket assignment
  const handleAssignChange = async (userId: string | null) => {
    if (!selectedTicket) return;
    try {
      setError(null);
      await mockApi.assignTicket(selectedTicket.id, userId);
      
      // Update local state
      setSelectedTicket(prev => prev ? { ...prev, assignedTo: userId } : null);

      // Reload tickets
      const updatedTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(updatedTickets);
    } catch (err: any) {
      setError('Failed to update ticket assignment.');
    }
  };

  // Change ticket priority
  const handlePriorityChange = async (nextPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => {
    if (!selectedTicket) return;
    try {
      setError(null);
      await mockApi.updateSupportTicketPriority(selectedTicket.id, nextPriority);

      // Update local state
      setSelectedTicket(prev => prev ? { ...prev, priority: nextPriority } : null);

      // Reload tickets
      const updatedTickets = await mockApi.fetchSupportTickets(schoolId);
      setTickets(updatedTickets);
    } catch (err: any) {
      setError('Failed to update ticket priority.');
    }
  };

  // Mark notification as read
  const handleMarkNotificationRead = async (id: string, ticketId: string) => {
    try {
      await mockApi.markSupportNotificationAsRead(id);
      // Reload notifs
      const notifs = await mockApi.fetchSupportNotifications();
      setNotifications(notifs);

      // Auto jump to ticket history and open details
      const targetTicket = tickets.find(t => t.id === ticketId);
      if (targetTicket) {
        setActiveSubTab('history');
        openTicketDetails(targetTicket);
      } else {
        // Fetch tickets again
        const freshTickets = await mockApi.fetchSupportTickets(schoolId);
        setTickets(freshTickets);
        const refetched = freshTickets.find(t => t.id === ticketId);
        if (refetched) {
          setActiveSubTab('history');
          openTicketDetails(refetched);
        }
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Filter logic for dashboard tickets
  const filteredTickets = tickets.filter(t => {
    // School Filter
    if (filterSchool !== 'All' && t.schoolId !== filterSchool) return false;
    // Role Filter
    if (filterRole !== 'All' && t.userRole !== filterRole) return false;
    // Status Filter
    if (filterStatus !== 'All' && t.status !== filterStatus) return false;
    // Priority Filter
    if (filterPriority !== 'All' && t.priority !== filterPriority) return false;
    // Category Filter
    if (filterCategory !== 'All' && t.category !== filterCategory) return false;
    // Date Range
    if (filterDateRange.start) {
      const ticketTime = new Date(t.createdAt).getTime();
      const startTime = new Date(filterDateRange.start).getTime();
      if (ticketTime < startTime) return false;
    }
    if (filterDateRange.end) {
      const ticketTime = new Date(t.createdAt).getTime();
      const endTime = new Date(filterDateRange.end + 'T23:59:59').getTime();
      if (ticketTime > endTime) return false;
    }
    // Search Filter
    if (filterSearch.trim()) {
      const query = filterSearch.toLowerCase();
      const ticketIdMatches = t.ticketNumber?.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
      const nameMatches = t.userDetails ? `${t.userDetails.firstName} ${t.userDetails.lastName}`.toLowerCase().includes(query) : false;
      const subjectMatches = t.subject.toLowerCase().includes(query);
      const emailMatches = t.userDetails?.email.toLowerCase().includes(query) || false;
      const schoolMatches = t.schoolName?.toLowerCase().includes(query) || false;

      if (!ticketIdMatches && !nameMatches && !subjectMatches && !emailMatches && !schoolMatches) return false;
    }
    return true;
  });

  // KB category filters
  const kbCategories = ['All', ...new Set(kbArticles.map(art => art.category))];
  const filteredKbArticles = kbArticles.filter(art => {
    const matchesSearch = art.title.toLowerCase().includes(kbSearch.toLowerCase()) || 
                          art.content.toLowerCase().includes(kbSearch.toLowerCase());
    const matchesCategory = selectedKbCategory === 'All' || art.category === selectedKbCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate Metrics
  const openCount = tickets.filter(t => t.status === 'OPEN').length;
  const progressCount = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolvedCount = tickets.filter(t => t.status === 'RESOLVED').length;
  const closedCount = tickets.filter(t => t.status === 'CLOSED').length;

  // School statistics calculation
  const schoolStatsMap: Record<string, number> = {};
  tickets.forEach(t => {
    const name = t.schoolName || 'Global Support';
    schoolStatsMap[name] = (schoolStatsMap[name] || 0) + 1;
  });
  const schoolStats = Object.entries(schoolStatsMap).map(([name, count]) => ({ name, count }));

  // Role statistics calculation
  const roleStatsMap: Record<string, number> = {};
  tickets.forEach(t => {
    roleStatsMap[t.userRole] = (roleStatsMap[t.userRole] || 0) + 1;
  });
  const roleStats = Object.entries(roleStatsMap).map(([role, count]) => ({ role, count }));

  // Recent Tickets
  const recentTickets = [...tickets]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Recent Bug Reports
  const recentBugs = [...bugReports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in pb-12 font-sans text-slate-200">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-5">
        <div>
          <div className="flex items-center gap-2 text-brand-400">
            <LifeBuoy size={18} />
            <span className="text-xs font-mono uppercase tracking-widest font-bold">Aegis Operations Support</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">Help & Support Desk</h1>
          <p className="text-xs text-slate-400 mt-1"> Centralized helpdesk ticket routing, bug audits, and diagnostic systems.</p>
        </div>

        {/* Dynamic Action Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/60 p-1 rounded-xl border border-slate-850 self-start md:self-auto">
          {[
            { id: 'kb', label: 'Docs Database', icon: Search },
            { id: 'new-request', label: 'Create Request', icon: Plus, hide: isAdminOrSuperAdmin },
            { id: 'status', label: 'Service Status', icon: Activity },
            { id: 'history', label: isAdminOrSuperAdmin ? 'Central Tickets Console' : 'My Support Tickets', icon: History },
            { id: 'bugs', label: isAdminOrSuperAdmin ? 'Bug Reports Audit' : 'Bug Reports History', icon: Bug },
            { id: 'notifications', label: `Notifications (${notifications.length})`, icon: Bell }
          ].map(tab => {
            if (tab.hide) return null;
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveSubTab(tab.id as any);
                  setSelectedTicket(null);
                }}
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

      {/* ALERTS */}
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

      {/* MAIN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT 2 COLUMNS: DYNAMIC WORKSPACE */}
        <div className="lg:col-span-2 space-y-6">

          {/* VIEW: Selected Ticket Details Drawer (Messaging) */}
          {selectedTicket ? (
            <GlassCard className="p-6 border-slate-850 flex flex-col h-[700px]">
              
              {/* Message Header */}
              <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Ledger</span>
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">TICKET ID: {selectedTicket.ticketNumber}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                    selectedTicket.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    selectedTicket.status === 'CLOSED' ? 'bg-slate-900 text-slate-500 border-slate-800' :
                    selectedTicket.status === 'REOPENED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                    selectedTicket.status === 'IN_PROGRESS' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                    'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {selectedTicket.status}
                  </span>
                </div>
              </div>

              {/* Ticket Information Panel */}
              <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-2 mb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">{selectedTicket.subject}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Opened by <span className="text-slate-400">{selectedTicket.userDetails?.firstName} {selectedTicket.userDetails?.lastName}</span> ({selectedTicket.userRole}) • {selectedTicket.schoolName || 'Global Cloud'}
                    </p>
                  </div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">{selectedTicket.category}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed font-sans whitespace-pre-line border-t border-slate-900/50 pt-2">
                  {selectedTicket.description}
                </p>
                {selectedTicket.attachmentUrl && (
                  <div className="pt-2 flex items-center gap-1.5">
                    <span className="text-[9px] text-slate-500 font-semibold">Attachment:</span>
                    <a
                      href={selectedTicket.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9px] text-brand-400 hover:text-brand-300 underline flex items-center gap-1"
                    >
                      <Download size={10} />
                      <span>Download File</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Admin Actions Bar */}
              {isAdminOrSuperAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/20 border border-slate-850 p-3 rounded-xl mb-4 text-xs">
                  {/* Status update */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase text-slate-500">Ticket Status:</span>
                    <select
                      value={selectedTicket.status}
                      onChange={(e) => handleStatusChange(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                    >
                      <option value="OPEN">Open</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                      <option value="REOPENED">Reopened</option>
                    </select>
                  </div>

                  {/* Priority update */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase text-slate-500">Priority Level:</span>
                    <select
                      value={selectedTicket.priority}
                      onChange={(e) => handlePriorityChange(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>

                  {/* Ticket Assignment */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-bold uppercase text-slate-500">Assign Agent:</span>
                    <select
                      value={selectedTicket.assignedTo || ''}
                      onChange={(e) => handleAssignChange(e.target.value || null)}
                      className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-lg px-2 py-1 text-[11px] focus:outline-none"
                    >
                      <option value="">Unassigned</option>
                      <option value={userId}>Self (Super Admin)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Drawer Inner Sub-tabs Switcher */}
              <div className="flex items-center gap-1 border-b border-slate-850 pb-2 mb-4 text-xs font-bold uppercase">
                <button
                  type="button"
                  onClick={() => setDrawerTab('chat')}
                  className={`px-3 py-1 border-b-2 transition-all ${
                    drawerTab === 'chat' 
                      ? 'border-brand-500 text-brand-400 font-extrabold' 
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Conversation ({ticketMessages.length})
                </button>
                {isSuperAdmin && (
                  <button
                    type="button"
                    onClick={() => setDrawerTab('notes')}
                    className={`px-3 py-1 border-b-2 transition-all ${
                      drawerTab === 'notes' 
                        ? 'border-yellow-500 text-yellow-400 font-extrabold' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Internal Notes ({internalNotes.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerTab('logs')}
                  className={`px-3 py-1 border-b-2 transition-all ${
                    drawerTab === 'logs' 
                      ? 'border-slate-400 text-slate-300 font-extrabold' 
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Audit Log ({statusLogs.length})
                </button>
              </div>

              {/* TAB RENDER: Conversation */}
              {drawerTab === 'chat' && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4 scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
                    {messagesLoading ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
                        <RefreshCw size={14} className="animate-spin text-brand-500" />
                        <span>Loading conversation ledger...</span>
                      </div>
                    ) : ticketMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                        <span className="text-2xl mb-1">💬</span>
                        <p className="text-[10px] font-semibold">No replies yet. Support staff will reply shortly.</p>
                      </div>
                    ) : (
                      ticketMessages.map(m => {
                        const isSelf = m.senderId === userId;
                        return (
                          <div 
                            key={m.id} 
                            className={`flex gap-3 max-w-[85%] ${isSelf ? 'ml-auto flex-row-reverse' : ''}`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center shrink-0 text-slate-400 font-bold text-xs">
                              {m.senderDetails?.firstName?.[0] || 'U'}
                            </div>

                            <div className="space-y-1">
                              <div className={`flex items-center gap-1.5 text-[9px] text-slate-500 ${isSelf ? 'justify-end' : ''}`}>
                                <span className="font-bold text-slate-400">{m.senderDetails?.firstName} {m.senderDetails?.lastName}</span>
                                <span className="font-mono">({m.senderRole})</span>
                                <span>•</span>
                                <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                              </div>

                              <div className={`p-3 rounded-2xl text-xs font-sans whitespace-pre-line leading-relaxed border ${
                                isSelf 
                                  ? 'bg-brand-600/10 border-brand-500/25 text-brand-200 rounded-tr-none' 
                                  : 'bg-slate-900/60 border-slate-850 text-slate-300 rounded-tl-none'
                              }`}>
                                {m.message}
                                
                                {m.attachmentUrl && (
                                  <div className="mt-2 pt-2 border-t border-slate-800/40 flex items-center gap-1">
                                    <a
                                      href={m.attachmentUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[9px] text-brand-400 hover:text-brand-300 underline flex items-center gap-0.5"
                                    >
                                      <Download size={9} />
                                      <span>Download Attachment</span>
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Input Form */}
                  <form onSubmit={handleSendMessage} className="border-t border-slate-850 pt-4 space-y-3">
                    <div className="relative">
                      <textarea
                        rows={2}
                        placeholder="Type a support response... (markdown supported)"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-500 transition-all pr-12"
                      />
                      
                      <button
                        type="submit"
                        disabled={submittingMessage || (!newMessage.trim() && !messageAttachment)}
                        className="absolute bottom-3 right-3 p-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-lg transition-all"
                      >
                        <Send size={12} />
                      </button>
                    </div>

                    {/* Optional Message Attachment */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-bold rounded-lg cursor-pointer transition-all">
                          <Upload size={10} />
                          <span>{messageAttachment ? 'Change File' : 'Attach File'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => setMessageAttachment(e.target.files?.[0] || null)}
                          />
                        </label>

                        {messageAttachment && (
                          <span className="text-[10px] text-slate-500 font-mono truncate max-w-[200px] flex items-center gap-1.5">
                            <span>{messageAttachment.name}</span>
                            <button 
                              onClick={() => setMessageAttachment(null)} 
                              className="text-red-500 hover:text-red-400"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        )}
                      </div>
                      
                      <span className="text-[9px] text-slate-500 font-mono">TLS Channels Encrypted</span>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB RENDER: Internal Notes */}
              {drawerTab === 'notes' && isSuperAdmin && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
                    {notesLoading ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
                        <RefreshCw size={14} className="animate-spin text-yellow-500" />
                        <span>Loading internal notes...</span>
                      </div>
                    ) : internalNotes.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                        <span className="text-2xl mb-1">📝</span>
                        <p className="text-[10px] font-semibold text-slate-500">No internal notes for this ticket yet.</p>
                      </div>
                    ) : (
                      internalNotes.map(n => (
                        <div key={n.id} className="p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-[9px] text-yellow-500/80 font-mono">
                            <span className="font-bold">{n.senderDetails?.firstName} {n.senderDetails?.lastName || 'System Admin'}</span>
                            <span>{new Date(n.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">{n.noteText}</p>
                        </div>
                      ))
                    )}
                  </div>
                  {/* New internal note form */}
                  <form onSubmit={handleSendInternalNote} className="border-t border-slate-850 pt-4 space-y-3">
                    <div className="relative">
                      <textarea
                        rows={2}
                        placeholder="Write an internal note (visible only to support staff)..."
                        value={newInternalNote}
                        onChange={(e) => setNewInternalNote(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-yellow-500 transition-all pr-12"
                      />
                      <button
                        type="submit"
                        disabled={submittingNote || !newInternalNote.trim()}
                        className="absolute bottom-3 right-3 p-1.5 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white rounded-lg transition-all"
                      >
                        <Send size={12} />
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB RENDER: Audit Status Logs */}
              {drawerTab === 'logs' && (
                <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-track-slate-950 scrollbar-thumb-slate-800">
                  {logsLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500 gap-2">
                      <RefreshCw size={14} className="animate-spin text-slate-500" />
                      <span>Loading audit logs...</span>
                    </div>
                  ) : statusLogs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-600">
                      <span className="text-2xl mb-1">📜</span>
                      <p className="text-[10px] font-semibold text-slate-500">No status modifications recorded for this ticket.</p>
                    </div>
                  ) : (
                    <div className="relative border-l border-slate-800 ml-3 pl-5 space-y-5 py-2">
                      {statusLogs.map((log) => (
                        <div key={log.id} className="relative">
                          {/* Timeline Dot */}
                          <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-slate-950 border border-slate-700 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                          </span>
                          <div className="space-y-1">
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                              <span className="font-bold text-slate-300">{log.actorDetails?.firstName} {log.actorDetails?.lastName || 'System Agent'}</span>
                              <span className="text-slate-500">({log.actorDetails?.role || 'Staff'})</span>
                              <span>•</span>
                              <span>{new Date(log.changedAt).toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                              <span>Status Shifted:</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] border bg-slate-950 text-slate-500 border-slate-850 uppercase">{log.oldStatus}</span>
                              <span className="text-slate-500">→</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] border bg-brand-500/10 text-brand-400 border-brand-500/25 uppercase">{log.newStatus}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          ) : null}

          {/* VIEW: Knowledge Base */}
          {!selectedTicket && activeSubTab === 'kb' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">Self-Service Documentation</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Quick references and module usage support.</p>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-thin">
                    {kbCategories.map(cat => (
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

                {/* Search Bar */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    placeholder="Search for articles, features, troubleshooting guides..."
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

              {/* KB list */}
              <div className="space-y-3">
                {filteredKbArticles.length === 0 ? (
                  <GlassCard className="p-8 text-center border-slate-850">
                    <h4 className="text-xs font-bold text-slate-400">No matching help articles</h4>
                  </GlassCard>
                ) : (
                  filteredKbArticles.map(art => {
                    const isExpanded = expandedKbArticle === art.id;
                    return (
                      <GlassCard 
                        key={art.id} 
                        className={`border-slate-850/60 hover:border-slate-800/85 transition-all overflow-hidden ${
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
                            <h4 className="text-xs font-bold text-slate-200 mt-1">
                              {art.title}
                            </h4>
                          </div>
                          <span className="text-slate-500">
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </span>
                        </button>
                        
                        {isExpanded && (
                          <div className="px-4 pb-5 pt-1 border-t border-slate-850/30 text-xs text-slate-300 leading-relaxed font-sans prose prose-invert">
                            <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900/60 whitespace-pre-line font-sans">
                              {art.content}
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

          {/* VIEW: Submit Support Request */}
          {!selectedTicket && activeSubTab === 'new-request' && (
            <div className="space-y-4">
              
              {/* Request Type Switcher */}
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

              {/* Support Ticket Submission Form */}
              {requestMode === 'ticket' && (
                <GlassCard className="p-6 border-slate-850">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <LifeBuoy size={16} className="text-brand-500" />
                    <span>Open a New Support Ticket</span>
                  </h3>
                  <form onSubmit={handleTicketSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ticket Subject</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Cannot access Hostel Hub billing ledger"
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
                          <select
                            value={ticketCategory}
                            onChange={(e) => setTicketCategory(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                          >
                            <option value="General">General Support</option>
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
                            className="w-full bg-slate-950 border border-slate-850 text-slate-300 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                          >
                            <option value="LOW">Low</option>
                            <option value="MEDIUM">Medium</option>
                            <option value="HIGH">High</option>
                            <option value="CRITICAL">Critical</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Explain the Issue</label>
                      <textarea
                        required
                        rows={6}
                        placeholder="Please supply detailed reproduction details. Include invoice codes, user IDs, or any related logs."
                        value={ticketDesc}
                        onChange={(e) => setTicketDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl p-3.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>

                    {/* Screenshot attachment upload */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">File Attachment (Optional)</label>
                      <div className="border border-dashed border-slate-800 hover:border-slate-750 bg-slate-950/40 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => setTicketAttachment(e.target.files?.[0] || null)}
                        />
                        {ticketAttachment ? (
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-brand-500/10 border border-brand-500/20 rounded-lg text-brand-400">
                              <CheckCircle size={16} />
                            </span>
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-200 truncate max-w-[200px]">{ticketAttachment.name}</p>
                              <p className="text-[9px] text-slate-500 font-mono">{(ticketAttachment.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setTicketAttachment(null);
                              }}
                              className="p-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-850 relative z-10"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-500 group-hover:text-slate-400 transition-colors">
                            <Upload size={18} className="mx-auto" />
                            <p className="text-xs font-semibold">Click or drop image to upload</p>
                            <p className="text-[9px]">Max file size: 5MB</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Send size={13} />
                      <span>{loading ? 'Transmitting ticket...' : 'Open Support Ticket'}</span>
                    </button>
                  </form>
                </GlassCard>
              )}

              {/* Bug Submission Form */}
              {requestMode === 'bug' && (
                <GlassCard className="p-6 border-slate-850">
                  <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
                    <Bug size={16} className="text-amber-500" />
                    <span>Submit a Bug Report</span>
                  </h3>
                  <form onSubmit={handleBugSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bug Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Blank page when accessing route timetable"
                        value={bugTitle}
                        onChange={(e) => setBugTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active View URL (Autocaptured)</label>
                      <input
                        type="text"
                        disabled
                        value={window.location.href}
                        className="w-full bg-slate-900 border border-slate-850 text-slate-500 rounded-xl px-3 py-2.5 text-xs font-mono select-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Describe What Happened</label>
                      <textarea
                        required
                        rows={5}
                        placeholder="Explain the step-by-step actions that trigger this error and the observed outcome."
                        value={bugDesc}
                        onChange={(e) => setBugDesc(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-xl p-3.5 text-xs focus:outline-none focus:border-brand-500 transition-all"
                      />
                    </div>

                    {/* Screenshot screenshot upload */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Upload Screenshot / Evidence (Optional)</label>
                      <div className="border border-dashed border-slate-800 hover:border-slate-750 bg-slate-950/40 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer relative group transition-all">
                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          onChange={(e) => setBugAttachment(e.target.files?.[0] || null)}
                        />
                        {bugAttachment ? (
                          <div className="flex items-center gap-3">
                            <span className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                              <CheckCircle size={16} />
                            </span>
                            <div className="text-left">
                              <p className="text-xs font-bold text-slate-200 truncate max-w-[200px]">{bugAttachment.name}</p>
                              <p className="text-[9px] text-slate-500 font-mono">{(bugAttachment.size / 1024).toFixed(1)} KB</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBugAttachment(null);
                              }}
                              className="p-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-850 relative z-10"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1 text-slate-500 group-hover:text-slate-400 transition-colors">
                            <Upload size={18} className="mx-auto" />
                            <p className="text-xs font-semibold">Drop image here</p>
                            <p className="text-[9px]">Max file size: 5MB</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-1.5"
                    >
                      <Send size={13} />
                      <span>{loading ? 'Transmitting report...' : 'Submit Bug Report'}</span>
                    </button>
                  </form>
                </GlassCard>
              )}
            </div>
          )}

          {/* VIEW: System Status */}
          {!selectedTicket && activeSubTab === 'status' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex items-center justify-between border-b border-slate-850 pb-4 mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Activity size={16} className="text-brand-500" />
                      <span>Live Service Health Telemetry</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time database connectivity and API latency diagnostics.</p>
                  </div>

                  <button 
                    onClick={loadData} 
                    className="p-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg transition-all"
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>

                <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 text-emerald-400 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
                    <span className="text-xs font-bold">ALL SERVICES OPERATIONAL</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">LATEST INTEGRITY CHECK: PASS</span>
                </div>
              </GlassCard>

              {/* Individual microservice status blocks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemStatuses.map(sys => {
                  const isOp = sys.status === 'OPERATIONAL';
                  return (
                    <GlassCard key={sys.id} className="p-4 border-slate-850/60 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-200">{sys.serviceName}</h4>
                        <p className="text-[10px] text-slate-500">{sys.description}</p>
                      </div>

                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                        isOp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {sys.status.replace('_', ' ')}
                      </span>
                    </GlassCard>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW: Ticket Ledger (History) */}
          {!selectedTicket && activeSubTab === 'history' && (
            <div className="space-y-4">
              
              {/* Super Admin Centralized Dashboard Stats & Filters */}
              {isAdminOrSuperAdmin && (
                <div className="space-y-4">
                  {/* Metrics Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Open Tickets', count: openCount, color: 'text-amber-500 border-amber-500/20 bg-amber-500/5' },
                      { label: 'In Progress', count: progressCount, color: 'text-sky-500 border-sky-500/20 bg-sky-500/5' },
                      { label: 'Resolved', count: resolvedCount, color: 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' },
                      { label: 'Closed', count: closedCount, color: 'text-slate-500 border-slate-800 bg-slate-900/40' }
                    ].map(card => (
                      <GlassCard key={card.label} className={`p-4 border text-center ${card.color}`}>
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-slate-400">{card.label}</span>
                        <span className="text-2xl font-black mt-1 block">{card.count}</span>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Super Admin Filtering Toolbar */}
                  <GlassCard className="p-5 border-slate-850 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/40 pb-2.5">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Filter size={13} className="text-brand-500" />
                        <span>Filter & Search Support Ledger</span>
                      </span>
                      
                      <button
                        onClick={() => {
                          setFilterSchool('All');
                          setFilterRole('All');
                          setFilterStatus('All');
                          setFilterPriority('All');
                          setFilterCategory('All');
                          setFilterSearch('');
                          setFilterDateRange({ start: '', end: '' });
                        }}
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                      >
                        Reset Filters
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {/* Search box */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Search</label>
                        <input
                          type="text"
                          placeholder="Search ID, Subject, Username, Email..."
                          value={filterSearch}
                          onChange={(e) => setFilterSearch(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>

                      {/* School Dropdown */}
                      {isSuperAdmin && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">School Origin</label>
                          <select
                            value={filterSchool}
                            onChange={(e) => setFilterSchool(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                          >
                            <option value="All">All Schools</option>
                            {schools.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Role Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">User Role</label>
                        <select
                          value={filterRole}
                          onChange={(e) => setFilterRole(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Roles</option>
                          <option value="SUPER_ADMIN">Super Admin</option>
                          <option value="ADMIN">School Admin</option>
                          <option value="TEACHER">Teacher</option>
                          <option value="STUDENT">Student</option>
                          <option value="PARENT">Parent</option>
                        </select>
                      </div>

                      {/* Status Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Statuses</option>
                          <option value="OPEN">Open</option>
                          <option value="IN_PROGRESS">In Progress</option>
                          <option value="RESOLVED">Resolved</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      </div>

                      {/* Priority Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Priority</label>
                        <select
                          value={filterPriority}
                          onChange={(e) => setFilterPriority(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Priorities</option>
                          <option value="LOW">Low</option>
                          <option value="MEDIUM">Medium</option>
                          <option value="HIGH">High</option>
                          <option value="CRITICAL">Critical</option>
                        </select>
                      </div>

                      {/* Category Dropdown */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Category</label>
                        <select
                          value={filterCategory}
                          onChange={(e) => setFilterCategory(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="All">All Categories</option>
                          <option value="General">General Support</option>
                          <option value="Academics">Academics</option>
                          <option value="Billing & Fees">Billing & Fees</option>
                          <option value="Communicator">Communicator</option>
                          <option value="Hostel Management">Hostel Management</option>
                          <option value="Transport & Transit">Transport & Transit</option>
                        </select>
                      </div>

                      {/* Date Range Start */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Start Date</label>
                        <input
                          type="date"
                          value={filterDateRange.start}
                          onChange={(e) => setFilterDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                        />
                      </div>

                      {/* Date Range End */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">End Date</label>
                        <input
                          type="date"
                          value={filterDateRange.end}
                          onChange={(e) => setFilterDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none"
                        />
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* Tickets Table / List */}
              <GlassCard className="p-6 border-slate-850">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-850/60">
                  <h3 className="text-xs font-bold text-slate-200">
                    {isAdminOrSuperAdmin ? `Support Ledger (${filteredTickets.length} items)` : 'My Ticket Registry'}
                  </h3>
                  
                  <button 
                    onClick={loadData}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                    <span>Sync</span>
                  </button>
                </div>

                {filteredTickets.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-3xl">🎫</span>
                    <h4 className="text-xs font-bold mt-2">No tickets found</h4>
                    <p className="text-[10px] text-slate-600 mt-1">Submit a ticket under "Create Request" or clear active filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                          <th className="py-3 px-2">Ticket Number</th>
                          <th className="py-3 px-2">Subject</th>
                          {isAdminOrSuperAdmin && <th className="py-3 px-2">User / School</th>}
                          <th className="py-3 px-2">Status</th>
                          <th className="py-3 px-2">Priority</th>
                          <th className="py-3 px-2">Created</th>
                          <th className="py-3 px-2 text-right">Replies</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTickets.map(t => (
                          <tr 
                            key={t.id}
                            onClick={() => openTicketDetails(t)}
                            className="border-b border-slate-900/50 hover:bg-slate-900/30 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-2 font-mono text-[11px] font-bold text-brand-400">
                              {t.ticketNumber}
                            </td>
                            <td className="py-3 px-2 font-semibold text-slate-200 max-w-[200px] truncate">
                              {t.subject}
                            </td>
                            {isAdminOrSuperAdmin && (
                              <td className="py-3 px-2">
                                <div className="text-slate-300 font-semibold">{t.userDetails?.firstName} {t.userDetails?.lastName}</div>
                                <div className="text-[10px] text-slate-500 truncate max-w-[150px]">{t.schoolName || 'Global'}</div>
                              </td>
                            )}
                            <td className="py-3 px-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                t.status === 'CLOSED' ? 'bg-slate-900 text-slate-500 border-slate-800' :
                                t.status === 'IN_PROGRESS' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                                'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                t.priority === 'CRITICAL' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                t.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                t.priority === 'MEDIUM' ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' :
                                'bg-slate-800/40 text-slate-400 border-slate-850'
                              }`}>
                                {t.priority}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-mono text-[10px] text-slate-400">
                              {new Date(t.createdAt).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-2 text-right font-bold text-slate-300">
                              {t.replyCount || 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* VIEW: Bug Reports Audit */}
          {!selectedTicket && activeSubTab === 'bugs' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4">
                  <h3 className="text-xs font-bold text-slate-200">
                    {isAdminOrSuperAdmin ? 'Central Bug Audits' : 'My Filed Bug Reports'}
                  </h3>
                  
                  <button 
                    onClick={loadData}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1"
                  >
                    <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
                    <span>Sync</span>
                  </button>
                </div>

                {bugReports.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-3xl">🪲</span>
                    <h4 className="text-xs font-bold mt-2">No bugs recorded</h4>
                    <p className="text-[10px]">Bug reports filed will show up here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {bugReports.map(b => (
                      <div key={b.id} className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-slate-200">{b.bugTitle}</h4>
                            <p className="text-[10px] text-slate-500">
                              Reported by <span className="text-slate-400">{b.userDetails?.firstName} {b.userDetails?.lastName || 'User'}</span> ({b.userDetails?.email}) • {b.schoolName || 'Global'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[8px] font-bold border uppercase bg-amber-500/10 text-amber-400 border-amber-500/20">
                              {b.status}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono">{new Date(b.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-400 leading-normal bg-slate-950 p-3 rounded-lg border border-slate-900 font-mono whitespace-pre-wrap select-text">
                          {b.description}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500 font-mono">
                          {b.pageUrl && (
                            <div className="flex items-center gap-1">
                              <span>Page URL:</span>
                              <a 
                                href={b.pageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-brand-400 hover:underline flex items-center gap-0.5"
                              >
                                <span className="truncate max-w-[200px]">{b.pageUrl}</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          )}

                          {b.screenshotUrl && (
                            <a
                              href={b.screenshotUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                            >
                              <Download size={10} />
                              <span>View Captured Screenshot</span>
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* VIEW: Notifications */}
          {!selectedTicket && activeSubTab === 'notifications' && (
            <div className="space-y-4">
              <GlassCard className="p-6 border-slate-850">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4">
                  <h3 className="text-xs font-bold text-slate-200">Support Desk Notifications</h3>
                  {notifications.length > 0 && (
                    <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                      {notifications.length} Unread
                    </span>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <span className="text-2xl mb-1">🔔</span>
                    <p className="text-xs font-semibold">No unread helpdesk notifications</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notifications.map(n => (
                      <div 
                        key={n.id} 
                        onClick={() => handleMarkNotificationRead(n.id, n.ticketId)}
                        className="p-4 bg-slate-900/30 border border-slate-850/60 rounded-xl hover:border-brand-500/20 cursor-pointer transition-all flex justify-between gap-3 group"
                      >
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-slate-200 group-hover:text-brand-400 transition-colors flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-brand-500 rounded-full shrink-0" />
                            <span>{n.title}</span>
                          </h4>
                          <p className="text-xs text-slate-400 leading-normal font-sans">{n.message}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{new Date(n.createdAt).toLocaleString()}</p>
                        </div>
                        
                        <span className="text-[9px] text-slate-500 font-semibold uppercase shrink-0 self-center border border-slate-800 bg-slate-950 px-2 py-0.5 rounded">
                          View Ticket
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: SIDE METRICS & STATS */}
        <div className="space-y-6">

          {/* Super Admin Stats Summary Graphs */}
          {isAdminOrSuperAdmin && activeSubTab === 'history' && !selectedTicket && (
            <GlassCard className="p-6 border-slate-850 space-y-6">
              {/* School stats */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BarChart2 size={13} className="text-brand-400" />
                  <span>School-wise Ticket Distribution</span>
                </span>
                
                <div className="space-y-2.5">
                  {schoolStats.map(stat => (
                    <div key={stat.name} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="truncate max-w-[170px]">{stat.name}</span>
                        <span>{stat.count}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                        <div 
                          className="bg-brand-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (stat.count / tickets.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {schoolStats.length === 0 && <span className="text-[10px] text-slate-500">No school distribution logs</span>}
                </div>
              </div>

              {/* Role stats */}
              <div className="space-y-3 border-t border-slate-850 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <User size={13} className="text-brand-400" />
                  <span>Role-wise Ticket Distribution</span>
                </span>
                
                <div className="space-y-2.5">
                  {roleStats.map(stat => (
                    <div key={stat.role} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{stat.role}</span>
                        <span>{stat.count}</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-900">
                        <div 
                          className="bg-sky-500 h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (stat.count / tickets.length) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  {roleStats.length === 0 && <span className="text-[10px] text-slate-500">No role distribution logs</span>}
                </div>
              </div>

              {/* Recent Tickets Widget */}
              <div className="space-y-3 border-t border-slate-850 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History size={13} className="text-brand-400" />
                  <span>Recent Tickets</span>
                </span>
                <div className="space-y-2">
                  {recentTickets.map(t => (
                    <div 
                      key={t.id} 
                      onClick={() => openTicketDetails(t)}
                      className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg hover:border-brand-500/30 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-300 truncate max-w-[140px]">{t.subject}</div>
                        <div className="text-[9px] text-slate-500 font-mono mt-0.5">{t.ticketNumber} • {t.userRole}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase shrink-0 ${
                        t.status === 'RESOLVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        t.status === 'CLOSED' ? 'bg-slate-900 text-slate-500 border-slate-800' :
                        t.status === 'REOPENED' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        t.status === 'IN_PROGRESS' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                  {recentTickets.length === 0 && <span className="text-[10px] text-slate-500">No recent tickets</span>}
                </div>
              </div>

              {/* Recent Replies Widget */}
              <div className="space-y-3 border-t border-slate-850 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MessageSquare size={13} className="text-brand-400" />
                  <span>Recent Replies</span>
                </span>
                <div className="space-y-2">
                  {recentMessages.map(msg => {
                    const t = tickets.find(x => x.id === msg.ticketId);
                    return (
                      <div 
                        key={msg.id}
                        onClick={() => t && openTicketDetails(t)}
                        className={`p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg text-xs ${t ? 'hover:border-brand-500/30 cursor-pointer' : ''}`}
                      >
                        <div className="flex items-center justify-between font-bold text-slate-300 gap-2">
                          <span className="truncate max-w-[100px]">{msg.senderName}</span>
                          <span className="text-[9px] text-brand-400 font-mono shrink-0">{msg.ticketNumber}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-1">"{msg.message}"</p>
                        <span className="text-[8px] text-slate-500 font-mono mt-0.5 block">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                      </div>
                    );
                  })}
                  {recentMessages.length === 0 && <span className="text-[10px] text-slate-500">No recent replies</span>}
                </div>
              </div>

              {/* Recent Bug Reports Widget */}
              <div className="space-y-3 border-t border-slate-850 pt-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Bug size={13} className="text-brand-400" />
                  <span>Recent Bug Reports</span>
                </span>
                <div className="space-y-2">
                  {recentBugs.map(b => (
                    <div 
                      key={b.id}
                      onClick={() => {
                        setActiveSubTab('bugs');
                      }}
                      className="p-2.5 bg-slate-950/40 border border-slate-900 rounded-lg hover:border-brand-500/30 cursor-pointer transition-all flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-300 truncate max-w-[140px]">{b.bugTitle}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{new Date(b.createdAt).toLocaleDateString()}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                        {b.status}
                      </span>
                    </div>
                  ))}
                  {recentBugs.length === 0 && <span className="text-[10px] text-slate-500">No recent bug reports</span>}
                </div>
              </div>
            </GlassCard>
          )}

          {/* Support desk contact cards */}
          <GlassCard className="p-6 border-slate-850 bg-gradient-to-b from-[#070a13]/85 to-slate-950/40">
            <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
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
                  <p className="text-[9px] text-slate-500 font-semibold uppercase">Response within 24 hours</p>
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
