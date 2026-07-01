import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Search, Paperclip, Pin, Bell, Volume2, Mic, Square, Smile, CornerUpLeft, 
  Trash2, X, Download, FileText, Shield, Check, UserMinus, VolumeX, Volume2 as VolumeIcon,
  ChevronRight, Calendar, User, SearchIcon, Clock, ChevronDown, ListFilter, AlertCircle, FileSpreadsheet, ArrowLeft, Info
} from 'lucide-react';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { ClassChatGroup, ClassChatMember, ClassMessage, ClassMessageAttachment, UserRole } from '../types';
import { FullScreenChatLayout } from './FullScreenChatLayout';

interface ClassDiscussionProps {
  currentUserId: string;
  currentUserRole: UserRole;
  schoolId: string;
  academicSessionId: string;
}

const getUserInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

export const ClassDiscussion: React.FC<ClassDiscussionProps> = ({
  currentUserId,
  currentUserRole,
  schoolId,
  academicSessionId
}) => {
  // Navigation & Group state
  const [groups, setGroups] = useState<ClassChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ClassChatGroup | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [members, setMembers] = useState<ClassChatMember[]>([]);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    console.log(`[App Routing] Mount ClassDiscussion component: route = groupdiscussion, userRole = ${currentUserRole}`);
  }, [currentUserRole]);

  // ── Group Discussion Body-Class Toggle ────────────────────────────────────
  // Adds `group-discussion-active` to <body> while this component is mounted.
  // The class activates the scoped CSS block in index.css that repositions the
  // fullscreen chat overlay below the Navbar and respects OS safe-area insets.
  // Strictly cleaned up on unmount — never leaks to other pages or modules.
  useEffect(() => {
    document.body.classList.add('group-discussion-active');
    return () => {
      document.body.classList.remove('group-discussion-active');
    };
  }, []);

  // ── Capture-Phase Back-Button Interceptor ─────────────────────────────────
  // Implements the navigation flow:
  //   Class Discussion chat open → Back → Group Discussion list
  //   Group Discussion list      → Back → Dashboard (default global handler)
  //
  // Strategy: listen at the capture phase (before the global onClick in Navbar)
  // on the `#header-back-button` element. If a group is currently selected we
  // intercept the event, close the chat room, and stop propagation. Otherwise
  // we let the event bubble normally so global navigation handles it.
  //
  // selectedGroupRef mirrors the selectedGroup state so the listener always
  // sees the latest value without needing to be re-registered on every change.
  const selectedGroupRef = useRef<typeof selectedGroup>(null);
  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
  }, [selectedGroup]);

  useEffect(() => {
    const handleBackCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only intercept clicks on or within #header-back-button
      if (!target.closest('#header-back-button')) return;
      // If a chat group is open, close it and stay on Group Discussion list
      if (selectedGroupRef.current !== null) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedGroup(null);
      }
      // Otherwise let the event propagate — Navbar's onClick will navigate back
    };

    document.addEventListener('click', handleBackCapture, true /* capture */);
    return () => {
      document.removeEventListener('click', handleBackCapture, true);
    };
  }, []); // Dependencies intentionally empty — uses ref for fresh state access

  // Message compose state
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<ClassMessage | null>(null);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // Mute operational state
  const [mutingMemberId, setMutingMemberId] = useState<string | null>(null);
  const [muteDuration, setMuteDuration] = useState('15');

  // Search & Filter state (Middle/Right panels)
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'members' | 'files' | 'pins'>('members');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showRightPanelMobile, setShowRightPanelMobile] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // RealtimePresence / Broadcast State
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; timestamp: number }>>({});
  const presenceChannelRef = useRef<any>(null);
  const messageChannelRef = useRef<any>(null);

  // UI scroll & ref tracking
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Resolve currentUser details
  const [currentUserProfile, setCurrentUserProfile] = useState<{ first: string; last: string; avatar: string } | null>(null);

  // Fetch groups and user profile
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingGroups(true);
        // Load groups
        const fetchedGroups = await mockApi.getClassChatGroups(schoolId, academicSessionId, currentUserId, currentUserRole);
        setGroups(fetchedGroups);
        
        // Load current user profile for realtime broadcast
        const { data: uData } = await supabase
          .from('users')
          .select('first_name, last_name, avatar_url')
          .eq('id', currentUserId)
          .single();
        if (uData) {
          setCurrentUserProfile({
            first: uData.first_name || '',
            last: uData.last_name || '',
            avatar: uData.avatar_url || ''
          });
        }
      } catch (err) {
        console.error('Failed to load group discussions:', err);
      } finally {
        setLoadingGroups(false);
      }
    };
    init();
  }, [schoolId, academicSessionId, currentUserId, currentUserRole]);

  // Load selected group details, messages, members & setup realtime channel
  useEffect(() => {
    if (!selectedGroup) {
      setMessages([]);
      setMembers([]);
      setReplyTo(null);
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      if (messageChannelRef.current) messageChannelRef.current.unsubscribe();
      return;
    }

    const loadGroupDetails = async () => {
      try {
        setLoadingMessages(true);
        // Load members first to resolve names in postgres updates
        const groupMembers = await mockApi.getClassChatMembers(schoolId, academicSessionId, selectedGroup.id);
        setMembers(groupMembers);

        // Load messages
        const chatMessages = await mockApi.getClassMessages(schoolId, academicSessionId, selectedGroup.id, 100, 0);
        setMessages(chatMessages);
      } catch (err) {
        console.error('Error loading group discussion contents:', err);
      } finally {
        setLoadingMessages(false);
        setTimeout(scrollToBottom, 100);
      }
    };

    loadGroupDetails();

    // ── Supabase Realtime Setup ──
    // Setup presence & broadcast channel
    const channelName = `group-chat:${selectedGroup.id}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: currentUserId }
      }
    });

    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const active: Record<string, any> = {};
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) {
            active[key] = presences[0];
          }
        });
        setOnlineUsers(active);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== currentUserId) {
          setTypingUsers(prev => ({
            ...prev,
            [payload.userId]: { name: payload.name, timestamp: Date.now() }
          }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUserProfile) {
          await channel.track({
            userId: currentUserId,
            name: `${currentUserProfile.first} ${currentUserProfile.last}`.trim(),
            avatarUrl: currentUserProfile.avatar,
            role: currentUserRole,
            onlineAt: new Date().toISOString()
          });
        }
      });

    // Setup Postgres direct table changes listener for live message delivery
    const messagesChannel = supabase.channel(`table-changes:${selectedGroup.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'class_messages',
        filter: `group_id=eq.${selectedGroup.id}`
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          // If the message is already in our list (e.g. sent by us, inserted optimistically), ignore
          const exists = messages.some(m => m.id === payload.new.id);
          if (exists) return;

          // Fetch fresh mapped message details to resolve attachments, reactions, and join details
          const fetchedMsgList = await mockApi.getClassMessages(schoolId, academicSessionId, selectedGroup.id, 10, 0);
          const freshMessage = fetchedMsgList.find((m: any) => m.id === payload.new.id);
          
          if (freshMessage) {
            setMessages(prev => {
              const alreadyExists = prev.some(m => m.id === freshMessage.id);
              if (alreadyExists) return prev;
              return [...prev, freshMessage];
            });
            setTimeout(scrollToBottom, 100);
          }
        } else if (payload.eventType === 'UPDATE') {
          // Handle soft delete or message editing
          const updated = payload.new;
          if (updated.deleted_at) {
            setMessages(prev => prev.filter(m => m.id !== updated.id));
          } else {
            // Fetch updated mapped message details
            const fetchedMsgList = await mockApi.getClassMessages(schoolId, academicSessionId, selectedGroup.id, 10, 0);
            const freshMessage = fetchedMsgList.find((m: any) => m.id === updated.id);
            if (freshMessage) {
              setMessages(prev => prev.map(m => m.id === freshMessage.id ? freshMessage : m));
            }
          }
        }
      })
      .subscribe();

    messageChannelRef.current = messagesChannel;

    // Typing cleanup interval
    const typingCleanup = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const clean: Record<string, { name: string; timestamp: number }> = {};
        Object.keys(prev).forEach(k => {
          if (now - prev[k].timestamp < 3000) {
            clean[k] = prev[k];
          }
        });
        return clean;
      });
    }, 1000);

    return () => {
      clearInterval(typingCleanup);
      channel.unsubscribe();
      messagesChannel.unsubscribe();
    };
  }, [selectedGroup, schoolId, academicSessionId, currentUserId, currentUserRole, currentUserProfile]);

  // Scroll handler helper
  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Broadcast typing status
  const handleKeyDown = () => {
    if (!selectedGroup || !presenceChannelRef.current || !currentUserProfile) return;
    presenceChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUserId,
        name: `${currentUserProfile.first} ${currentUserProfile.last}`.trim()
      }
    });
  };

  // Handle attachment selection
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...filesArray]);
    }
  };

  // Remove selected attachment before sending
  const removeSelectedAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Voice Recording Functions
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const voiceFile = new File([audioBlob], `voice_note_${Date.now()}.webm`, { type: 'audio/webm' });
        
        // Instant upload & submit voice note
        setUploadingAttachments(true);
        try {
          const uploaded = await mockApi.uploadClassChatAttachment(schoolId, selectedGroup!.classId, voiceFile);
          const voiceMsg = await mockApi.submitClassChatMessage(
            schoolId,
            academicSessionId,
            selectedGroup!.id,
            currentUserId,
            null,
            [uploaded],
            replyTo ? replyTo.id : null,
            'CHAT',
            null
          );
          setMessages(prev => [...prev, voiceMsg]);
          setReplyTo(null);
          setTimeout(scrollToBottom, 100);
        } catch (uploadErr: any) {
          alert('Failed to send voice note: ' + uploadErr.message);
        } finally {
          setUploadingAttachments(false);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert('Unable to access microphone for voice message recording.');
    }
  };

  const stopVoiceRecording = (submit = true) => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorder && isRecording) {
      if (!submit) {
        // Discard recording
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
      }
      mediaRecorder.stop();
      // Stop all mic tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  // Submit Text/Attachments Message
  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || (!messageText.trim() && attachments.length === 0)) return;

    setUploadingAttachments(true);
    try {
      const uploadedAttachments: any[] = [];
      // 1. Upload files if any
      for (const file of attachments) {
        const res = await mockApi.uploadClassChatAttachment(schoolId, selectedGroup.classId, file);
        uploadedAttachments.push(res);
      }

      // 2. Submit Message
      const newMsg = await mockApi.submitClassChatMessage(
        schoolId,
        academicSessionId,
        selectedGroup.id,
        currentUserId,
        messageText.trim() || null,
        uploadedAttachments,
        replyTo ? replyTo.id : null,
        isAnnouncement ? 'ANNOUNCEMENT' : 'CHAT',
        null
      );

      // 3. Create Class Announcement link if selected
      if (isAnnouncement && announcementTitle.trim()) {
        await mockApi.setClassAnnouncement(
          schoolId,
          academicSessionId,
          selectedGroup.id,
          newMsg.id,
          announcementTitle.trim()
        );
      }

      // 4. Update local state instantly & reset compose
      setMessages(prev => [...prev, newMsg]);
      setMessageText('');
      setReplyTo(null);
      setAttachments([]);
      setIsAnnouncement(false);
      setAnnouncementTitle('');
      setTimeout(scrollToBottom, 100);
    } catch (err: any) {
      alert(err.message || 'Failed to send message.');
    } finally {
      setUploadingAttachments(false);
    }
  };

  // Pin Message
  const handlePinMessage = async (msg: ClassMessage) => {
    if (!selectedGroup) return;
    const isCurrentlyPinned = msg.pinnedBy !== undefined;
    try {
      await mockApi.setClassPinnedMessage(
        schoolId,
        academicSessionId,
        selectedGroup.id,
        msg.id,
        currentUserId,
        !isCurrentlyPinned
      );
      // Reload messages to update pin flags
      const refreshed = await mockApi.getClassMessages(schoolId, academicSessionId, selectedGroup.id, 100, 0);
      setMessages(refreshed);
    } catch (err: any) {
      alert('Failed to update pinned state: ' + err.message);
    }
  };

  // Delete Message
  const handleDeleteMessage = async (msgId: string) => {
    if (!selectedGroup) return;
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await mockApi.deleteClassChatMessage(schoolId, academicSessionId, msgId, currentUserId, currentUserRole);
      setMessages(prev => prev.filter(m => m.id !== msgId));
    } catch (err: any) {
      alert('Failed to delete message: ' + err.message);
    }
  };

  // Add emoji reaction
  const handleAddReaction = async (msgId: string, reaction: string, currentlyReacted: boolean) => {
    if (!selectedGroup) return;
    try {
      await mockApi.setClassMessageReaction(schoolId, academicSessionId, msgId, currentUserId, reaction, currentlyReacted);
      // Refresh messages to reflect reaction updates
      const refreshed = await mockApi.getClassMessages(schoolId, academicSessionId, selectedGroup.id, 100, 0);
      setMessages(refreshed);
    } catch (err: any) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Mute / Unmute Student
  const handleMuteMember = async (memberUserId: string, permanent: boolean) => {
    if (!selectedGroup) return;
    try {
      const minutes = parseInt(muteDuration, 10);
      await mockApi.muteStudentInClassGroup(schoolId, academicSessionId, selectedGroup.id, memberUserId, minutes, permanent);
      alert(permanent ? 'Student is now permanently muted.' : `Student is muted for ${minutes} minutes.`);
      
      // Reload members list
      const groupMembers = await mockApi.getClassChatMembers(schoolId, academicSessionId, selectedGroup.id);
      setMembers(groupMembers);
      setMutingMemberId(null);
    } catch (err: any) {
      alert('Failed to mute member: ' + err.message);
    }
  };

  const handleUnmuteMember = async (memberUserId: string) => {
    if (!selectedGroup) return;
    try {
      await mockApi.muteStudentInClassGroup(schoolId, academicSessionId, selectedGroup.id, memberUserId, 0, false);
      alert('Student is now unmuted.');
      
      // Reload members
      const groupMembers = await mockApi.getClassChatMembers(schoolId, academicSessionId, selectedGroup.id);
      setMembers(groupMembers);
    } catch (err: any) {
      alert('Failed to unmute student: ' + err.message);
    }
  };

  // CSV Export
  const handleExportCSV = async () => {
    if (!selectedGroup) return;
    try {
      const csvData = await mockApi.exportClassDiscussionHistory(schoolId, academicSessionId, selectedGroup.id);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedGroup.name.replace(/\s+/g, '_')}_history.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  // Helper formats
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Filter lists based on user search queries
  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  const filteredMessages = messages.filter(m => {
    if (!messageSearchQuery) return true;
    const cleanSearch = messageSearchQuery.toLowerCase();
    
    // Search message body text
    if (m.content && m.content.toLowerCase().includes(cleanSearch)) return true;
    
    // Search sender name
    if (m.senderName && m.senderName.toLowerCase().includes(cleanSearch)) return true;
    
    // Search attachments
    if (m.attachments && m.attachments.some(att => att.fileName.toLowerCase().includes(cleanSearch))) return true;
    
    // Search notice type or message type
    if (m.systemNoticeType && m.systemNoticeType.toLowerCase().includes(cleanSearch)) return true;
    if (m.messageType.toLowerCase().includes(cleanSearch)) return true;

    return false;
  });

  const sharedFiles = messages.reduce<ClassMessageAttachment[]>((acc, m) => {
    if (m.attachments && m.attachments.length > 0) {
      acc.push(...m.attachments);
    }
    return acc;
  }, []).filter(f => f.fileName.toLowerCase().includes(fileSearchQuery.toLowerCase()));

  const pinnedMessagesList = messages.filter(m => m.pinnedBy !== undefined);
  const activeAnnouncement = messages.find(m => m.messageType === 'ANNOUNCEMENT');

  const filteredMembers = members.filter(m => {
    const fullName = `${m.userFirst || ''} ${m.userLast || ''}`.toLowerCase();
    return fullName.includes(memberSearchQuery.toLowerCase()) || m.role.toLowerCase().includes(memberSearchQuery.toLowerCase());
  });

  // Verify role permission to perform actions like mute, pin, announce
  const canPerformStaffActions = ['ADMIN', 'TEACHER', 'CLASS_TEACHER', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(currentUserRole);

  useEffect(() => {
    console.log("Current User:", { id: currentUserId, role: currentUserRole });
    console.log("School ID:", schoolId);
    console.log("Active Session:", academicSessionId);
    console.log("Raw Groups:", groups);
    console.log("Filtered Groups:", filteredGroups);
    console.log("Memberships:", members);
  }, [currentUserId, currentUserRole, schoolId, academicSessionId, groups, filteredGroups, members]);

  return (
    <FullScreenChatLayout>
      {/* Inner flex container — fills FullScreenChatLayout on both mobile and desktop */}
      <div className="flex w-full h-full overflow-hidden text-slate-100 relative">
      {/* ── LEFT PANEL: CLASS GROUPS ────────────────────────────────────────── */}
      <div className={`w-full md:w-80 border-r border-slate-850 bg-slate-900/60 flex flex-col h-full ${selectedGroup ? 'hidden md:flex' : 'flex'}`}>
        {/* Search */}
        <div className="p-4 border-b border-slate-800/60">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search active groups..."
              className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Groups List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingGroups ? (
            <div className="flex items-center justify-center py-10 space-x-2 text-slate-400">
              <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-cyan-500" />
              <span className="text-sm">Loading discussion groups...</span>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="text-center py-10 text-sm text-slate-500">
              No active discussion groups found
            </div>
          ) : (
            filteredGroups.map(g => {
              const isSelected = selectedGroup?.id === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroup(g)}
                  className={`w-full flex flex-col p-3.5 rounded-2xl text-left transition-all duration-200 ${
                    isSelected 
                      ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/10 border-l-4 border-cyan-400 shadow-md bg-slate-800/40' 
                      : 'hover:bg-slate-800/20 hover:text-slate-200 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                     <span className="font-semibold text-sm truncate pr-2">{g.name}</span>
                    <ChevronRight className={`h-4 w-4 text-slate-500 transition-transform ${isSelected ? 'rotate-90 text-cyan-400' : ''}`} />
                  </div>
                  <span className="text-xs text-slate-500 mt-1">Class Discussion Group</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── MIDDLE PANEL: CHAT WORKSPACE ────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col bg-slate-950/35 h-full relative border-r border-slate-850 min-w-0 ${selectedGroup ? 'flex' : 'hidden md:flex'}`}>
        {selectedGroup ? (
          <>
            {/* Header Area */}
            <div className="px-4 py-3 md:px-6 md:py-4 bg-slate-900/40 border-b border-slate-800/60 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0 w-full">
              <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedGroup(null)}
                  className="md:hidden flex items-center justify-center w-9 h-9 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-xl transition-all duration-200 border border-slate-800/60 flex-shrink-0"
                  title="Back to Group List"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1 sm:flex-initial">
                  <h2 className="text-sm md:text-lg font-bold text-slate-105 flex items-center gap-2 truncate">
                    <span className="truncate">{selectedGroup.name}</span>
                    {canPerformStaffActions && (
                      <span className="text-[10px] md:text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium flex-shrink-0">
                        Staff
                      </span>
                    )}
                  </h2>
                  <div className="text-[10px] md:text-xs text-slate-450 mt-0.5 flex items-center gap-1.5 flex-shrink-0">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
                    {Object.keys(onlineUsers).length} active
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:justify-start">
                <button 
                  onClick={handleExportCSV} 
                  title="Export Discussion History"
                  className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/30 text-slate-300 transition-all flex items-center gap-1.5 text-xs font-semibold flex-shrink-0"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-xs">Export History</span>
                </button>
                <div className="relative flex-1 sm:flex-initial min-w-0">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search in chat..."
                    className="bg-slate-950/70 border border-slate-800/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 transition-colors w-full sm:w-44"
                    value={messageSearchQuery}
                    onChange={(e) => setMessageSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setShowRightPanelMobile(prev => !prev)}
                  title="Discussion Details"
                  className="md:hidden p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/30 text-slate-300 transition-all flex items-center justify-center flex-shrink-0"
                >
                  <Info className="h-4 w-4 text-cyan-400" />
                </button>
              </div>
            </div>

            {/* Pinned Messages / Announcements Strip */}
            {pinnedMessagesList.length > 0 && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-amber-600/10 to-amber-900/5 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-300/90 font-medium min-w-0">
                <div className="flex items-center gap-2 truncate">
                  <Pin className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 rotate-45" />
                  <span className="truncate">
                    Pinned: "{pinnedMessagesList[pinnedMessagesList.length - 1].content || 'Attachment Shared'}"
                  </span>
                </div>
                <button 
                  onClick={() => { setActiveRightTab('pins'); setShowRightPanelMobile(true); }}
                  className="hover:underline text-[10px] text-amber-400 flex-shrink-0 uppercase tracking-wider font-bold"
                >
                  View All ({pinnedMessagesList.length})
                </button>
              </div>
            )}

            {activeAnnouncement && (
              <div className="px-6 py-2.5 bg-gradient-to-r from-red-600/10 to-rose-950/5 border-b border-rose-500/25 flex items-center gap-2.5 text-xs text-rose-300 min-w-0">
                <Bell className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 animate-bounce" />
                <span className="font-semibold text-rose-400 flex-shrink-0">Class Announcement:</span>
                <span className="truncate">{activeAnnouncement.content}</span>
              </div>
            )}

            {/* Messages Pane */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {loadingMessages ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-2 text-slate-400">
                  <span className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
                  <span className="text-sm">Fetching discussion thread...</span>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-20 text-slate-500 text-xs sm:text-sm">
                  {messageSearchQuery ? 'No messages match search filters.' : 'No messages in this class group yet. Type below to begin!'}
                </div>
              ) : (
                filteredMessages.map((msg, index) => {
                  const isCurrentUser = msg.senderId === currentUserId;
                  const isSystem = msg.messageType === 'SYSTEM';
                  const dateLabel = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="flex justify-center my-3 w-full px-4">
                        <div className="bg-slate-900/90 border border-slate-800 text-slate-400 px-4 py-2 rounded-2xl sm:rounded-full text-xs flex items-center justify-between sm:justify-center gap-2 max-w-full sm:max-w-xl shadow-sm min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <AlertCircle className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                            <span className="break-words [overflow-wrap:anywhere] min-w-0 text-left">{msg.content}</span>
                          </div>
                          <span className="text-[10px] text-slate-600 font-mono flex-shrink-0 ml-1">{dateLabel}</span>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`flex gap-2.5 sm:gap-3 items-start max-w-[90%] sm:max-w-[80%] md:max-w-[75%] ${isCurrentUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                      {/* Avatar */}
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700/60 flex items-center justify-center text-xs font-bold text-slate-300 relative">
                        {msg.senderAvatar ? (
                          <img 
                            src={msg.senderAvatar} 
                            alt={msg.senderName} 
                            className="h-full w-full object-cover" 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                              if (fallback) {
                                (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <span 
                          className="avatar-fallback animate-fade-in" 
                          style={{ display: msg.senderAvatar ? 'none' : 'flex' }}
                        >
                          {getUserInitials(msg.senderName || '')}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div className="flex flex-col space-y-1 w-full min-w-0">
                        {/* Meta */}
                        <div className={`flex flex-wrap items-center gap-1.5 text-[11px] ${isCurrentUser ? 'justify-end' : ''}`}>
                          <span className="font-semibold text-slate-300 truncate max-w-[120px] sm:max-w-[180px]">{msg.senderName}</span>
                          <span className="text-slate-500 font-mono text-[10px]">{dateLabel}</span>
                          {msg.senderRole && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                              msg.senderRole.includes('ADMIN') ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/10' :
                              msg.senderRole.includes('TEACHER') ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {msg.senderRole}
                            </span>
                          )}
                        </div>

                        {/* Text bubble */}
                        <div className={`p-3 sm:p-3.5 rounded-3xl relative group min-w-0 w-full ${
                          isCurrentUser 
                            ? 'bg-gradient-to-br from-cyan-600/70 to-blue-700/70 border border-cyan-500/35 rounded-tr-none text-slate-50' 
                            : 'bg-slate-900/90 border border-slate-800/80 rounded-tl-none text-slate-200'
                        }`}>
                          {/* Thread reply anchor info */}
                          {msg.replyToMessageId && (
                            <div className={`mb-2 p-2 rounded-xl text-[10px] border flex flex-col min-w-0 ${
                              isCurrentUser 
                                ? 'bg-cyan-950/40 border-cyan-800/30 text-cyan-300' 
                                : 'bg-slate-950/60 border-slate-800/50 text-slate-400'
                            }`}>
                              <span className="font-semibold text-[9px] mb-0.5 uppercase tracking-wider flex-shrink-0">
                                Replying to {msg.replyToSenderName}
                              </span>
                              <p className="truncate italic break-words [overflow-wrap:anywhere]">"{msg.replyToContent}"</p>
                            </div>
                          )}

                          {/* Content */}
                          {msg.content && <p className="text-sm whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere]">{msg.content}</p>}

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2.5 space-y-1.5 border-t border-slate-850 pt-2.5 min-w-0">
                              {msg.attachments.map(att => {
                                const isAudio = att.fileType.startsWith('audio') || att.fileName.endsWith('.webm');
                                return (
                                  <div key={att.id} className="flex items-center justify-between gap-3 p-2 rounded-xl bg-slate-950/30 border border-slate-850 hover:bg-slate-950/50 transition-colors min-w-0 w-full">
                                    <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                                      {isAudio ? <VolumeIcon className="h-4 w-4 text-cyan-400 flex-shrink-0" /> : <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" />}
                                      <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-xs truncate font-medium block w-full break-all" title={att.fileName}>{att.fileName}</span>
                                        <span className="text-[10px] text-slate-500 flex-shrink-0">{formatBytes(att.fileSize)}</span>
                                      </div>
                                    </div>
                                    {isAudio ? (
                                      <audio src={att.fileUrl} controls className="h-8 max-w-full w-[160px] sm:w-[200px] flex-shrink-0" />
                                    ) : (
                                      <a
                                        href={att.fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex-shrink-0"
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </a>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Reactions display */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2.5">
                              {Object.entries(
                                msg.reactions.reduce<Record<string, { count: number; users: string[] }>>((acc, curr) => {
                                  if (!acc[curr.reaction]) acc[curr.reaction] = { count: 0, users: [] };
                                  acc[curr.reaction].count += 1;
                                  acc[curr.reaction].users.push(curr.userId);
                                  return acc;
                                }, {})
                              ).map(([emoji, meta]) => {
                                const didReact = meta.users.includes(currentUserId);
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleAddReaction(msg.id, emoji, didReact)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 border transition-colors ${
                                      didReact 
                                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' 
                                        : 'bg-slate-950/40 border-slate-850 text-slate-400 hover:bg-slate-800'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span>{meta.count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Hover action menu overlay - positioned safe inside bubble boundaries */}
                          <div className={`absolute -top-3.5 opacity-0 group-hover:opacity-100 flex gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-md transition-opacity z-10 ${
                            isCurrentUser ? 'left-2' : 'right-2'
                          }`}>
                            <button 
                              onClick={() => setReplyTo(msg)} 
                              title="Reply"
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
                            >
                              <CornerUpLeft className="h-3.5 w-3.5" />
                            </button>
                            <button 
                              onClick={() => handlePinMessage(msg)} 
                              title={msg.pinnedBy ? "Unpin" : "Pin"}
                              className={`p-1 rounded hover:bg-slate-800 ${msg.pinnedBy ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'}`}
                            >
                              <Pin className="h-3.5 w-3.5 rotate-45" />
                            </button>
                            {canPerformStaffActions && (
                              <button 
                                onClick={() => {
                                  setIsAnnouncement(true);
                                  setMessageText(`📢 Announcement: "${msg.content || 'Attached File'}"`);
                                  setAnnouncementTitle(`Notice - ${new Date().toLocaleDateString()}`);
                                }} 
                                title="Promote to Class Announcement"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400"
                              >
                                <Bell className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(isCurrentUser || canPerformStaffActions) && (
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)} 
                                title="Delete Message"
                                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messageEndRef} />
            </div>

            {/* Typing status line */}
            {Object.keys(typingUsers).length > 0 && (
              <div className="px-6 py-1.5 text-xs text-slate-500 italic flex items-center gap-1.5 bg-slate-950/20 border-t border-slate-900 flex-shrink-0">
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse delay-75" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse delay-150" />
                </span>
                {Object.values(typingUsers).map(u => u.name).join(', ')} is typing...
              </div>
            )}

            {/* Input Composer area */}
            <div className="p-3 sm:p-4 bg-slate-900/60 border-t border-slate-800/80 flex-shrink-0">
              <form onSubmit={handleSubmitMessage} className="flex flex-col gap-3">
                {/* Thread reply bar */}
                {replyTo && (
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <CornerUpLeft className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                      <span className="font-semibold text-slate-300">Replying to {replyTo.senderName}:</span>
                      <span className="text-slate-400 truncate italic">"{replyTo.content}"</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setReplyTo(null)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Announcement promotion settings */}
                {isAnnouncement && (
                  <div className="p-3 bg-red-950/20 border border-rose-500/20 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs text-rose-400 font-bold">
                      <div className="flex items-center gap-1.5">
                        <Bell className="h-4 w-4 text-rose-400" />
                        <span>Creating official Class Announcement notice</span>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setIsAnnouncement(false)}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Enter Announcement Title (e.g. Schedule Update)..."
                      required
                      className="w-full bg-slate-950/80 border border-rose-500/20 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                      value={announcementTitle}
                      onChange={(e) => setAnnouncementTitle(e.target.value)}
                    />
                  </div>
                )}

                {/* Selected Attachments list */}
                {attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-full text-xs text-slate-300">
                        <FileText className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{file.name}</span>
                        <span className="text-[10px] text-slate-500">({formatBytes(file.size)})</span>
                        <button 
                          type="button" 
                          onClick={() => removeSelectedAttachment(i)}
                          className="hover:text-red-400 p-0.5 rounded-full"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Controls Bar */}
                <div className="flex items-center gap-2 w-full">
                  {/* File attach button */}
                  {!isRecording && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAttachments}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0"
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                  )}
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleAttachmentChange}
                  />

                  {/* Input Field / Recording controls */}
                  {isRecording ? (
                    <div className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-500/30 rounded-xl px-3 sm:px-4 py-2 text-red-400 text-xs gap-3 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                        <span className="font-medium truncate text-[11px] sm:text-xs">Recording voice message...</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        <span className="font-mono font-bold text-[10px] sm:text-xs">{formatTimer(recordingSeconds)}</span>
                        <button 
                          type="button" 
                          onClick={() => stopVoiceRecording(true)} 
                          title="Submit Audio File"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => stopVoiceRecording(false)} 
                          title="Cancel"
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-400"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder="Send a message to class..."
                      disabled={uploadingAttachments}
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 transition-colors min-w-0"
                    />
                  )}

                  {/* Mic Button */}
                  {!isRecording && (
                    <button
                      type="button"
                      onClick={startVoiceRecording}
                      disabled={uploadingAttachments}
                      title="Record Voice Note"
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors flex-shrink-0"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}

                  {/* Send Button */}
                  {!isRecording && (
                    <button
                      type="submit"
                      disabled={uploadingAttachments || (!messageText.trim() && attachments.length === 0)}
                      className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-slate-100 hover:from-cyan-500 hover:to-cyan-400 transition-all font-semibold flex items-center justify-center shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <Shield className="h-16 w-16 text-slate-700 mb-4" />
            <h3 className="text-lg font-bold text-slate-400 mb-1">Welcome to Aegis Group Discussion</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Select an academic class group discussion from the left sidebar to start collaborating with class students and subject teachers.
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT PANEL: CHAT INFO & OPERATIONAL CONTROLS ───────────────────── */}
      {selectedGroup && (
        <div className={`
          ${showRightPanelMobile ? 'flex fixed inset-y-0 right-0 z-50 w-full sm:w-80 border-l border-slate-800 bg-[#0c101f] animate-slide-in-right' : 'hidden'} 
          md:flex md:relative md:inset-auto md:z-auto md:w-80 md:bg-slate-900/60 flex-col h-full md:border-l md:border-slate-850
        `}>
          {/* Panel Tabs */}
          <div className="flex border-b border-slate-800/60 text-xs items-center bg-slate-950/20">
            <button
              onClick={() => setActiveRightTab('members')}
              className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider transition-colors ${
                activeRightTab === 'members' 
                  ? 'border-cyan-500 text-cyan-400 bg-slate-950/20' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Members
            </button>
            <button
              onClick={() => setActiveRightTab('files')}
              className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider transition-colors ${
                activeRightTab === 'files' 
                  ? 'border-cyan-500 text-cyan-400 bg-slate-950/20' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Files
            </button>
            <button
              onClick={() => setActiveRightTab('pins')}
              className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider transition-colors ${
                activeRightTab === 'pins' 
                  ? 'border-cyan-500 text-cyan-400 bg-slate-950/20' 
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Pins
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setShowRightPanelMobile(false)}
              className="md:hidden p-3 text-slate-400 hover:text-slate-100 hover:bg-slate-800/20 border-l border-slate-800/60 transition-colors flex-shrink-0"
              title="Close details panel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Tab contents */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-900/60 md:bg-transparent">
            {/* Members Tab */}
            {activeRightTab === 'members' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search members..."
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  {filteredMembers.map((member) => {
                    const isOnline = onlineUsers[member.userId] !== undefined;
                    const isMuted = member.mutedUntil && new Date(member.mutedUntil) > new Date();
                    const isPermMuted = member.isPermanentlyMuted;
                    
                    return (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-950/20 border border-slate-850 hover:bg-slate-950/40 transition-colors min-w-0 w-full gap-2">
                        <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                          {/* Online status wrapper */}
                          <div className="relative flex-shrink-0">
                            <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold border border-slate-700/60 overflow-hidden text-slate-300 relative">
                              {member.avatarUrl ? (
                                <img 
                                  src={member.avatarUrl} 
                                  alt={member.userFirst} 
                                  className="h-full w-full object-cover" 
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
                                    if (fallback) {
                                      (fallback as HTMLElement).style.display = 'flex';
                                    }
                                  }}
                                />
                              ) : null}
                              <span 
                                className="avatar-fallback animate-fade-in" 
                                style={{ display: member.avatarUrl ? 'none' : 'flex' }}
                              >
                                {getUserInitials(`${member.userFirst || ''} ${member.userLast || ''}`)}
                              </span>
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
                              isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                            }`} />
                          </div>

                          <div className="flex flex-col truncate min-w-0 flex-1">
                            <span className="text-xs truncate font-semibold block w-full">
                              {member.userFirst} {member.userLast}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold truncate block w-full">
                              {member.role}
                            </span>
                          </div>
                        </div>

                        {/* Mute controls for admin/staff roles */}
                        {canPerformStaffActions && member.role === 'STUDENT' && (
                          <div className="relative flex-shrink-0">
                            {isMuted || isPermMuted ? (
                              <button
                                onClick={() => handleUnmuteMember(member.userId)}
                                title="Unmute Student"
                                className="p-1 rounded bg-red-950/40 hover:bg-red-900/40 text-rose-400 border border-rose-500/20"
                              >
                                <VolumeX className="h-3.5 w-3.5 animate-pulse" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setMutingMemberId(mutingMemberId === member.id ? null : member.id)}
                                title="Mute Controls"
                                className="p-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-cyan-400"
                              >
                                <VolumeIcon className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {/* Dropdown controls for Mute minutes */}
                            {mutingMemberId === member.id && (
                              <div className="absolute right-0 top-6 mt-1 w-36 bg-slate-950 border border-slate-850 rounded-xl p-2 shadow-xl z-20 space-y-2">
                                <div className="text-[10px] font-bold text-slate-400 px-1">SELECT DURATION:</div>
                                <select 
                                  className="w-full bg-slate-900 border border-slate-800 text-xs py-1 rounded px-1.5"
                                  value={muteDuration}
                                  onChange={(e) => setMuteDuration(e.target.value)}
                                >
                                  <option value="15">15 Minutes</option>
                                  <option value="60">1 Hour</option>
                                  <option value="1440">24 Hours</option>
                                </select>
                                <div className="flex gap-1 justify-between pt-1">
                                  <button
                                    onClick={() => handleMuteMember(member.userId, false)}
                                    className="flex-1 py-1 rounded bg-cyan-600 text-slate-100 hover:bg-cyan-500 text-[10px] font-bold text-center"
                                  >
                                    Apply
                                  </button>
                                  <button
                                    onClick={() => handleMuteMember(member.userId, true)}
                                    className="flex-1 py-1 rounded bg-rose-600 text-slate-100 hover:bg-rose-500 text-[10px] font-bold text-center"
                                  >
                                    Perm
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Shared Files Tab */}
            {activeRightTab === 'files' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search shared files..."
                    className="w-full bg-slate-950/70 border border-slate-850 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  {sharedFiles.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No files shared in this chat workspace
                    </div>
                  ) : (
                    sharedFiles.map((file) => (
                      <div key={file.id} className="p-2.5 rounded-xl bg-slate-950/30 border border-slate-850 flex items-center justify-between gap-3 min-w-0 w-full">
                        <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                          <FileText className="h-4.5 w-4.5 text-cyan-400 flex-shrink-0" />
                          <div className="flex flex-col truncate min-w-0 flex-1">
                            <span className="text-xs truncate font-medium block w-full break-all" title={file.fileName}>{file.fileName}</span>
                            <span className="text-[9px] text-slate-500 flex-shrink-0">{formatBytes(file.fileSize)}</span>
                          </div>
                        </div>
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-slate-850 hover:bg-slate-750 text-slate-300 flex-shrink-0"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Pinned Messages Tab */}
            {activeRightTab === 'pins' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Pinned Messages List ({pinnedMessagesList.length})
                </h4>
                {pinnedMessagesList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No pinned messages in this class discussion
                  </div>
                ) : (
                  pinnedMessagesList.map((m) => (
                    <div key={m.id} className="p-3 bg-slate-950/30 border border-slate-850 rounded-xl relative space-y-2 break-words [overflow-wrap:anywhere] min-w-0 w-full">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                        <span className="font-semibold truncate">{m.senderName}</span>
                        <span className="font-mono flex-shrink-0">{new Date(m.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium break-words [overflow-wrap:anywhere]">
                        {m.content || 'Attachment Shared'}
                      </p>
                      {canPerformStaffActions && (
                        <button
                          onClick={() => handlePinMessage(m)}
                          className="text-[9px] text-rose-400 hover:text-rose-300 underline font-semibold flex items-center gap-1.5"
                        >
                          <Pin className="h-3 w-3 rotate-45" /> Unpin Message
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
      </div>{/* end inner flex container */}
    </FullScreenChatLayout>
  );
};
