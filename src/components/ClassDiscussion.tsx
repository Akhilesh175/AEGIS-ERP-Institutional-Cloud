import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  Send, Search, Paperclip, Pin, Bell, Mic,
  CornerUpLeft, Trash2, X, Download, FileText, Shield, Check,
  VolumeX, Volume2 as VolumeIcon, ChevronRight, Calendar,
  AlertCircle, FileSpreadsheet, ArrowLeft, Info,
  ArrowDown, CheckCheck, RefreshCw, Users, BookOpen, Clock,
} from 'lucide-react';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import {
  ClassChatGroup, ClassChatMember, ClassMessage, MessageStatus, UserRole,
} from '../types';
import { FullScreenChatLayout } from './FullScreenChatLayout';

// ─── Pure module-level helpers ────────────────────────────────────────────────

const getUserInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatTimer = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── Message Status Icon ──────────────────────────────────────────────────────

const MessageStatusIcon: React.FC<{ status?: MessageStatus }> = ({ status }) => {
  if (status === 'sending' || status === 'queued') {
    return (
      <Clock
        className="h-3 w-3 text-slate-500 animate-pulse"
        aria-label={status === 'queued' ? 'Queued (offline)' : 'Sending'}
      />
    );
  }
  if (status === 'failed') {
    return <AlertCircle className="h-3 w-3 text-rose-400" aria-label="Failed to send" />;
  }
  if (status === 'read') {
    return <CheckCheck className="h-3 w-3 text-cyan-400" aria-label="Read" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3 w-3 text-slate-400" aria-label="Delivered" />;
  }
  return <Check className="h-3 w-3 text-slate-400" aria-label="Sent" />;
};

// ─── MessageItem (React.memo — only re-renders when this message changes) ────

interface MessageItemProps {
  msg: ClassMessage;
  isCurrentUser: boolean;
  canPerformStaffActions: boolean;
  currentUserId: string;
  onReply: (msg: ClassMessage) => void;
  onPin: (msg: ClassMessage) => void;
  onDelete: (id: string) => void;
  onReact: (id: string, emoji: string, reacted: boolean) => void;
  onRetry: (msg: ClassMessage) => void;
  onPromoteAnnouncement: (msg: ClassMessage) => void;
}

const MessageItem = React.memo<MessageItemProps>(({
  msg, isCurrentUser, canPerformStaffActions, currentUserId,
  onReply, onPin, onDelete, onReact, onRetry, onPromoteAnnouncement,
}) => {
  const dateLabel = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });
  const isSystem = msg.messageType === 'SYSTEM';

  // ── System / Notice messages ──────────────────────────────────────────────
  if (isSystem) {
    const isHomework = msg.systemNoticeType === 'HOMEWORK' || msg.systemNoticeType === 'ASSIGNMENT';
    const isTimetable = msg.systemNoticeType === 'TIMETABLE';
    const Icon = isHomework ? BookOpen : isTimetable ? Calendar : AlertCircle;
    const iconColor = isHomework
      ? 'text-amber-400'
      : isTimetable
      ? 'text-blue-400'
      : 'text-cyan-400';

    return (
      <div className="flex justify-center my-2 px-4 w-full">
        <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-800/60 text-slate-400 px-4 py-1.5 rounded-full text-[11px] max-w-[85%] shadow-sm">
          <Icon className={`h-3 w-3 flex-shrink-0 ${iconColor}`} aria-hidden="true" />
          <span className="break-words [overflow-wrap:anywhere]">{msg.content}</span>
          <span className="text-[10px] text-slate-600 font-mono flex-shrink-0 ml-1">{dateLabel}</span>
        </div>
      </div>
    );
  }

  // ── Regular chat messages ─────────────────────────────────────────────────
  return (
    <div
      className={`flex gap-2 items-end max-w-[75%] ${
        isCurrentUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      } ${msg.status === 'failed' ? 'opacity-75' : ''}`}
    >
      {/* Avatar — self-end keeps it at bubble bottom like WhatsApp */}
      <div
        className="h-8 w-8 min-w-[32px] rounded-full bg-slate-800 flex-shrink-0 overflow-hidden border border-slate-700/60 flex items-center justify-center text-[10px] font-bold text-slate-300 self-end"
        aria-hidden="true"
      >
        {msg.senderAvatar ? (
          <img
            src={msg.senderAvatar}
            alt={msg.senderName ?? ''}
            className="h-full w-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fb = e.currentTarget.parentElement?.querySelector<HTMLElement>('.avatar-fallback');
              if (fb) fb.style.display = 'flex';
            }}
          />
        ) : null}
        <span
          className="avatar-fallback items-center justify-center w-full h-full"
          style={{ display: msg.senderAvatar ? 'none' : 'flex' }}
        >
          {getUserInitials(msg.senderName ?? '')}
        </span>
      </div>

      {/* Bubble column */}
      <div className="flex flex-col gap-1 min-w-0 max-w-full">
        {/* Meta row — flex-nowrap prevents wrapping on small screens */}
        <div
          className={`flex items-center gap-1.5 text-[11px] flex-nowrap overflow-hidden ${
            isCurrentUser ? 'flex-row-reverse' : ''
          }`}
        >
          <span className="font-semibold text-slate-300 truncate shrink min-w-0">
            {msg.senderName}
          </span>
          <span className="text-slate-500 font-mono text-[10px] flex-shrink-0">{dateLabel}</span>
          {msg.senderRole && (
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0 ${
                msg.senderRole.includes('ADMIN')
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/10'
                  : msg.senderRole.includes('TEACHER')
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/10'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {msg.senderRole}
            </span>
          )}
        </div>

        {/* Bubble — w-fit so short messages don't stretch full width */}
        <div
          className={`p-3 rounded-2xl relative group min-w-0 w-fit max-w-full box-border ${
            isCurrentUser
              ? 'bg-gradient-to-br from-cyan-600/70 to-blue-700/70 border border-cyan-500/35 rounded-br-sm text-slate-50'
              : 'bg-slate-900/90 border border-slate-800/80 rounded-bl-sm text-slate-200'
          }`}
        >
          {/* Thread reply anchor */}
          {msg.replyToMessageId && (
            <div
              className={`mb-2 p-2 rounded-xl text-[10px] border flex flex-col min-w-0 ${
                isCurrentUser
                  ? 'bg-cyan-950/40 border-cyan-800/30 text-cyan-300'
                  : 'bg-slate-950/60 border-slate-800/50 text-slate-400'
              }`}
            >
              <span className="font-semibold text-[9px] mb-0.5 uppercase tracking-wider flex-shrink-0">
                Replying to {msg.replyToSenderName}
              </span>
              <p className="truncate italic break-words [overflow-wrap:anywhere]">
                "{msg.replyToContent}"
              </p>
            </div>
          )}

          {/* Text content */}
          {msg.content && (
            <p className="text-sm whitespace-pre-wrap leading-relaxed break-words [overflow-wrap:anywhere] w-full">
              {msg.content}
            </p>
          )}

          {/* Attachments */}
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="mt-2 space-y-1.5 border-t border-slate-800/40 pt-2 min-w-0 w-full">
              {msg.attachments.map(att => {
                const isAudio =
                  att.fileType.startsWith('audio') || att.fileName.endsWith('.webm');
                return (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 p-2 rounded-xl bg-slate-950/40 border border-slate-800/65 w-full min-w-0 box-border overflow-hidden"
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0" aria-hidden="true">
                      {isAudio ? (
                        <VolumeIcon className="h-4 w-4 text-cyan-400" />
                      ) : (
                        <FileText className="h-4 w-4 text-cyan-400" />
                      )}
                    </div>
                    {/* Name + size */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p
                        className="text-xs font-medium truncate w-full"
                        title={att.fileName}
                      >
                        {att.fileName}
                      </p>
                      <p className="text-[10px] text-slate-500">{formatBytes(att.fileSize)}</p>
                    </div>
                    {/* Audio player or download button (fixed right) */}
                    {isAudio ? (
                      <audio
                        src={att.fileUrl}
                        controls
                        className="h-7 w-[130px] sm:w-[160px] flex-shrink-0"
                        aria-label={`Voice note: ${att.fileName}`}
                      />
                    ) : (
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        aria-label={`Download ${att.fileName}`}
                        className="flex-shrink-0 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center justify-center min-w-[32px] min-h-[32px]"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reactions */}
          {msg.reactions && msg.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {Object.entries(
                msg.reactions.reduce<Record<string, { count: number; users: string[] }>>(
                  (acc, curr) => {
                    if (!acc[curr.reaction]) acc[curr.reaction] = { count: 0, users: [] };
                    acc[curr.reaction].count += 1;
                    acc[curr.reaction].users.push(curr.userId);
                    return acc;
                  },
                  {}
                )
              ).map(([emoji, meta]) => {
                const didReact = meta.users.includes(currentUserId);
                return (
                  <button
                    key={emoji}
                    onClick={() => onReact(msg.id, emoji, didReact)}
                    aria-label={`${emoji} reaction — ${meta.count} ${didReact ? '(you reacted)' : ''}`}
                    className={`px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1 border transition-colors ${
                      didReact
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>{emoji}</span>
                    <span>{meta.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Status indicator — current user only */}
          {isCurrentUser && (
            <div className="flex justify-end mt-1">
              <MessageStatusIcon status={msg.status} />
            </div>
          )}

          {/* Hover action menu */}
          <div
            className={`absolute -top-8 opacity-0 group-hover:opacity-100 flex gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5 shadow-md transition-opacity z-10 ${
              isCurrentUser ? 'left-0' : 'right-0'
            }`}
            role="toolbar"
            aria-label="Message actions"
          >
            <button
              onClick={() => onReply(msg)}
              aria-label="Reply to message"
              title="Reply"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 min-w-[28px] min-h-[28px] flex items-center justify-center"
            >
              <CornerUpLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPin(msg)}
              aria-label={msg.pinnedBy ? 'Unpin message' : 'Pin message'}
              title={msg.pinnedBy ? 'Unpin' : 'Pin'}
              className={`p-1.5 rounded hover:bg-slate-800 min-w-[28px] min-h-[28px] flex items-center justify-center ${
                msg.pinnedBy ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <Pin className="h-3.5 w-3.5 rotate-45" aria-hidden="true" />
            </button>
            {canPerformStaffActions && (
              <button
                onClick={() => onPromoteAnnouncement(msg)}
                aria-label="Promote to class announcement"
                title="Promote to Announcement"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
            {(isCurrentUser || canPerformStaffActions) && (
              <button
                onClick={() => onDelete(msg.id)}
                aria-label="Delete message"
                title="Delete"
                className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-500 min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Retry bar — shown only for failed messages from current user */}
        {isCurrentUser && msg.status === 'failed' && (
          <button
            onClick={() => onRetry(msg)}
            aria-label="Retry sending this message"
            className="flex items-center gap-1.5 text-[11px] text-rose-400 hover:text-rose-300 self-end mt-0.5 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none rounded"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            Tap to retry
          </button>
        )}
      </div>
    </div>
  );
}, (prev, next) =>
  // Custom equality — skip re-render unless this specific message changed
  prev.msg.id === next.msg.id &&
  prev.msg.status === next.msg.status &&
  prev.msg.content === next.msg.content &&
  (prev.msg.reactions?.length ?? 0) === (next.msg.reactions?.length ?? 0) &&
  prev.msg.pinnedBy === next.msg.pinnedBy &&
  prev.isCurrentUser === next.isCurrentUser &&
  prev.canPerformStaffActions === next.canPerformStaffActions
);
MessageItem.displayName = 'MessageItem';

// ─── Main Component ───────────────────────────────────────────────────────────

interface ClassDiscussionProps {
  currentUserId: string;
  currentUserRole: UserRole;
  schoolId: string;
  academicSessionId: string;
}

export const ClassDiscussion: React.FC<ClassDiscussionProps> = ({
  currentUserId,
  currentUserRole,
  schoolId,
  academicSessionId,
}) => {
  // ── Group / Navigation ────────────────────────────────────────────────────
  const [groups, setGroups] = useState<ClassChatGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ClassChatGroup | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [members, setMembers] = useState<ClassChatMember[]>([]);
  const [messages, setMessages] = useState<ClassMessage[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Compose ───────────────────────────────────────────────────────────────
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<ClassMessage | null>(null);
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);

  // ── Mute controls ─────────────────────────────────────────────────────────
  const [mutingMemberId, setMutingMemberId] = useState<string | null>(null);
  const [muteDuration, setMuteDuration] = useState('15');

  // ── Search / Filter / Panels ──────────────────────────────────────────────
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [activeRightTab, setActiveRightTab] = useState<'members' | 'files' | 'pins'>('members');
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showRightPanelMobile, setShowRightPanelMobile] = useState(false);

  // ── Voice recording ───────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Realtime presence / broadcast ────────────────────────────────────────
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; timestamp: number }>>({});
  const presenceChannelRef = useRef<any>(null);
  const messageChannelRef = useRef<any>(null);

  // ── Smart scroll ──────────────────────────────────────────────────────────
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // ── Network / offline queue ───────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [offlineQueue, setOfflineQueue] = useState<ClassMessage[]>([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<ClassMessage[]>([]);        // stable closure for realtime
  const selectedGroupRef = useRef<ClassChatGroup | null>(null); // stable for interceptors
  const typingClearTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Current user profile ──────────────────────────────────────────────────
  const [currentUserProfile, setCurrentUserProfile] = useState<{
    first: string;
    last: string;
    avatar: string;
  } | null>(null);

  // ─── Keep stable refs in sync ──────────────────────────────────────────────
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { selectedGroupRef.current = selectedGroup; }, [selectedGroup]);

  // ─── Body class toggle (mobile CSS scope) ─────────────────────────────────
  useEffect(() => {
    document.body.classList.add('group-discussion-active');
    return () => document.body.classList.remove('group-discussion-active');
  }, []);

  // ─── Capture-phase back-button interceptor ────────────────────────────────
  useEffect(() => {
    const handleBackCapture = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#header-back-button')) return;
      if (selectedGroupRef.current !== null) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedGroup(null);
      }
    };
    document.addEventListener('click', handleBackCapture, true);
    return () => document.removeEventListener('click', handleBackCapture, true);
  }, []);

  // ─── Online / offline detection ────────────────────────────────────────────
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ─── Auto-flush offline queue when back online ─────────────────────────────
  useEffect(() => {
    if (!isOnline || offlineQueue.length === 0) return;
    const queue = [...offlineQueue];
    setOfflineQueue([]);
    queue.forEach(async (queuedMsg) => {
      if (!selectedGroupRef.current) return;
      try {
        const newMsg = await mockApi.submitClassChatMessage(
          schoolId,
          academicSessionId,
          selectedGroupRef.current.id,
          currentUserId,
          queuedMsg.content,
          [],
          queuedMsg.replyToMessageId ?? null,
          queuedMsg.messageType === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'CHAT',
          null
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.localId === queuedMsg.localId ? { ...newMsg, status: 'sent' as MessageStatus } : m
          )
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.localId === queuedMsg.localId ? { ...m, status: 'failed' as MessageStatus } : m
          )
        );
      }
    });
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load groups + user profile ────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        setLoadingGroups(true);
        const fetchedGroups = await mockApi.getClassChatGroups(
          schoolId, academicSessionId, currentUserId, currentUserRole
        );
        setGroups(fetchedGroups);

        const { data: uData } = await supabase
          .from('users')
          .select('first_name, last_name, avatar_url')
          .eq('id', currentUserId)
          .single();
        if (uData) {
          setCurrentUserProfile({
            first: uData.first_name || '',
            last: uData.last_name || '',
            avatar: uData.avatar_url || '',
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

  // ─── Load selected group + Supabase Realtime ──────────────────────────────
  useEffect(() => {
    if (!selectedGroup) {
      setMessages([]);
      setMembers([]);
      setReplyTo(null);
      setUnreadCount(0);
      setIsAtBottom(true);
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      if (messageChannelRef.current) messageChannelRef.current.unsubscribe();
      return;
    }

    const loadGroupDetails = async () => {
      try {
        setLoadingMessages(true);
        const groupMembers = await mockApi.getClassChatMembers(
          schoolId, academicSessionId, selectedGroup.id
        );
        setMembers(groupMembers);

        const chatMessages = await mockApi.getClassMessages(
          schoolId, academicSessionId, selectedGroup.id, 100, 0
        );
        setMessages(chatMessages);
      } catch (err) {
        console.error('Error loading group discussion contents:', err);
      } finally {
        setLoadingMessages(false);
        setTimeout(() => {
          messageEndRef.current?.scrollIntoView({ behavior: 'auto' });
          setIsAtBottom(true);
          setUnreadCount(0);
        }, 100);
      }
    };

    loadGroupDetails();

    // ── Presence + broadcast channel ──────────────────────────────────────
    const channelName = `group-chat:${selectedGroup.id}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });
    presenceChannelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const active: Record<string, any> = {};
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any[];
          if (presences && presences.length > 0) active[key] = presences[0];
        });
        setOnlineUsers(active);
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === currentUserId) return;
        setTypingUsers((prev) => ({
          ...prev,
          [payload.userId]: { name: payload.name, timestamp: Date.now() },
        }));
        // Auto-clear typing indicator 3 s after last event from this user
        clearTimeout(typingClearTimers.current[payload.userId]);
        typingClearTimers.current[payload.userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[payload.userId];
            return next;
          });
        }, 3000);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUserProfile) {
          await channel.track({
            userId: currentUserId,
            name: `${currentUserProfile.first} ${currentUserProfile.last}`.trim(),
            avatarUrl: currentUserProfile.avatar,
            role: currentUserRole,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    // ── Postgres changes — other users' messages only ──────────────────────
    const messagesChannel = supabase
      .channel(`table-changes:${selectedGroup.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'class_messages',
          filter: `group_id=eq.${selectedGroup.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // Current user's messages are handled via optimistic send — skip
            if ((payload.new as any).sender_id === currentUserId) return;

            // Deduplication using stable ref (avoids stale closure bug)
            if (messagesRef.current.some((m) => m.id === payload.new.id)) return;

            const fetchedList = await mockApi.getClassMessages(
              schoolId, academicSessionId, selectedGroup.id, 10, 0
            );
            const fresh = fetchedList.find((m: ClassMessage) => m.id === payload.new.id);
            if (!fresh) return;

            setMessages((prev) => {
              if (prev.some((m) => m.id === fresh.id)) return prev;
              return [...prev, fresh];
            });

            // Smart scroll: only auto-scroll if user is already at bottom
            setIsAtBottom((atBottom) => {
              if (atBottom) {
                setTimeout(() =>
                  messageEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50
                );
              } else {
                setUnreadCount((c) => c + 1);
              }
              return atBottom;
            });
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          } else if (payload.eventType === 'UPDATE') {
            const fetchedList = await mockApi.getClassMessages(
              schoolId, academicSessionId, selectedGroup.id, 10, 0
            );
            const updated = fetchedList.find((m: ClassMessage) => m.id === payload.new.id);
            if (updated) {
              setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
          }
        }
      )
      .subscribe();

    messageChannelRef.current = messagesChannel;

    return () => {
      channel.unsubscribe();
      messagesChannel.unsubscribe();
      Object.values(typingClearTimers.current).forEach(clearTimeout);
      typingClearTimers.current = {};
    };
  }, [selectedGroup, schoolId, academicSessionId, currentUserId, currentUserRole, currentUserProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Smart scroll handler ─────────────────────────────────────────────────
  const handleMessagesScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    setIsAtBottom(atBottom);
    if (atBottom) setUnreadCount(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsAtBottom(true);
    setUnreadCount(0);
  }, []);

  // ─── Typing indicator broadcast ───────────────────────────────────────────
  const handleKeyDown = useCallback(() => {
    if (!presenceChannelRef.current || !currentUserProfile || !selectedGroup) return;
    presenceChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUserId,
        name: `${currentUserProfile.first} ${currentUserProfile.last}`.trim(),
      },
    });
  }, [currentUserId, currentUserProfile, selectedGroup]);

  // ─── Attachment handlers ──────────────────────────────────────────────────
  const handleAttachmentChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
      }
    },
    []
  );

  const removeSelectedAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ─── Voice recording ──────────────────────────────────────────────────────
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
        const voiceFile = new File(
          [audioBlob],
          `voice_note_${Date.now()}.webm`,
          { type: 'audio/webm' }
        );
        setUploadingAttachments(true);
        try {
          const uploaded = await mockApi.uploadClassChatAttachment(
            schoolId, selectedGroup!.classId, voiceFile
          );
          const voiceMsg = await mockApi.submitClassChatMessage(
            schoolId, academicSessionId, selectedGroup!.id, currentUserId,
            null, [uploaded], replyTo ? replyTo.id : null, 'CHAT', null
          );
          setMessages((prev) => [...prev, { ...voiceMsg, status: 'sent' as MessageStatus }]);
          setReplyTo(null);
          scrollToBottom();
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
      recordingTimerRef.current = setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000
      );
    } catch {
      alert('Unable to access microphone for voice message recording.');
    }
  };

  const stopVoiceRecording = (submit = true) => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorder && isRecording) {
      if (!submit) {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
      }
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  // ─── Send message (optimistic) ────────────────────────────────────────────
  const handleSubmitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || (!messageText.trim() && attachments.length === 0)) return;

    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const contentToSend = messageText.trim();
    const attachmentsToSend = [...attachments];
    const replyToSnapshot = replyTo;
    const isAnnouncementSnapshot = isAnnouncement;
    const announcementTitleSnapshot = announcementTitle;

    // Build optimistic message for immediate UI feedback
    const optimistic: ClassMessage = {
      id: localId,
      localId,
      status: 'sending' as MessageStatus,
      senderId: currentUserId,
      senderName: currentUserProfile
        ? `${currentUserProfile.first} ${currentUserProfile.last}`.trim()
        : 'You',
      senderAvatar: currentUserProfile?.avatar,
      senderRole: currentUserRole,
      content: contentToSend || null,
      messageType: isAnnouncementSnapshot ? 'ANNOUNCEMENT' : 'CHAT',
      groupId: selectedGroup.id,
      schoolId,
      academicSessionId,
      createdAt: new Date().toISOString(),
      editedAt: null,
      deletedAt: null,
      attachments: [],
      reactions: [],
      replyToMessageId: replyToSnapshot?.id ?? null,
      replyToSenderName: replyToSnapshot?.senderName ?? null,
      replyToContent: replyToSnapshot?.content ?? null,
    };

    // If offline, queue for later
    if (!isOnline) {
      setOfflineQueue((prev) => [...prev, optimistic]);
      setMessages((prev) => [...prev, { ...optimistic, status: 'queued' as MessageStatus }]);
      setMessageText('');
      setReplyTo(null);
      setAttachments([]);
      return;
    }

    // Optimistic insert + reset form
    setMessages((prev) => [...prev, optimistic]);
    setMessageText('');
    setReplyTo(null);
    setAttachments([]);
    setIsAnnouncement(false);
    setAnnouncementTitle('');
    scrollToBottom();

    setUploadingAttachments(true);
    try {
      // Upload any files first
      const uploadedAttachments: any[] = [];
      for (const file of attachmentsToSend) {
        const res = await mockApi.uploadClassChatAttachment(
          schoolId, selectedGroup.classId, file
        );
        uploadedAttachments.push(res);
      }

      // Persist to database
      const newMsg = await mockApi.submitClassChatMessage(
        schoolId,
        academicSessionId,
        selectedGroup.id,
        currentUserId,
        contentToSend || null,
        uploadedAttachments,
        replyToSnapshot ? replyToSnapshot.id : null,
        isAnnouncementSnapshot ? 'ANNOUNCEMENT' : 'CHAT',
        null
      );

      // Replace optimistic entry with the real persisted message
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.localId !== localId);
        if (filtered.some((m) => m.id === newMsg.id)) return filtered;
        return [...filtered, { ...newMsg, status: 'sent' as MessageStatus }];
      });

      // Create announcement record if needed
      if (isAnnouncementSnapshot && announcementTitleSnapshot.trim()) {
        await mockApi.setClassAnnouncement(
          schoolId, academicSessionId, selectedGroup.id,
          newMsg.id, announcementTitleSnapshot.trim()
        );
      }
    } catch (err: any) {
      // Mark optimistic entry as failed so user can retry
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === localId ? { ...m, status: 'failed' as MessageStatus } : m
        )
      );
      console.error('Failed to send message:', err);
    } finally {
      setUploadingAttachments(false);
    }
  };

  // ─── Retry failed message ─────────────────────────────────────────────────
  const handleRetry = useCallback(
    async (failedMsg: ClassMessage) => {
      if (!selectedGroup || !failedMsg.localId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.localId === failedMsg.localId ? { ...m, status: 'sending' as MessageStatus } : m
        )
      );
      try {
        const newMsg = await mockApi.submitClassChatMessage(
          schoolId, academicSessionId, selectedGroup.id, currentUserId,
          failedMsg.content, [], failedMsg.replyToMessageId ?? null,
          failedMsg.messageType === 'ANNOUNCEMENT' ? 'ANNOUNCEMENT' : 'CHAT', null
        );
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.localId !== failedMsg.localId);
          if (filtered.some((m) => m.id === newMsg.id)) return filtered;
          return [...filtered, { ...newMsg, status: 'sent' as MessageStatus }];
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.localId === failedMsg.localId ? { ...m, status: 'failed' as MessageStatus } : m
          )
        );
      }
    },
    [selectedGroup, schoolId, academicSessionId, currentUserId]
  );

  // ─── Pin message ──────────────────────────────────────────────────────────
  const handlePinMessage = useCallback(
    async (msg: ClassMessage) => {
      if (!selectedGroup) return;
      try {
        await mockApi.setClassPinnedMessage(
          schoolId, academicSessionId, selectedGroup.id,
          msg.id, currentUserId, msg.pinnedBy === undefined
        );
        const refreshed = await mockApi.getClassMessages(
          schoolId, academicSessionId, selectedGroup.id, 100, 0
        );
        setMessages(refreshed);
      } catch (err: any) {
        alert('Failed to update pinned state: ' + err.message);
      }
    },
    [selectedGroup, schoolId, academicSessionId, currentUserId]
  );

  // ─── Delete message ───────────────────────────────────────────────────────
  const handleDeleteMessage = useCallback(
    async (msgId: string) => {
      if (!selectedGroup) return;
      if (!confirm('Are you sure you want to delete this message?')) return;
      try {
        await mockApi.deleteClassChatMessage(
          schoolId, academicSessionId, msgId, currentUserId, currentUserRole
        );
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
      } catch (err: any) {
        alert('Failed to delete message: ' + err.message);
      }
    },
    [selectedGroup, schoolId, academicSessionId, currentUserId, currentUserRole]
  );

  // ─── Emoji reaction ───────────────────────────────────────────────────────
  const handleAddReaction = useCallback(
    async (msgId: string, reaction: string, currentlyReacted: boolean) => {
      if (!selectedGroup) return;
      try {
        await mockApi.setClassMessageReaction(
          schoolId, academicSessionId, msgId, currentUserId, reaction, currentlyReacted
        );
        const refreshed = await mockApi.getClassMessages(
          schoolId, academicSessionId, selectedGroup.id, 100, 0
        );
        setMessages(refreshed);
      } catch (err: any) {
        console.error('Failed to toggle reaction:', err);
      }
    },
    [selectedGroup, schoolId, academicSessionId, currentUserId]
  );

  // ─── Mute / Unmute member ─────────────────────────────────────────────────
  const handleMuteMember = async (memberUserId: string, permanent: boolean) => {
    if (!selectedGroup) return;
    try {
      const minutes = parseInt(muteDuration, 10);
      await mockApi.muteStudentInClassGroup(
        schoolId, academicSessionId, selectedGroup.id, memberUserId, minutes, permanent
      );
      alert(
        permanent
          ? 'Student is now permanently muted.'
          : `Student is muted for ${minutes} minutes.`
      );
      const groupMembers = await mockApi.getClassChatMembers(
        schoolId, academicSessionId, selectedGroup.id
      );
      setMembers(groupMembers);
      setMutingMemberId(null);
    } catch (err: any) {
      alert('Failed to mute member: ' + err.message);
    }
  };

  const handleUnmuteMember = async (memberUserId: string) => {
    if (!selectedGroup) return;
    try {
      await mockApi.muteStudentInClassGroup(
        schoolId, academicSessionId, selectedGroup.id, memberUserId, 0, false
      );
      alert('Student is now unmuted.');
      const groupMembers = await mockApi.getClassChatMembers(
        schoolId, academicSessionId, selectedGroup.id
      );
      setMembers(groupMembers);
    } catch (err: any) {
      alert('Failed to unmute student: ' + err.message);
    }
  };

  // ─── Export CSV ────────────────────────────────────────────────────────────
  const handleExportCSV = async () => {
    if (!selectedGroup) return;
    try {
      const csvData = await mockApi.exportClassDiscussionHistory(
        schoolId, academicSessionId, selectedGroup.id
      );
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `${selectedGroup.name.replace(/\s+/g, '_')}_history.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Export failed: ' + err.message);
    }
  };

  // ─── useCallback handlers passed to MessageItem ───────────────────────────
  const handleReply = useCallback((msg: ClassMessage) => setReplyTo(msg), []);

  const handlePromoteAnnouncement = useCallback((msg: ClassMessage) => {
    setIsAnnouncement(true);
    setMessageText(`📢 Announcement: "${msg.content || 'Attached File'}"`);
    setAnnouncementTitle(`Notice - ${new Date().toLocaleDateString()}`);
  }, []);

  // ─── Memoized derived data ─────────────────────────────────────────────────
  const filteredGroups = useMemo(
    () => groups.filter((g) => g.name.toLowerCase().includes(groupSearch.toLowerCase())),
    [groups, groupSearch]
  );

  const filteredMessages = useMemo(() => {
    if (!messageSearchQuery) return messages;
    const q = messageSearchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        (m.content && m.content.toLowerCase().includes(q)) ||
        (m.senderName && m.senderName.toLowerCase().includes(q)) ||
        m.attachments?.some((a) => a.fileName.toLowerCase().includes(q)) ||
        (m.systemNoticeType && m.systemNoticeType.toLowerCase().includes(q)) ||
        m.messageType.toLowerCase().includes(q)
    );
  }, [messages, messageSearchQuery]);

  const sharedFiles = useMemo(
    () =>
      messages
        .flatMap((m) => m.attachments ?? [])
        .filter((f) => f.fileName.toLowerCase().includes(fileSearchQuery.toLowerCase())),
    [messages, fileSearchQuery]
  );

  const pinnedMessagesList = useMemo(
    () => messages.filter((m) => m.pinnedBy !== undefined),
    [messages]
  );

  const activeAnnouncement = useMemo(
    () => messages.find((m) => m.messageType === 'ANNOUNCEMENT'),
    [messages]
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        const fullName = `${m.userFirst ?? ''} ${m.userLast ?? ''}`.toLowerCase();
        return (
          fullName.includes(memberSearchQuery.toLowerCase()) ||
          m.role.toLowerCase().includes(memberSearchQuery.toLowerCase())
        );
      }),
    [members, memberSearchQuery]
  );

  const canPerformStaffActions = useMemo(
    () =>
      ['ADMIN', 'TEACHER', 'CLASS_TEACHER', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(
        currentUserRole
      ),
    [currentUserRole]
  );

  // ─── JSX ───────────────────────────────────────────────────────────────────
  return (
    <FullScreenChatLayout>
      {/* Inner flex container */}
      <div className="flex w-full h-full overflow-hidden text-slate-100 relative">

        {/* ── LEFT PANEL: GROUP LIST ──────────────────────────────────────── */}
        <div
          className={`w-full md:w-80 border-r border-slate-800/60 bg-slate-900/60 flex flex-col h-full ${
            selectedGroup ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search */}
          <div className="p-4 border-b border-slate-800/60 flex-shrink-0">
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                placeholder="Search active groups..."
                aria-label="Search active groups"
                className="w-full bg-slate-950/50 border border-slate-800/80 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus-visible:ring-2 focus-visible:ring-cyan-500/50 transition-colors"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Groups list */}
          <div
            className="flex-1 overflow-y-auto p-2 space-y-1"
            role="list"
            aria-label="Discussion groups"
          >
            {loadingGroups ? (
              <div
                className="flex items-center justify-center py-10 space-x-2 text-slate-400"
                role="status"
              >
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-cyan-500" aria-hidden="true" />
                <span className="text-sm">Loading discussion groups...</span>
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center py-10 text-sm text-slate-500">
                No active discussion groups found
              </div>
            ) : (
              filteredGroups.map((g) => {
                const isSelected = selectedGroup?.id === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGroup(g)}
                    role="listitem"
                    aria-selected={isSelected}
                    aria-label={`Open ${g.name} group discussion`}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all duration-200 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-600/30 to-blue-600/10 border-l-4 border-cyan-400 shadow-md bg-slate-800/40'
                        : 'hover:bg-slate-800/20 hover:text-slate-200 text-slate-300'
                    }`}
                  >
                    {/* Group avatar */}
                    <div
                      className="h-12 w-12 min-w-[48px] rounded-full bg-gradient-to-br from-cyan-600/30 to-blue-700/30 flex items-center justify-center flex-shrink-0 border border-cyan-500/20"
                      aria-hidden="true"
                    >
                      <Users className="h-5 w-5 text-cyan-400" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between min-w-0">
                        <span className="font-semibold text-sm truncate pr-1">{g.name}</span>
                        <ChevronRight
                          className={`h-4 w-4 text-slate-500 flex-shrink-0 transition-transform ${
                            isSelected ? 'rotate-90 text-cyan-400' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      <span className="text-xs text-slate-500 block mt-0.5">
                        Class Discussion Group
                      </span>
                      {/* Member / active count — shown only once group data loaded */}
                      {isSelected && members.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500">
                          <Users className="h-3 w-3" aria-hidden="true" />
                          <span>{members.length} members</span>
                          {Object.keys(onlineUsers).length > 0 && (
                            <>
                              <span aria-hidden="true">•</span>
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block"
                                aria-hidden="true"
                              />
                              <span>{Object.keys(onlineUsers).length} active now</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── MIDDLE PANEL: CHAT WORKSPACE ────────────────────────────────── */}
        <div
          className={`flex-1 flex flex-col bg-slate-950/35 h-full relative border-r border-slate-800/40 min-w-0 overflow-hidden ${
            selectedGroup ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedGroup ? (
            <>
              {/* ── Chat Header — 2-row mobile layout ──────────────────── */}
              <div className="px-3 py-2 md:px-6 md:py-4 bg-slate-900/40 border-b border-slate-800/60 flex flex-col gap-2 min-w-0 w-full flex-shrink-0">
                {/* Row 1: Back + Group Name + Active + Info */}
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setSelectedGroup(null)}
                    aria-label="Back to Group List"
                    className="md:hidden flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-slate-400 hover:text-slate-100 hover:bg-slate-800/40 rounded-xl transition-all duration-200 border border-slate-800/60 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                  </button>

                  <div className="flex-1 min-w-0 overflow-hidden">
                    <h2 className="text-sm md:text-lg font-bold text-slate-100 truncate leading-tight flex items-center gap-2">
                      <span className="truncate">{selectedGroup.name}</span>
                      {canPerformStaffActions && (
                        <span className="text-[10px] md:text-xs px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-medium flex-shrink-0">
                          Staff
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span>{Object.keys(onlineUsers).length} active</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowRightPanelMobile((p) => !p)}
                    aria-label="Discussion Details"
                    aria-expanded={showRightPanelMobile}
                    className="md:hidden flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/30 text-slate-300 transition-all flex-shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <Info className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                  </button>
                </div>

                {/* Row 2: Export History + Search — overflow-x-auto prevents wrapping */}
                <div className="flex items-center gap-2 min-w-0 overflow-x-auto scrollbar-none">
                  <button
                    onClick={handleExportCSV}
                    aria-label="Export discussion history as CSV"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/30 text-slate-300 text-xs font-semibold flex-shrink-0 min-h-[36px] transition-all focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                    <span>Export History</span>
                  </button>
                  <div className="relative flex-1 min-w-0" style={{ minWidth: '120px' }}>
                    <Search
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      placeholder="Search in chat..."
                      aria-label="Search messages"
                      className="w-full bg-slate-950/70 border border-slate-800/80 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 focus-visible:ring-2 focus-visible:ring-cyan-500/50 transition-colors min-h-[36px]"
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Pinned strip */}
              {pinnedMessagesList.length > 0 && (
                <div className="px-4 py-2 bg-gradient-to-r from-amber-600/10 to-amber-900/5 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-300/90 font-medium min-w-0 flex-shrink-0">
                  <div className="flex items-center gap-2 truncate min-w-0">
                    <Pin className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 rotate-45" aria-hidden="true" />
                    <span className="truncate">
                      Pinned: "
                      {pinnedMessagesList[pinnedMessagesList.length - 1].content ||
                        'Attachment Shared'}
                      "
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setActiveRightTab('pins');
                      setShowRightPanelMobile(true);
                    }}
                    aria-label={`View all ${pinnedMessagesList.length} pinned messages`}
                    className="hover:underline text-[10px] text-amber-400 flex-shrink-0 ml-2 uppercase tracking-wider font-bold focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none rounded"
                  >
                    View All ({pinnedMessagesList.length})
                  </button>
                </div>
              )}

              {/* Announcement strip */}
              {activeAnnouncement && (
                <div
                  className="px-4 py-2 bg-gradient-to-r from-red-600/10 to-rose-950/5 border-b border-rose-500/25 flex items-center gap-2.5 text-xs text-rose-300 min-w-0 flex-shrink-0"
                  role="alert"
                >
                  <Bell className="h-3.5 w-3.5 text-rose-400 flex-shrink-0 animate-bounce" aria-hidden="true" />
                  <span className="font-semibold text-rose-400 flex-shrink-0">
                    Class Announcement:
                  </span>
                  <span className="truncate">{activeAnnouncement.content}</span>
                </div>
              )}

              {/* Messages pane */}
              <div
                ref={messagesContainerRef}
                onScroll={handleMessagesScroll}
                id="gd-messages-pane"
                className="gd-messages-pane flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 space-y-3 relative"
                role="log"
                aria-label="Class discussion messages"
                aria-live="polite"
                aria-relevant="additions"
              >
                {loadingMessages ? (
                  <div
                    className="flex flex-col items-center justify-center py-20 space-y-2 text-slate-400"
                    role="status"
                  >
                    <span
                      className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500"
                      aria-hidden="true"
                    />
                    <span className="text-sm">Fetching discussion thread...</span>
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 text-xs sm:text-sm">
                    {messageSearchQuery
                      ? 'No messages match search filters.'
                      : 'No messages in this class group yet. Type below to begin!'}
                  </div>
                ) : (
                  filteredMessages.map((msg) => (
                    <MessageItem
                      key={msg.localId ?? msg.id}
                      msg={msg}
                      isCurrentUser={msg.senderId === currentUserId}
                      canPerformStaffActions={canPerformStaffActions}
                      currentUserId={currentUserId}
                      onReply={handleReply}
                      onPin={handlePinMessage}
                      onDelete={handleDeleteMessage}
                      onReact={handleAddReaction}
                      onRetry={handleRetry}
                      onPromoteAnnouncement={handlePromoteAnnouncement}
                    />
                  ))
                )}
                <div ref={messageEndRef} aria-hidden="true" />

                {/* New Messages floating indicator */}
                {!isAtBottom && unreadCount > 0 && (
                  <button
                    onClick={scrollToBottom}
                    aria-label={`${unreadCount} new message${unreadCount > 1 ? 's' : ''} — scroll to bottom`}
                    className="absolute bottom-4 left-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-600 text-white text-xs font-semibold shadow-lg hover:bg-cyan-500 transition-all animate-bounce-subtle focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
                    style={{ transform: 'translateX(-50%)' }}
                  >
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    {unreadCount} new message{unreadCount > 1 ? 's' : ''}
                  </button>
                )}
              </div>

              {/* Typing indicator */}
              {Object.keys(typingUsers).length > 0 && (
                <div
                  className="px-4 py-1.5 text-xs text-slate-500 italic flex items-center gap-1.5 bg-slate-950/20 border-t border-slate-900 flex-shrink-0"
                  role="status"
                  aria-live="polite"
                  aria-label="Typing indicator"
                >
                  <span className="flex gap-1 items-center" aria-hidden="true">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse delay-75" />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse delay-150" />
                  </span>
                  {Object.values(typingUsers)
                    .map((u) => u.name)
                    .join(', ')}{' '}
                  {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...
                </div>
              )}

              {/* Offline banner */}
              {!isOnline && (
                <div
                  className="px-4 py-2 bg-amber-600/20 border-t border-amber-500/30 text-xs text-amber-300 text-center flex-shrink-0"
                  role="alert"
                >
                  You're offline — messages will be sent when connection restores.
                </div>
              )}

              {/* Input Composer */}
              <div
                id="gd-composer"
                className="px-3 py-3 sm:px-4 bg-slate-900/60 border-t border-slate-800/80 flex-shrink-0"
              >
                <form onSubmit={handleSubmitMessage} className="flex flex-col gap-2">
                  {/* Reply bar */}
                  {replyTo && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <CornerUpLeft className="h-4 w-4 text-cyan-400 flex-shrink-0" aria-hidden="true" />
                        <span className="font-semibold text-slate-300 flex-shrink-0">
                          Replying to {replyTo.senderName}:
                        </span>
                        <span className="text-slate-400 truncate italic">"{replyTo.content}"</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        aria-label="Cancel reply"
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 flex-shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}

                  {/* Announcement settings */}
                  {isAnnouncement && (
                    <div className="p-3 bg-red-950/20 border border-rose-500/20 rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-xs text-rose-400 font-bold">
                        <div className="flex items-center gap-1.5">
                          <Bell className="h-4 w-4 text-rose-400" aria-hidden="true" />
                          <span>Creating official Class Announcement notice</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAnnouncement(false)}
                          aria-label="Cancel announcement"
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Enter Announcement Title (e.g. Schedule Update)..."
                        required
                        aria-label="Announcement title"
                        className="w-full bg-slate-950/80 border border-rose-500/20 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                      />
                    </div>
                  )}

                  {/* Selected attachments preview */}
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {attachments.map((file, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-950/60 border border-slate-800 rounded-full text-xs text-slate-300"
                        >
                          <FileText className="h-3.5 w-3.5 text-cyan-400 flex-shrink-0" aria-hidden="true" />
                          <span className="truncate max-w-[100px]">{file.name}</span>
                          <span className="text-[10px] text-slate-500">
                            ({formatBytes(file.size)})
                          </span>
                          <button
                            type="button"
                            onClick={() => removeSelectedAttachment(i)}
                            aria-label={`Remove ${file.name}`}
                            className="hover:text-red-400 p-0.5 rounded-full"
                          >
                            <X className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Controls bar */}
                  <div className="flex items-center gap-2 w-full">
                    {/* Attach */}
                    {!isRecording && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingAttachments}
                        aria-label="Attach file"
                        className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none disabled:opacity-50"
                      >
                        <Paperclip className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}
                    <input
                      type="file"
                      multiple
                      ref={fileInputRef}
                      className="hidden"
                      aria-hidden="true"
                      onChange={handleAttachmentChange}
                    />

                    {/* Text input or recording indicator */}
                    {isRecording ? (
                      <div
                        className="flex-1 flex items-center justify-between bg-red-950/20 border border-red-500/30 rounded-xl px-3 py-2 text-red-400 text-xs gap-3 min-w-0"
                        role="status"
                        aria-live="polite"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2 w-2 rounded-full bg-red-500 animate-ping flex-shrink-0"
                            aria-hidden="true"
                          />
                          <span className="font-medium truncate">
                            Recording voice message...
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className="font-mono font-bold text-xs"
                            aria-label={`Recording time: ${formatTimer(recordingSeconds)}`}
                          >
                            {formatTimer(recordingSeconds)}
                          </span>
                          <button
                            type="button"
                            onClick={() => stopVoiceRecording(true)}
                            aria-label="Stop and send voice message"
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 min-w-[28px] min-h-[28px] flex items-center justify-center"
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => stopVoiceRecording(false)}
                            aria-label="Cancel voice recording"
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 min-w-[28px] min-h-[28px] flex items-center justify-center"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        placeholder="Send a message to class..."
                        aria-label="Message input"
                        disabled={uploadingAttachments}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 focus-visible:ring-2 focus-visible:ring-cyan-500/50 transition-colors min-w-0 min-h-[44px]"
                      />
                    )}

                    {/* Mic */}
                    {!isRecording && (
                      <button
                        type="button"
                        onClick={startVoiceRecording}
                        disabled={uploadingAttachments}
                        aria-label="Record voice note"
                        className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none disabled:opacity-50"
                      >
                        <Mic className="h-5 w-5" aria-hidden="true" />
                      </button>
                    )}

                    {/* Send */}
                    {!isRecording && (
                      <button
                        type="submit"
                        disabled={
                          uploadingAttachments ||
                          (!messageText.trim() && attachments.length === 0)
                        }
                        aria-label="Send message"
                        className="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 text-slate-100 hover:from-cyan-500 hover:to-cyan-400 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
                      >
                        {uploadingAttachments ? (
                          <span
                            className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"
                            aria-hidden="true"
                          />
                        ) : (
                          <Send className="h-5 w-5" aria-hidden="true" />
                        )}
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <Shield className="h-16 w-16 text-slate-700 mb-4" aria-hidden="true" />
              <h3 className="text-lg font-bold text-slate-400 mb-1">
                Welcome to Aegis Group Discussion
              </h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Select an academic class group discussion from the left sidebar to start
                collaborating with class students and subject teachers.
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT PANEL: CHAT INFO ─────────────────────────────────────── */}
        {selectedGroup && (
          <div
            className={`
              ${
                showRightPanelMobile
                  ? 'flex fixed inset-y-0 right-0 z-50 w-full sm:w-80 border-l border-slate-800 bg-[#0c101f] animate-slide-in-right'
                  : 'hidden'
              }
              md:flex md:relative md:inset-auto md:z-auto md:w-80 md:bg-slate-900/60 flex-col h-full md:border-l md:border-slate-800/60
            `}
          >
            {/* Panel Tabs */}
            <div
              className="flex border-b border-slate-800/60 text-xs items-center bg-slate-950/20 flex-shrink-0"
              role="tablist"
            >
              {(['members', 'files', 'pins'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveRightTab(tab)}
                  role="tab"
                  aria-selected={activeRightTab === tab}
                  aria-label={`${tab} tab`}
                  className={`flex-1 py-3 text-center border-b-2 font-bold uppercase tracking-wider transition-colors focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:outline-none ${
                    activeRightTab === tab
                      ? 'border-cyan-500 text-cyan-400 bg-slate-950/20'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              <button
                onClick={() => setShowRightPanelMobile(false)}
                aria-label="Close details panel"
                className="md:hidden p-3 text-slate-400 hover:text-slate-100 hover:bg-slate-800/20 border-l border-slate-800/60 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Tab contents */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-900/60 md:bg-transparent">

              {/* Members Tab */}
              {activeRightTab === 'members' && (
                <div className="space-y-4" role="tabpanel" aria-label="Members">
                  <div className="relative">
                    <Search
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      placeholder="Search members..."
                      aria-label="Search members"
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2" role="list">
                    {filteredMembers.map((member) => {
                      const isOnline = onlineUsers[member.userId] !== undefined;
                      const isMuted =
                        member.mutedUntil && new Date(member.mutedUntil) > new Date();
                      const isPermMuted = member.isPermanentlyMuted;

                      return (
                        <div
                          key={member.id}
                          role="listitem"
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-950/20 border border-slate-800 hover:bg-slate-950/40 transition-colors min-w-0 w-full gap-2"
                        >
                          <div className="flex items-center gap-2.5 truncate min-w-0 flex-1">
                            <div className="relative flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold border border-slate-700/60 overflow-hidden text-slate-300">
                                {member.avatarUrl ? (
                                  <img
                                    src={member.avatarUrl}
                                    alt={`${member.userFirst} ${member.userLast}`}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fb = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                                        '.avatar-fallback'
                                      );
                                      if (fb) fb.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <span
                                  className="avatar-fallback items-center justify-center w-full h-full"
                                  style={{ display: member.avatarUrl ? 'none' : 'flex' }}
                                >
                                  {getUserInitials(
                                    `${member.userFirst ?? ''} ${member.userLast ?? ''}`
                                  )}
                                </span>
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 ${
                                  isOnline ? 'bg-emerald-400' : 'bg-slate-600'
                                }`}
                                aria-label={isOnline ? 'Online' : 'Offline'}
                              />
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

                          {/* Mute controls for staff */}
                          {canPerformStaffActions && member.role === 'STUDENT' && (
                            <div className="relative flex-shrink-0">
                              {isMuted || isPermMuted ? (
                                <button
                                  onClick={() => handleUnmuteMember(member.userId)}
                                  aria-label={`Unmute ${member.userFirst}`}
                                  className="p-2 rounded bg-red-950/40 hover:bg-red-900/40 text-rose-400 border border-rose-500/20 min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <VolumeX className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    setMutingMemberId(
                                      mutingMemberId === member.id ? null : member.id
                                    )
                                  }
                                  aria-label={`Mute controls for ${member.userFirst}`}
                                  aria-expanded={mutingMemberId === member.id}
                                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-400 min-w-[36px] min-h-[36px] flex items-center justify-center"
                                >
                                  <VolumeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              )}

                              {mutingMemberId === member.id && (
                                <div className="absolute right-0 top-10 w-36 bg-slate-950 border border-slate-800 rounded-xl p-2 shadow-xl z-20 space-y-2">
                                  <div className="text-[10px] font-bold text-slate-400 px-1">
                                    SELECT DURATION:
                                  </div>
                                  <select
                                    className="w-full bg-slate-900 border border-slate-800 text-xs py-1 rounded px-1.5"
                                    value={muteDuration}
                                    onChange={(e) => setMuteDuration(e.target.value)}
                                    aria-label="Mute duration"
                                  >
                                    <option value="15">15 Minutes</option>
                                    <option value="60">1 Hour</option>
                                    <option value="1440">24 Hours</option>
                                  </select>
                                  <div className="flex gap-1 pt-1">
                                    <button
                                      onClick={() => handleMuteMember(member.userId, false)}
                                      aria-label={`Mute ${member.userFirst} for ${muteDuration} minutes`}
                                      className="flex-1 py-1 rounded bg-cyan-600 text-slate-100 hover:bg-cyan-500 text-[10px] font-bold"
                                    >
                                      Apply
                                    </button>
                                    <button
                                      onClick={() => handleMuteMember(member.userId, true)}
                                      aria-label={`Permanently mute ${member.userFirst}`}
                                      className="flex-1 py-1 rounded bg-rose-600 text-slate-100 hover:bg-rose-500 text-[10px] font-bold"
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

              {/* Files Tab */}
              {activeRightTab === 'files' && (
                <div className="space-y-4" role="tabpanel" aria-label="Shared Files">
                  <div className="relative">
                    <Search
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      placeholder="Search shared files..."
                      aria-label="Search shared files"
                      className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2" role="list">
                    {sharedFiles.length === 0 ? (
                      <div className="text-center py-6 text-xs text-slate-500">
                        No files shared in this chat workspace
                      </div>
                    ) : (
                      sharedFiles.map((file) => (
                        <div
                          key={file.id}
                          role="listitem"
                          className="p-2.5 rounded-xl bg-slate-950/30 border border-slate-800 flex items-center gap-3 min-w-0 w-full overflow-hidden"
                        >
                          <FileText className="h-4 w-4 text-cyan-400 flex-shrink-0" aria-hidden="true" />
                          <div className="flex flex-col truncate min-w-0 flex-1 overflow-hidden">
                            <span
                              className="text-xs truncate font-medium block w-full"
                              title={file.fileName}
                            >
                              {file.fileName}
                            </span>
                            <span className="text-[9px] text-slate-500">
                              {formatBytes(file.fileSize)}
                            </span>
                          </div>
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Download ${file.fileName}`}
                            className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex-shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
                          >
                            <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Pins Tab */}
              {activeRightTab === 'pins' && (
                <div className="space-y-3" role="tabpanel" aria-label="Pinned Messages">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Pinned Messages ({pinnedMessagesList.length})
                  </h4>
                  {pinnedMessagesList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-500">
                      No pinned messages in this class discussion
                    </div>
                  ) : (
                    pinnedMessagesList.map((m) => (
                      <div
                        key={m.id}
                        className="p-3 bg-slate-950/30 border border-slate-800 rounded-xl space-y-2 min-w-0 w-full overflow-hidden"
                      >
                        <div className="flex items-center justify-between text-[10px] text-slate-400 gap-2">
                          <span className="font-semibold truncate">{m.senderName}</span>
                          <span className="font-mono flex-shrink-0">
                            {new Date(m.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed font-medium break-words [overflow-wrap:anywhere]">
                          {m.content || 'Attachment Shared'}
                        </p>
                        {canPerformStaffActions && (
                          <button
                            onClick={() => handlePinMessage(m)}
                            aria-label={`Unpin message from ${m.senderName}`}
                            className="text-[9px] text-rose-400 hover:text-rose-300 underline font-semibold flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none rounded"
                          >
                            <Pin className="h-3 w-3 rotate-45" aria-hidden="true" /> Unpin Message
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
      </div>
    </FullScreenChatLayout>
  );
};
