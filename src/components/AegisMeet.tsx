import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { mockApi } from '../services/mockApi';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, 
  Hand, MessageSquare, Users, PhoneOff, Send, Download, 
  Check, X, AlertCircle, Circle, UserCheck, ShieldAlert,
  Paperclip, Plus, FileText, Trash, RefreshCw, Volume2, Eye
} from 'lucide-react';

interface AegisMeetProps {
  meetingId: string;
  onLeave?: () => void;
}

interface Participant {
  id: string;
  name: string;
  role: string;
  micEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
  screenSharing: boolean;
  isMutedByHost?: boolean;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  messageText: string;
  createdAt: string;
  attachment?: AttachmentMetadata;
}

interface AttachmentMetadata {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  publicUrl: string;
  storagePath?: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

interface FollowupTask {
  id: string;
  task: string;
  assignedTo: 'STUDENT' | 'PARENT' | 'TEACHER';
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

// Sub-component for managing individual remote video attachments to bypass DOM unmount lifecycle races
interface RemoteVideoProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  participantId: string;
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ stream, videoEnabled, participantId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      id={`video-${participantId}`}
      autoPlay
      playsInline
      className={`w-full h-full object-cover transition-opacity duration-300 ${
        videoEnabled && stream ? 'opacity-100 block' : 'opacity-0 hidden'
      }`}
    />
  );
};

export const AegisMeet: React.FC<AegisMeetProps> = ({ meetingId, onLeave }) => {
  const { session } = useStore();
  const currentUserId = session?.user?.id || 'guest-' + Math.random().toString(36).substring(2, 7);
  const currentUserName = session?.user 
    ? `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() 
    : 'Guest Participant';
  const currentUserRole = session?.user?.role || 'PARENT';
  const schoolId = session?.user?.schoolId || '';

  const [meeting, setMeeting] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [sharedAttachments, setSharedAttachments] = useState<AttachmentMetadata[]>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // UI drawers
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'CHAT' | 'FILES'>('CHAT');

  // Preview document state
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentMetadata | null>(null);

  // Connection overlay banners states
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  // File Upload states (Issue #1)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Meeting toggles
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);

  // Screen share settings
  const [allowParticipantScreenShare, setAllowParticipantScreenShare] = useState(true);
  
  // Waiting Room states
  const [inWaitingRoom, setInWaitingRoom] = useState(currentUserRole !== 'TEACHER' && currentUserRole !== 'ADMIN');
  const [waitingUsers, setWaitingUsers] = useState<any[]>([]);
  const [admitted, setAdmitted] = useState(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN');
  const [waitingStatus, setWaitingStatus] = useState<'PENDING' | 'REJECTED' | 'APPROVED'>('PENDING');

  // Notes & Tasks (Phase 10 & 11)
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [behaviouralNotes, setBehaviouralNotes] = useState('');
  const [actionPlan, setActionPlan] = useState('');
  const [tasks, setTasks] = useState<FollowupTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskAssigned, setNewTaskAssigned] = useState<'STUDENT' | 'PARENT' | 'TEACHER'>('STUDENT');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // WebRTC streams map
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<any>(null);
  const participantSessionIdRef = useRef<string | null>(null);

  // Bound local stream to ref when it changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, videoEnabled]);

  // 1. Fetch meeting configuration & check waitlist
  useEffect(() => {
    const loadMeetingDetails = async () => {
      try {
        if (!schoolId) return;

        // Load PTM detail
        const meetings = await mockApi.fetchPTMMeetings(schoolId);
        const found = meetings.find(m => m.id === meetingId);
        if (found) {
          setMeeting(found);
        }

        // Load historical notes
        const feedback = await mockApi.fetchPTMFeedback(meetingId);
        if (feedback) {
          setStrengths(feedback.strengths || '');
          setWeaknesses(feedback.weaknesses || '');
          setRecommendations(feedback.recommendations || '');
          setBehaviouralNotes(feedback.behaviouralNotes || '');
          setActionPlan(feedback.actionPlan || '');
        }

        // Load tasks
        const followups = await mockApi.fetchPTMFollowups(meetingId);
        if (followups) {
          setTasks(followups.map((f: any) => ({
            id: f.id,
            task: f.task,
            assignedTo: f.assignedTo,
            dueDate: f.dueDate,
            priority: f.priority,
            status: f.status
          })));
        }

        // Load persisted text messages (ptm_messages table)
        const msgs = await supabase
          .from('ptm_messages')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });
        
        if (msgs.data) {
          setChatMessages(msgs.data.map((c: any) => ({
            id: c.id,
            senderId: c.sender_id,
            senderName: 'Participant', // Fallback, loaded dynamically below
            senderRole: c.sender_role,
            messageText: c.message,
            createdAt: c.created_at
          })));

          // Backfill sender names
          const senderIds = Array.from(new Set(msgs.data.map(m => m.sender_id)));
          if (senderIds.length > 0) {
            const { data: usersList } = await supabase
              .from('users')
              .select('id, first_name, last_name')
              .in('id', senderIds);
            
            if (usersList) {
              const nameMap = new Map(usersList.map(u => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]));
              setChatMessages(prev => prev.map(m => ({
                ...m,
                senderName: nameMap.get(m.senderId) || m.senderName
              })));
            }
          }
        }

        // Load persisted chat attachments (ptm_chat_attachments table)
        const filesRes = await supabase
          .from('ptm_chat_attachments')
          .select('*')
          .eq('meeting_id', meetingId)
          .order('created_at', { ascending: true });

        if (filesRes.data) {
          const mappedAttachments = filesRes.data.map((f: any) => ({
            id: f.id,
            fileName: f.file_name,
            fileType: f.file_type,
            fileSize: f.file_size,
            publicUrl: f.public_url,
            storagePath: f.storage_path,
            senderId: f.sender_id,
            senderName: 'Participant',
            createdAt: f.created_at
          }));
          setSharedAttachments(mappedAttachments);

          // Associate attachments to loaded messages
          setChatMessages(prev => prev.map(msg => {
            const att = mappedAttachments.find(a => msg.messageText.includes(a.fileName));
            if (att) {
              return { ...msg, attachment: att };
            }
            return msg;
          }));

          // Bulk fetch signed URLs for loaded attachments
          const paths = mappedAttachments.map(a => a.storagePath).filter(Boolean) as string[];
          if (paths.length > 0) {
            supabase.storage
              .from('ptm-chat-files')
              .createSignedUrls(paths, 86400)
              .then(({ data: urlsData }) => {
                if (urlsData) {
                  const urlMap: Record<string, string> = {};
                  urlsData.forEach(item => {
                    if (item.signedUrl && item.path) {
                      urlMap[item.path] = item.signedUrl;
                    }
                  });
                  setSignedUrls(prev => ({ ...prev, ...urlMap }));
                }
              })
              .catch(e => console.warn('Failed to bulk resolve signed URLs:', e));
          }

          // Backfill attachment sender names
          const senderIds = Array.from(new Set(filesRes.data.map(f => f.sender_id)));
          if (senderIds.length > 0) {
            const { data: usersList } = await supabase
              .from('users')
              .select('id, first_name, last_name')
              .in('id', senderIds);
            
            if (usersList) {
              const nameMap = new Map(usersList.map(u => [u.id, `${u.first_name || ''} ${u.last_name || ''}`.trim()]));
              setSharedAttachments(prev => prev.map(f => ({
                ...f,
                senderName: nameMap.get(f.senderId) || f.senderName
              })));
            }
          }
        }

        // Host versus Participant Admission
        if (currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') {
          setInWaitingRoom(false);
          setAdmitted(true);
          setWaitingStatus('APPROVED');
          
          // Fetch existing waiting users
          const wr = await supabase
            .from('meeting_waiting_room')
            .select(`
              id,
              participant_id,
              participant_role,
              status,
              users:users!participant_id (
                first_name,
                last_name
              )
            `)
            .eq('meeting_id', meetingId)
            .eq('status', 'PENDING');
          
          if (wr.data) {
            setWaitingUsers(wr.data.map((w: any) => ({
              id: w.participant_id,
              name: w.users ? `${w.users.first_name || ''} ${w.users.last_name || ''}`.trim() : 'Waiting Participant',
              role: w.participant_role,
              waitingRoomId: w.id
            })));
          }

          // Register teacher session & attendance
          registerParticipantSession();
          updateAttendanceRecord(true);
        } else {
          // Participant waiting room check
          const wrCheck = await supabase
            .from('meeting_waiting_room')
            .select('*')
            .eq('meeting_id', meetingId)
            .eq('participant_id', currentUserId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (wrCheck.data) {
            setWaitingStatus(wrCheck.data.status);
            if (wrCheck.data.status === 'APPROVED') {
              setInWaitingRoom(false);
              setAdmitted(true);
              registerParticipantSession();
              updateAttendanceRecord(true);
            } else if (wrCheck.data.status === 'REJECTED') {
              setInWaitingRoom(true);
              setAdmitted(false);
            }
          } else {
            // Write new pending wait request
            await supabase
              .from('meeting_waiting_room')
              .insert({
                school_id: schoolId,
                meeting_id: meetingId,
                participant_id: currentUserId,
                participant_role: currentUserRole,
                status: 'PENDING'
              });
            
            setWaitingStatus('PENDING');
            setInWaitingRoom(true);
            setAdmitted(false);
          }
        }
      } catch (e: any) {
        console.error('PTM meeting initialization failed:', e);
      }
    };

    loadMeetingDetails();
  }, [meetingId, schoolId, currentUserId, currentUserRole]);

  // 2. Database participants registration & attendance log persistence
  const registerParticipantSession = async () => {
    try {
      const { data } = await supabase
        .from('ptm_participants')
        .insert({
          school_id: schoolId,
          meeting_id: meetingId,
          user_id: currentUserId,
          role: currentUserRole,
          joined_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (data) {
        participantSessionIdRef.current = data.id;
      }
    } catch (e) {
      console.warn('ptm_participants registration failed:', e);
    }
  };

  const deregisterParticipantSession = async () => {
    if (participantSessionIdRef.current) {
      try {
        await supabase
          .from('ptm_participants')
          .update({ left_at: new Date().toISOString() })
          .eq('id', participantSessionIdRef.current);
      } catch (e) {
        console.warn('ptm_participants deregistration failed:', e);
      }
    }
  };

  const updateAttendanceRecord = async (isJoin: boolean) => {
    try {
      // Fetch or auto-create unique attendance record
      let record: any = null;
      const { data } = await supabase
        .from('ptm_attendance')
        .select('*')
        .eq('meeting_id', meetingId)
        .maybeSingle();
      
      if (data) {
        record = data;
      } else {
        const { data: newRecord } = await supabase
          .from('ptm_attendance')
          .insert({ meeting_id: meetingId })
          .select()
          .single();
        record = newRecord;
      }

      if (record) {
        const updatePayload: any = { attendance_status: 'PRESENT' };
        const timeField = isJoin ? '_join_time' : '_leave_time';
        
        if (currentUserRole === 'TEACHER') {
          updatePayload[`teacher${timeField}`] = new Date().toISOString();
        } else if (currentUserRole === 'PARENT') {
          updatePayload[`parent${timeField}`] = new Date().toISOString();
        } else if (currentUserRole === 'STUDENT') {
          updatePayload[`student${timeField}`] = new Date().toISOString();
        }

        await supabase
          .from('ptm_attendance')
          .update(updatePayload)
          .eq('id', record.id);
      }
    } catch (e) {
      console.warn('Failed to update ptm_attendance status:', e);
    }
  };

  // 3. getUserMedia Call & Tracks setup
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const startCallCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        activeStream = stream;
        setDeviceError(null);
      } catch (err: any) {
        console.warn('Media capture error:', err);
        if (err.name === 'NotFoundError' || err.message?.includes('devices')) {
          setDeviceError('Camera Not Found');
        } else if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
          setDeviceError('Permission Denied');
        } else {
          setDeviceError('Microphone Not Found');
        }
      }
    };

    if (admitted) {
      startCallCapture();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [admitted]);

  // 4. Real-time signaling & Subscriptions
  useEffect(() => {
    if (!meetingId) return;

    // A. Broadcast signaling channel (WebRTC handshake)
    const channelName = `aegis-meet-signaling-${meetingId}`;
    const signalingChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    channelRef.current = signalingChannel;

    signalingChannel
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.targetId === currentUserId) {
          await handleOffer(payload.senderId, payload.offer);
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.targetId === currentUserId) {
          await handleAnswer(payload.senderId, payload.answer);
        }
      })
      .on('broadcast', { event: 'webrtc-ice' }, async ({ payload }) => {
        if (payload.targetId === currentUserId) {
          const pc = peerConnections.current[payload.senderId];
          if (pc && payload.candidate) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.error('Error adding ICE candidate:', err);
            }
          }
        }
      })
      .on('broadcast', { event: 'control-toggle' }, ({ payload }) => {
        if (payload.targetId === currentUserId) {
          if (payload.action === 'mute') {
            setMicEnabled(false);
            if (localStream) {
              localStream.getAudioTracks().forEach(t => t.enabled = false);
            }
            alert('You have been muted by the host.');
            broadcastState({ micEnabled: false });
          } else if (payload.action === 'remove') {
            alert('You have been removed from the meeting by the host.');
            handleLeaveCall();
          }
        }
      })
      .on('broadcast', { event: 'state-update' }, ({ payload }) => {
        setParticipants(prev => {
          if (!prev.some(p => p.id === payload.id)) {
            // Connect to newly discovered peer
            initiatePeerConnection(payload.id, true);
            return [...prev, {
              id: payload.id,
              name: payload.name,
              role: payload.role,
              micEnabled: payload.micEnabled,
              videoEnabled: payload.videoEnabled,
              handRaised: payload.handRaised,
              screenSharing: payload.screenSharing
            }];
          }
          return prev.map(p => {
            if (p.id === payload.id) {
              return { ...p, ...payload.updates };
            }
            return p;
          });
        });
      })
      .on('broadcast', { event: 'chat-permissions' }, ({ payload }) => {
        if (payload.allowParticipantScreenShare !== undefined) {
          setAllowParticipantScreenShare(payload.allowParticipantScreenShare);
          if (!payload.allowParticipantScreenShare && screenSharing && currentUserRole === 'PARENT') {
            stopScreenSharingLocally();
          }
        }
      })
      .on('broadcast', { event: 'join-announcement' }, ({ payload }) => {
        setParticipants(prev => {
          if (prev.some(p => p.id === payload.id)) return prev;
          initiatePeerConnection(payload.id, true);
          return [...prev, {
            id: payload.id,
            name: payload.name,
            role: payload.role,
            micEnabled: payload.micEnabled,
            videoEnabled: payload.videoEnabled,
            handRaised: payload.handRaised,
            screenSharing: payload.screenSharing
          }];
        });
        
        // Broadcast local state back
        signalingChannel.send({
          type: 'broadcast',
          event: 'state-update',
          payload: {
            id: currentUserId,
            name: currentUserName,
            role: currentUserRole,
            micEnabled,
            videoEnabled,
            handRaised,
            screenSharing
          }
        });
      })
      .on('broadcast', { event: 'leave-announcement' }, ({ payload }) => {
        if (peerConnections.current[payload.id]) {
          peerConnections.current[payload.id].close();
          delete peerConnections.current[payload.id];
        }
        setParticipants(prev => prev.filter(p => p.id !== payload.id));
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[payload.id];
          return next;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && admitted) {
          // Announce local join
          signalingChannel.send({
            type: 'broadcast',
            event: 'join-announcement',
            payload: {
              id: currentUserId,
              name: currentUserName,
              role: currentUserRole,
              micEnabled,
              videoEnabled,
              handRaised,
              screenSharing
            }
          });
        }
      });

    // B. Postgres Database Realtime Subscriptions
    const waitingRoomSub = supabase
      .channel(`waiting-room-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_waiting_room',
          filter: `meeting_id=eq.${meetingId}`
        },
        async (payload) => {
          if (currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') {
            if (payload.eventType === 'INSERT') {
              const { data: user } = await supabase
                .from('users')
                .select('first_name, last_name')
                .eq('id', payload.new.participant_id)
                .single();
              
              const name = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Waiting User';
              setWaitingUsers(prev => {
                if (prev.some(w => w.id === payload.new.participant_id)) return prev;
                return [...prev, {
                  id: payload.new.participant_id,
                  name,
                  role: payload.new.participant_role,
                  waitingRoomId: payload.new.id
                }];
              });
            } else if (payload.eventType === 'UPDATE') {
              if (payload.new.status !== 'PENDING') {
                setWaitingUsers(prev => prev.filter(u => u.id !== payload.new.participant_id));
              }
            }
          } else {
            // Participant status sync
            if (payload.eventType === 'UPDATE' && payload.new.participant_id === currentUserId) {
              setWaitingStatus(payload.new.status);
              if (payload.new.status === 'APPROVED') {
                setInWaitingRoom(false);
                setAdmitted(true);
                registerParticipantSession();
                updateAttendanceRecord(true);
                // Broadcast presence to peer list
                signalingChannel.send({
                  type: 'broadcast',
                  event: 'join-announcement',
                  payload: {
                    id: currentUserId,
                    name: currentUserName,
                    role: currentUserRole,
                    micEnabled,
                    videoEnabled,
                    handRaised,
                    screenSharing
                  }
                });
              } else if (payload.new.status === 'REJECTED') {
                setInWaitingRoom(true);
                setAdmitted(false);
              }
            }
          }
        }
      )
      .subscribe();

    // C. Chat Realtime Sync (ptm_messages table)
    const chatSub = supabase
      .channel(`chat-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ptm_messages',
          filter: `meeting_id=eq.${meetingId}`
        },
        async (payload) => {
          if (payload.new.sender_id === currentUserId) return;
          
          const { data: sender } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', payload.new.sender_id)
            .single();

          const name = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Participant';
          
          // Re-load to check if it has attachments
          const { data: attach } = await supabase
            .from('ptm_chat_attachments')
            .select('*')
            .eq('meeting_id', meetingId)
            .eq('sender_id', payload.new.sender_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let msgAttachment: AttachmentMetadata | undefined;
          if (attach && payload.new.message.includes(attach.file_name)) {
            msgAttachment = {
              id: attach.id,
              fileName: attach.file_name,
              fileType: attach.file_type,
              fileSize: attach.file_size,
              publicUrl: attach.public_url,
              senderId: attach.sender_id,
              senderName: name,
              createdAt: attach.created_at
            };
          }

          setChatMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, {
              id: payload.new.id,
              senderId: payload.new.sender_id,
              senderName: name,
              senderRole: payload.new.sender_role,
              messageText: payload.new.message,
              createdAt: payload.new.created_at,
              attachment: msgAttachment
            }];
          });
        }
      )
      .subscribe();

    // D. Attachments Realtime Sync (ptm_chat_attachments table)
    const filesSub = supabase
      .channel(`files-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ptm_chat_attachments',
          filter: `meeting_id=eq.${meetingId}`
        },
        async (payload) => {
          const { data: sender } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', payload.new.sender_id)
            .single();
          
          const name = sender ? `${sender.first_name || ''} ${sender.last_name || ''}`.trim() : 'Participant';
          
          // Fetch signed URL for the new attachment immediately
          supabase.storage
            .from('ptm-chat-files')
            .createSignedUrl(payload.new.storage_path, 86400)
            .then(({ data: signedData }) => {
              if (signedData?.signedUrl) {
                setSignedUrls(prev => ({ ...prev, [payload.new.storage_path]: signedData.signedUrl }));
              }
            })
            .catch(e => console.warn('Realtime attachment sign failed:', e));

          const newAttachObj: AttachmentMetadata = {
            id: payload.new.id,
            fileName: payload.new.file_name,
            fileType: payload.new.file_type,
            fileSize: payload.new.file_size,
            publicUrl: payload.new.public_url,
            storagePath: payload.new.storage_path,
            senderId: payload.new.sender_id,
            senderName: name,
            createdAt: payload.new.created_at
          };

          setSharedAttachments(prev => {
            if (prev.some(f => f.id === payload.new.id)) return prev;
            return [...prev, newAttachObj];
          });

          // Link new attachment to matching chat messages
          setChatMessages(prev => prev.map(msg => {
            if (msg.messageText.includes(newAttachObj.fileName)) {
              return { ...msg, attachment: newAttachObj };
            }
            return msg;
          }));
        }
      )
      .subscribe();

    // E. Feedback & tasks Realtime Sync
    const feedbackSub = supabase
      .channel(`feedback-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ptm_feedback',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            setStrengths(payload.new.strengths || '');
            setWeaknesses(payload.new.weaknesses || '');
            setRecommendations(payload.new.recommendations || '');
            setBehaviouralNotes(payload.new.behavioural_notes || '');
            setActionPlan(payload.new.action_plan || '');
          }
        }
      )
      .subscribe();

    const followupsSub = supabase
      .channel(`followups-changes-${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ptm_followups',
          filter: `meeting_id=eq.${meetingId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setTasks(prev => {
              if (prev.some(t => t.id === payload.new.id)) return prev;
              return [...prev, {
                id: payload.new.id,
                task: payload.new.task,
                assignedTo: payload.new.assigned_to,
                dueDate: payload.new.due_date,
                priority: payload.new.priority,
                status: payload.new.status
              }];
            });
          } else if (payload.eventType === 'UPDATE') {
            setTasks(prev => prev.map(t => {
              if (t.id === payload.new.id) {
                return {
                  ...t,
                  task: payload.new.task,
                  assignedTo: payload.new.assigned_to,
                  dueDate: payload.new.due_date,
                  priority: payload.new.priority,
                  status: payload.new.status
                };
              }
              return t;
            }));
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(t => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      if (admitted) {
        signalingChannel.send({
          type: 'broadcast',
          event: 'leave-announcement',
          payload: { id: currentUserId }
        });
      }
      signalingChannel.unsubscribe();
      waitingRoomSub.unsubscribe();
      chatSub.unsubscribe();
      filesSub.unsubscribe();
      feedbackSub.unsubscribe();
      followupsSub.unsubscribe();

      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
    };
  }, [meetingId, admitted, micEnabled, videoEnabled, handRaised, screenSharing]);

  // 5. Broadcaster state payload
  const broadcastState = (updates: Partial<Participant>) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'state-update',
        payload: { id: currentUserId, updates }
      });
    }
  };

  // 6. WebRTC RTC Connections
  const initiatePeerConnection = async (peerId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnections.current[peerId] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-ice',
          payload: {
            senderId: currentUserId,
            targetId: peerId,
            candidate: event.candidate
          }
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStreams(prev => ({
          ...prev,
          [peerId]: event.streams[0]
        }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setConnectionStatus('Reconnecting...');
      } else if (pc.connectionState === 'connected') {
        setConnectionStatus(null);
      }
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: {
            senderId: currentUserId,
            targetId: peerId,
            offer
          }
        });
      } catch (err) {
        console.error('Failed to create offer:', err);
      }
    }
  };

  const handleOffer = async (senderId: string, offer: RTCSessionDescriptionInit) => {
    await initiatePeerConnection(senderId, false);
    const pc = peerConnections.current[senderId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      channelRef.current.send({
        type: 'broadcast',
        event: 'webrtc-answer',
        payload: {
          senderId: currentUserId,
          targetId: senderId,
          answer
        }
      });
    }
  };

  const handleAnswer = async (senderId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current[senderId];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  // 7. Video and audio devices triggers
  const toggleMic = () => {
    const nextState = !micEnabled;
    setMicEnabled(nextState);
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = nextState);
    }
    broadcastState({ micEnabled: nextState });
  };

  const toggleVideo = () => {
    const nextState = !videoEnabled;
    setVideoEnabled(nextState);
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = nextState);
    }
    broadcastState({ videoEnabled: nextState });
  };

  const toggleScreenShare = async () => {
    if (currentUserRole === 'STUDENT') {
      alert('Screen sharing is not permitted for students.');
      return;
    }
    if (currentUserRole === 'PARENT' && !allowParticipantScreenShare) {
      alert('Screen sharing has been disabled by the host.');
      return;
    }

    if (screenSharing) {
      stopScreenSharingLocally();
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];
        
        Object.values(peerConnections.current).forEach(pc => {
          const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (videoSender && screenTrack) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        screenTrack.onended = () => {
          stopScreenSharingLocally();
        };

        broadcastState({ screenSharing: true });
      } catch (err) {
        console.error('Failed to start screen share:', err);
      }
    }
  };

  const stopScreenSharingLocally = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
    }
    setScreenSharing(false);
    
    if (localStream) {
      const camTrack = localStream.getVideoTracks()[0];
      Object.values(peerConnections.current).forEach(pc => {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender && camTrack) {
          videoSender.replaceTrack(camTrack);
        }
      });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
    broadcastState({ screenSharing: false });
  };

  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    broadcastState({ handRaised: nextState });
  };

  // 8. Host waitlist admissions
  const admitWaitingUser = async (userId: string, waitingRoomId: string) => {
    try {
      await supabase
        .from('meeting_waiting_room')
        .update({
          status: 'APPROVED',
          approved_by: currentUserId,
          approved_at: new Date().toISOString()
        })
        .eq('id', waitingRoomId);

      setWaitingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      console.error(e);
    }
  };

  const rejectWaitingUser = async (userId: string, waitingRoomId: string) => {
    try {
      await supabase
        .from('meeting_waiting_room')
        .update({
          status: 'REJECTED',
          approved_by: currentUserId,
          approved_at: new Date().toISOString()
        })
        .eq('id', waitingRoomId);

      setWaitingUsers(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      console.error(e);
    }
  };

  // 9. Host Participant list options
  const muteParticipantUser = (userId: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'control-toggle',
        payload: { targetId: userId, action: 'mute' }
      });
    }
  };

  const removeParticipantUser = (userId: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'control-toggle',
        payload: { targetId: userId, action: 'remove' }
      });
    }
    setParticipants(prev => prev.filter(p => p.id !== userId));
  };

  const toggleHostScreenSharePermission = () => {
    const nextState = !allowParticipantScreenShare;
    setAllowParticipantScreenShare(nextState);
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat-permissions',
        payload: { allowParticipantScreenShare: nextState }
      });
    }
  };

  // 10. Chat Message and File attachments uploading workflows (Issue #1)
  const sendChatMessageText = async () => {
    if (!newMessage.trim()) return;
    const msgText = newMessage;
    setNewMessage('');

    try {
      const { data: insertedMsg } = await supabase
        .from('ptm_messages')
        .insert({
          school_id: schoolId,
          meeting_id: meetingId,
          sender_id: currentUserId,
          sender_role: currentUserRole,
          message: msgText
        })
        .select()
        .single();

      setChatMessages(prev => [
        ...prev,
        {
          id: insertedMsg?.id || Math.random().toString(),
          senderId: currentUserId,
          senderName: currentUserName,
          senderRole: currentUserRole,
          messageText: msgText,
          createdAt: new Date().toISOString()
        }
      ]);
    } catch (e) {
      console.error('Failed to save message:', e);
    }
  };

  // Validation lists for files upload
  const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'zip'];
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

  const uploadFileToSupabase = async (file: File) => {
    // A. Validate file type extension
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert('Unsupported File Type');
      return;
    }

    // B. Validate size limit
    if (file.size > MAX_FILE_SIZE) {
      alert('File Too Large\nMaximum size allowed is 50 MB.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setFailedFile(null);

    try {
      setUploadProgress(35);
      const filePath = `${schoolId}/${meetingId}/attachments/${Date.now()}_${file.name}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('ptm-chat-files')
        .upload(filePath, file);

      if (uploadErr) {
        if (uploadErr.message.includes('bucket') || uploadErr.message.includes('Bucket not found') || uploadErr.message.includes('does not exist')) {
          alert('Storage Configuration Error');
        } else if (uploadErr.message.includes('Row-level security') || uploadErr.message.includes('Permission')) {
          alert('Permission Denied\nYou are not a participant of this meeting.');
        } else if (uploadErr.message.includes('Network') || uploadErr.message.includes('fetch')) {
          alert('Network Error');
        } else {
          alert('Storage Configuration Error');
        }
        setIsUploading(false);
        setFailedFile(file);
        return;
      }

      setUploadProgress(70);
      
      // Dynamic signed URL generation
      const { data: signedData, error: signErr } = await supabase.storage
        .from('ptm-chat-files')
        .createSignedUrl(filePath, 86400); // 24 hours expiry
      
      const signedUrl = signedData?.signedUrl || '';
      if (signedUrl) {
        setSignedUrls(prev => ({ ...prev, [filePath]: signedUrl }));
      }

      // D. Save attachment row metadata
      const { data: fileRecord, error: fileErr } = await supabase
        .from('ptm_chat_attachments')
        .insert({
          school_id: schoolId,
          meeting_id: meetingId,
          sender_id: currentUserId,
          sender_role: currentUserRole,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
          storage_path: filePath,
          public_url: signedUrl
        })
        .select()
        .single();

      if (fileErr) {
        if (fileErr.message.includes('Row-level security') || fileErr.message.includes('Permission')) {
          alert('Permission Denied\nYou are not a participant of this meeting.');
        } else {
          alert('Permission Denied');
        }
        setIsUploading(false);
        setFailedFile(file);
        return;
      }

      setUploadProgress(90);

      // E. Persist message text linking attachment
      await supabase
        .from('ptm_messages')
        .insert({
          school_id: schoolId,
          meeting_id: meetingId,
          sender_id: currentUserId,
          sender_role: currentUserRole,
          message: `Shared file: ${file.name}`
        });

      const newAttachment: AttachmentMetadata = {
        id: fileRecord.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        publicUrl: signedUrl,
        storagePath: filePath,
        senderId: currentUserId,
        senderName: currentUserName,
        createdAt: fileRecord.created_at
      };

      setSharedAttachments(prev => [...prev, newAttachment]);

      setChatMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          senderId: currentUserId,
          senderName: currentUserName,
          senderRole: currentUserRole,
          messageText: `Shared file: ${file.name}`,
          createdAt: new Date().toISOString(),
          attachment: newAttachment
        }
      ]);

      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(null);
      }, 500);

    } catch (err: any) {
      console.error(err);
      alert('Network Error');
      setIsUploading(false);
      setFailedFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileToSupabase(file);
    }
  };

  // 11. Notes & tasks log save triggers
  const handleSaveAcademicNotes = async () => {
    try {
      await mockApi.submitPTMFeedback(meetingId, {
        meetingId,
        strengths,
        weaknesses,
        recommendations,
        behaviouralNotes,
        actionPlan
      });
      alert('Notes and recommendations updated permanently.');
    } catch (e) {
      console.error(e);
      alert('Failed to save notes');
    }
  };

  const handleAddTaskAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskText.trim() || !newTaskDueDate) return;

    try {
      const added = await mockApi.createPTMFollowup({
        meetingId,
        task: newTaskText,
        assignedTo: newTaskAssigned,
        dueDate: newTaskDueDate,
        priority: newTaskPriority,
        status: 'PENDING',
        completionStatus: false
      });

      setTasks(prev => [
        ...prev,
        {
          id: added.id,
          task: added.task,
          assignedTo: added.assignedTo,
          dueDate: added.dueDate,
          priority: added.priority,
          status: added.status
        }
      ]);

      setNewTaskText('');
      setNewTaskDueDate('');
    } catch (e) {
      console.error(e);
      alert('Failed to add follow-up task.');
    }
  };

  const handleDeleteTaskAction = async (taskId: string) => {
    try {
      await mockApi.deletePTMFollowup(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (e) {
      console.error(e);
    }
  };

  // 12. Local recording
  const handleToggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      if (!localStream) return;
      recordedChunksRef.current = [];
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(localStream, options);
      } catch (e) {
        try {
          recorder = new MediaRecorder(localStream);
        } catch (err) {
          console.error(err);
          return;
        }
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        
        try {
          const filePath = `${schoolId}/${meetingId}/recordings/${Date.now()}_PTM_Recording.webm`;
          await supabase.storage.createBucket('meeting-files', { public: true }).catch(() => {});
          
          const { error: uploadErr } = await supabase.storage
            .from('meeting-files')
            .upload(filePath, blob);
          
          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from('meeting-files')
              .getPublicUrl(filePath);

            await supabase
              .from('ptm_recordings')
              .insert({
                school_id: schoolId,
                meeting_id: meetingId,
                recording_url: urlData.publicUrl,
                duration_seconds: 0
              });
          }
        } catch (notifErr) {
          console.warn('Unable to persist recording in storage:', notifErr);
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `PTM_Recording_${meetingId}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    }
  };

  // 13. Leave call
  const handleLeaveCall = async () => {
    await updateAttendanceRecord(false);
    await deregisterParticipantSession();
    if (onLeave) {
      onLeave();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070b13] text-white flex flex-col font-sans select-none overflow-hidden">
      
      {/* Background glow filters */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      {/* Header element */}
      <header className="h-16 border-b border-slate-800 bg-[#0b101d]/90 flex items-center justify-between px-6 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center relative shadow-lg shadow-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wider uppercase text-white flex items-center gap-2">
              AEGIS Meet <span className="text-[10px] bg-slate-800 text-slate-400 font-bold px-2 py-0.5 rounded border border-slate-700">PTM MODE</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider mt-0.5 uppercase">
              {meeting?.title || 'Online parent teacher meeting room'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection Error Banner Overlay */}
          {connectionStatus && (
            <div className="flex items-center gap-2 px-3 py-1 bg-yellow-600/10 border border-yellow-500/30 rounded-full text-xs text-yellow-400 font-bold animate-pulse">
              <span>{connectionStatus}</span>
            </div>
          )}

          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-600/10 border border-red-500/30 rounded-full text-xs text-red-400 font-bold animate-pulse shadow-md">
              <Circle className="fill-red-500" size={8} />
              <span className="text-[9px] uppercase tracking-widest">Recording...</span>
            </div>
          )}

          <div className="text-slate-300 text-[10px] font-bold tracking-wider uppercase bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5 shadow">
            <UserCheck size={11} className="text-brand-400" />
            Role: <span className="text-brand-400 font-black">{currentUserRole}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden bg-[#090e1a]">
        
        {inWaitingRoom ? (
          /* WAITING SCREEN */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090e1a]/95">
            {waitingStatus === 'REJECTED' ? (
              <div className="max-w-md w-full p-8 border border-red-500/20 bg-[#0e1220] rounded-2xl shadow-2xl text-center space-y-5 animate-fade-in">
                <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center border border-red-500/20 mx-auto text-red-400">
                  <ShieldAlert size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold text-slate-100 uppercase tracking-wide">Access Denied</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Host denied meeting access. If this was an error, please coordinate with your class teacher.
                  </p>
                </div>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={onLeave}
                    className="px-5 py-2.5 bg-red-650 hover:bg-red-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all"
                  >
                    Exit Call
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-w-md w-full p-8 border border-slate-800 bg-[#0e1220] rounded-2xl shadow-2xl text-center space-y-6 animate-pulse">
                <div className="w-16 h-16 bg-brand-500/10 rounded-full flex items-center justify-center border border-brand-500/20 mx-auto text-brand-400">
                  <Users size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-extrabold text-slate-100 uppercase tracking-wide">Waiting Room</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold">
                    Waiting for host approval... Once approved, you will join the video call automatically.
                  </p>
                </div>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={onLeave}
                    className="px-4 py-2 border border-slate-800 bg-[#0d1527] hover:bg-[#131f3b] text-slate-400 hover:text-slate-200 text-[10px] uppercase font-bold tracking-widest rounded-xl transition-all"
                  >
                    Cancel Join
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ACTIVE CALL SCREEN VIEW */
          <div className="flex-1 flex flex-col md:flex-row relative">
            
            {/* Realtime Approve/Reject banner for host */}
            {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && waitingUsers.length > 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#0d1527]/95 border border-yellow-500/25 rounded-2xl p-4 shadow-2xl z-20 max-w-sm w-full flex items-center justify-between gap-4 animate-fade-in backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/10 text-yellow-400 rounded-lg border border-yellow-500/10">
                    <Users size={16} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">{waitingUsers[0].name}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">wants to join this PTM</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => admitWaitingUser(waitingUsers[0].id, waitingUsers[0].waitingRoomId)}
                    className="px-3.5 py-1.5 bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-lg transition-all"
                  >
                    Admit
                  </button>
                  <button
                    onClick={() => rejectWaitingUser(waitingUsers[0].id, waitingUsers[0].waitingRoomId)}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-[10px] uppercase tracking-wide rounded-lg transition-all"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Video Canvas Grid */}
            <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-center justify-center content-center bg-[#090e1a]">
              
              {/* Local Video Box */}
              <div className="relative aspect-video max-w-xl mx-auto w-full bg-[#111827] rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${
                    videoEnabled && localStream ? 'opacity-100 block' : 'opacity-0 hidden'
                  }`}
                />
                
                {(!videoEnabled || !localStream) && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#131b2e] relative">
                    <div className="w-20 h-20 rounded-full bg-[#1e294b] flex items-center justify-center text-slate-350 font-extrabold text-2xl border border-slate-700 uppercase">
                      {currentUserName.substring(0, 2)}
                    </div>
                    {deviceError ? (
                      <span className="text-[10px] uppercase tracking-widest text-red-400 mt-3 font-extrabold flex items-center gap-1">
                        <AlertCircle size={12} /> {deviceError}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-3 font-extrabold">Camera Off</span>
                    )}
                  </div>
                )}
                
                <div className="absolute bottom-3 left-3 bg-[#0a0f1d]/85 px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2 backdrop-blur shadow text-[10px] font-bold">
                  <span>{currentUserName} (You)</span>
                  {handRaised && <Hand size={12} className="text-yellow-400 animate-bounce" />}
                  {!micEnabled && <MicOff size={10} className="text-red-400" />}
                </div>
              </div>

              {/* Remote Participant Streams */}
              {participants.map(p => (
                <div key={p.id} className="relative aspect-video max-w-xl mx-auto w-full bg-[#111827] rounded-2xl overflow-hidden border border-slate-800 shadow-xl group">
                  <RemoteVideo 
                    stream={remoteStreams[p.id] || null} 
                    videoEnabled={p.videoEnabled} 
                    participantId={p.id} 
                  />

                  {(!p.videoEnabled || !remoteStreams[p.id]) && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#131b2e]">
                      <div className="w-20 h-20 rounded-full bg-[#1e294b] flex items-center justify-center text-brand-400 font-extrabold text-2xl border border-slate-700 uppercase">
                        {p.name.substring(0, 2)}
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-slate-500 mt-3 font-extrabold">Camera Off</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 bg-[#0a0f1d]/85 px-3 py-1.5 rounded-xl border border-slate-800/80 flex items-center gap-2 backdrop-blur shadow text-[10px] font-bold">
                    <span>{p.name} ({p.role})</span>
                    {p.handRaised && <Hand size={12} className="text-yellow-400 animate-bounce" />}
                    {!p.micEnabled && <MicOff size={10} className="text-red-400" />}
                  </div>

                  {/* Host specific overlay options */}
                  {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && (
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5 z-10">
                      {p.micEnabled && (
                        <button 
                          onClick={() => muteParticipantUser(p.id)}
                          className="px-2 py-1 bg-red-650 hover:bg-red-700 text-white rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md border border-red-500/10"
                        >
                          <MicOff size={10} /> Mute
                        </button>
                      )}
                      <button 
                        onClick={() => removeParticipantUser(p.id)}
                        className="px-2 py-1 bg-red-750 hover:bg-red-800 text-white rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md border border-red-500/10"
                      >
                        <Trash size={10} /> Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Waiting states fallback */}
              {participants.length === 0 && (
                <div className="aspect-video max-w-xl mx-auto w-full bg-[#111827]/20 rounded-2xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-slate-500">
                  <AlertCircle size={22} className="mb-2 text-slate-605 animate-pulse" />
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Waiting for other participants</p>
                  <p className="text-[9px] text-slate-600 mt-1 max-w-xs text-center leading-relaxed font-semibold">
                    Once parents, teachers or students confirm entry, their audio/video channels will load here.
                  </p>
                </div>
              )}

            </div>

            {/* SIDE SLIDE DRAWER DETAILS */}

            {/* Chat & File Sharing Drawer */}
            {isChatOpen && (
              <div className="w-85 border-l border-slate-800 bg-[#0b101d] flex flex-col z-10">
                <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setDrawerTab('CHAT')}
                      className={`text-[10px] font-extrabold uppercase tracking-wider pb-1 transition-all ${
                        drawerTab === 'CHAT' ? 'border-b-2 border-brand-500 text-brand-400 font-black' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Chat
                    </button>
                    <button 
                      onClick={() => setDrawerTab('FILES')}
                      className={`text-[10px] font-extrabold uppercase tracking-wider pb-1 transition-all ${
                        drawerTab === 'FILES' ? 'border-b-2 border-brand-500 text-brand-400' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Files ({sharedAttachments.length})
                    </button>
                  </div>
                  <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={14} />
                  </button>
                </div>

                {drawerTab === 'CHAT' ? (
                  /* Chat Messages feed */
                  <div className="flex-1 flex flex-col min-h-0 bg-[#090e1a]">
                    <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                      {chatMessages.map(msg => (
                        <div key={msg.id} className="space-y-0.5">
                          <div className="flex items-center justify-between text-[8px] font-bold text-slate-500">
                            <span className={msg.senderId === currentUserId ? 'text-brand-400' : 'text-slate-350'}>
                              {msg.senderName} ({msg.senderRole})
                            </span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          
                          {/* Chat bubble body */}
                          <div className={`p-2.5 rounded-xl border text-xs leading-relaxed break-words font-medium ${
                            msg.senderId === currentUserId 
                              ? 'bg-brand-600/10 border-brand-500/25 text-slate-100' 
                              : 'bg-slate-900 border-slate-800 text-slate-250'
                          }`}>
                            {msg.messageText}

                            {/* Render Inline attachment previews inside chat bubbles if present */}
                            {msg.attachment && (
                              <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2">
                                <div className="flex items-start gap-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                                  <FileText size={14} className="text-brand-400 mt-0.5" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[10px] font-bold text-slate-200 truncate">{msg.attachment.fileName}</div>
                                    <div className="text-[8px] text-slate-500 font-bold uppercase mt-0.5">
                                      {Math.round(msg.attachment.fileSize / 1024)} KB
                                    </div>
                                  </div>
                                </div>
                                <div className="flex gap-1 justify-end">
                                  <button 
                                    onClick={() => setPreviewAttachment(msg.attachment!)}
                                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5"
                                  >
                                    <Eye size={8} /> Preview
                                  </button>
                                  <a 
                                    href={signedUrls[msg.attachment.storagePath || ''] || msg.attachment.publicUrl} 
                                    download={msg.attachment.fileName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-0.5 bg-emerald-650/20 text-emerald-400 rounded text-[8px] font-bold uppercase tracking-wider flex items-center gap-0.5 border border-emerald-500/10"
                                  >
                                    <Download size={8} /> Download
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {chatMessages.length === 0 && (
                        <div className="text-center py-20 text-[10px] uppercase font-bold tracking-wider text-slate-650">
                          Secure Line. Type a message.
                        </div>
                      )}
                    </div>

                    {/* Progress indicators overlay (Issue #1) */}
                    {isUploading && (
                      <div className="px-4 py-2 border-t border-slate-800 bg-[#0b101d] flex items-center justify-between text-[9px] font-bold text-slate-300 gap-4">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={12} className="animate-spin text-brand-400" />
                          <span>Uploading File...</span>
                        </div>
                        <div className="flex-1 max-w-[120px] bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-brand-500 h-1.5 transition-all duration-300" style={{ width: `${uploadProgress || 0}%` }} />
                        </div>
                        <span>{uploadProgress || 0}%</span>
                      </div>
                    )}

                    {/* Retry triggers on failure */}
                    {failedFile && (
                      <div className="px-4 py-2 border-t border-red-500/20 bg-red-500/5 flex items-center justify-between text-[9px] font-bold text-red-400 gap-4">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle size={12} />
                          <span className="truncate max-w-[120px]">{failedFile.name} failed</span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => uploadFileToSupabase(failedFile)}
                            className="px-2 py-0.5 bg-red-600 text-white rounded font-extrabold uppercase text-[8px]"
                          >
                            Retry
                          </button>
                          <button 
                            onClick={() => setFailedFile(null)}
                            className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-extrabold uppercase text-[8px]"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-3 border-t border-slate-800 flex gap-2 items-center bg-[#0b101d]">
                      {/* Attachment file selector (Issue #1) */}
                      <label className="p-2.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-all active:scale-95">
                        <Paperclip size={14} />
                        <input 
                          type="file" 
                          onChange={handleFileChange} 
                          className="hidden" 
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.webp,.zip" 
                        />
                      </label>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendChatMessageText()}
                        placeholder="Type message..."
                        className="flex-1 bg-[#162038] border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-semibold"
                      />
                      <button 
                        onClick={sendChatMessageText} 
                        className="bg-brand-600 hover:bg-brand-700 transition-colors p-2.5 rounded-lg flex items-center justify-center text-slate-950"
                      >
                        <Send size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Files repository list view */
                  <div className="flex-1 overflow-y-auto p-4 bg-[#090e1a] space-y-3">
                    {sharedAttachments.map(file => (
                      <div key={file.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 bg-slate-800 text-brand-400 rounded-lg border border-slate-700">
                            <FileText size={16} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-200 truncate" title={file.fileName}>{file.fileName}</div>
                            <div className="text-[8px] text-slate-500 font-semibold uppercase mt-0.5">
                              Uploaded by: {file.senderName}
                            </div>
                            <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                              {file.fileType.split('/').pop()?.toUpperCase()} • {Math.round(file.fileSize / 1024)} KB
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1.5 justify-end">
                          <button 
                            onClick={() => setPreviewAttachment(file)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 border border-slate-750 transition-all"
                          >
                            <Eye size={10} /> Preview
                          </button>
                          <a 
                            href={signedUrls[file.storagePath || ''] || file.publicUrl} 
                            download={file.fileName}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-emerald-650/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 rounded text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                          >
                            <Download size={10} /> Get File
                          </a>
                        </div>
                      </div>
                    ))}
                    {sharedAttachments.length === 0 && (
                      <div className="text-center py-20 text-[10px] uppercase font-bold tracking-wider text-slate-650">
                        No shared documents.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Participants list drawer */}
            {isParticipantsOpen && (
              <div className="w-80 border-l border-slate-800 bg-[#0b101d] flex flex-col z-10">
                <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Participants List</h3>
                  <button onClick={() => setIsParticipantsOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={14} />
                  </button>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto space-y-5 bg-[#090e1a]">
                  
                  {/* Host waiting room details (Teacher only) */}
                  {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && waitingUsers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[9px] font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Circle className="fill-yellow-500 animate-ping" size={5} />
                        <span>Waiting Admission ({waitingUsers.length})</span>
                      </h4>
                      <div className="space-y-1.5">
                        {waitingUsers.map(user => (
                          <div key={user.id} className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-2.5 flex items-center justify-between shadow-md">
                            <div>
                              <div className="text-xs font-bold text-slate-200">{user.name}</div>
                              <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">{user.role}</div>
                            </div>
                            <div className="flex gap-1.5">
                              <button 
                                onClick={() => admitWaitingUser(user.id, user.waitingRoomId)}
                                className="p-1 bg-emerald-650 hover:bg-emerald-700 text-white rounded shadow-sm border border-emerald-500/10"
                              >
                                <Check size={11} />
                              </button>
                              <button 
                                onClick={() => rejectWaitingUser(user.id, user.waitingRoomId)}
                                className="p-1 bg-red-650 hover:bg-red-700 text-white rounded shadow-sm border border-red-500/10"
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active call list details */}
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Call ({participants.length + 1})</h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-2.5 hover:bg-[#151c2e] rounded-xl transition-colors border border-transparent hover:border-slate-800">
                        <div>
                          <div className="text-xs font-bold text-slate-200">{currentUserName} (You)</div>
                          <div className="text-[8px] uppercase tracking-wider text-brand-400 font-extrabold mt-0.5">{currentUserRole}</div>
                        </div>
                        <div className="flex gap-1.5 text-slate-400">
                          {micEnabled ? <Mic size={11} /> : <MicOff size={11} className="text-red-400" />}
                          {videoEnabled ? <Video size={11} /> : <VideoOff size={11} className="text-red-400" />}
                        </div>
                      </div>

                      {/* Remote Cards */}
                      {participants.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2.5 hover:bg-[#151c2e] rounded-xl transition-colors border border-transparent hover:border-slate-800">
                          <div>
                            <div className="text-xs font-bold text-slate-200">{p.name}</div>
                            <div className="text-[8px] uppercase tracking-wider text-slate-500 font-bold mt-0.5">{p.role}</div>
                          </div>
                          <div className="flex gap-1.5 text-slate-400">
                            {p.micEnabled ? <Mic size={11} /> : <MicOff size={11} className="text-red-400" />}
                            {p.videoEnabled ? <Video size={11} /> : <VideoOff size={11} className="text-red-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Host Settings config */}
                  {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && (
                    <div className="pt-4 border-t border-slate-800 space-y-2">
                      <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Meeting Settings</h4>
                      <label className="flex items-center justify-between p-2 hover:bg-[#151c2e] rounded-xl text-xs cursor-pointer select-none">
                        <span className="font-semibold text-slate-350">Allow Screen Sharing</span>
                        <input 
                          type="checkbox" 
                          checked={allowParticipantScreenShare} 
                          onChange={toggleHostScreenSharePermission} 
                          className="rounded text-brand-600 focus:ring-brand-500 bg-[#162038] border-slate-700"
                        />
                      </label>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Notes & Tasks Log Drawer */}
            {isNotesOpen && (
              <div className="w-80 border-l border-slate-800 bg-[#0b101d] flex flex-col z-10">
                <div className="h-12 border-b border-slate-800 flex items-center justify-between px-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Notes & Followups</h3>
                  <button onClick={() => setIsNotesOpen(false)} className="text-slate-400 hover:text-slate-200">
                    <X size={14} />
                  </button>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto bg-[#090e1a] space-y-5 text-xs">
                  {currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN' ? (
                    /* Edit view for Host */
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Student Strengths</label>
                        <textarea 
                          value={strengths} 
                          onChange={e => setStrengths(e.target.value)}
                          className="w-full bg-[#162038] border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Areas for Improvement</label>
                        <textarea 
                          value={weaknesses} 
                          onChange={e => setWeaknesses(e.target.value)}
                          className="w-full bg-[#162038] border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Recommendations</label>
                        <textarea 
                          value={recommendations} 
                          onChange={e => setRecommendations(e.target.value)}
                          className="w-full bg-[#162038] border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                          rows={2}
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Behavioural Notes</label>
                        <input 
                          type="text" 
                          value={behaviouralNotes} 
                          onChange={e => setBehaviouralNotes(e.target.value)}
                          className="w-full bg-[#162038] border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] text-slate-400 uppercase font-bold mb-1">Action Plan</label>
                        <input 
                          type="text" 
                          value={actionPlan} 
                          onChange={e => setActionPlan(e.target.value)}
                          className="w-full bg-[#162038] border border-slate-700 rounded-lg p-2 text-white focus:outline-none"
                        />
                      </div>
                      
                      <button 
                        onClick={handleSaveAcademicNotes}
                        className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-slate-950 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-md active:scale-95"
                      >
                        Save Notes
                      </button>

                      {/* Follow-up tasks */}
                      <div className="pt-4 border-t border-slate-800 space-y-3">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Follow-up Tasks</h4>
                        
                        <form onSubmit={handleAddTaskAction} className="space-y-2.5 bg-slate-900/40 p-3 border border-slate-800 rounded-xl">
                          <input 
                            type="text" 
                            placeholder="Add task detail..." 
                            value={newTaskText} 
                            onChange={e => setNewTaskText(e.target.value)}
                            className="w-full bg-[#162038] border border-slate-750 rounded-lg p-2 text-white focus:outline-none text-xs font-semibold"
                            required
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[8px] text-slate-500 uppercase font-bold mb-0.5">Assigned To</label>
                              <select 
                                value={newTaskAssigned} 
                                onChange={e => setNewTaskAssigned(e.target.value as any)}
                                className="w-full bg-[#162038] border border-slate-750 rounded p-1 text-slate-200"
                              >
                                <option value="STUDENT">Student</option>
                                <option value="PARENT">Parent</option>
                                <option value="TEACHER">Teacher</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[8px] text-slate-500 uppercase font-bold mb-0.5">Priority</label>
                              <select 
                                value={newTaskPriority} 
                                onChange={e => setNewTaskPriority(e.target.value as any)}
                                className="w-full bg-[#162038] border border-slate-750 rounded p-1 text-slate-200"
                              >
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[8px] text-slate-500 uppercase font-bold mb-0.5">Due Date</label>
                            <input 
                              type="date" 
                              value={newTaskDueDate} 
                              onChange={e => setNewTaskDueDate(e.target.value)}
                              className="w-full bg-[#162038] border border-slate-750 rounded p-1 text-slate-255"
                              required
                            />
                          </div>
                          <button 
                            type="submit" 
                            className="w-full py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-slate-100 font-bold uppercase tracking-wider text-[9px] rounded-lg border border-slate-700 transition-all flex items-center justify-center gap-1"
                          >
                            <Plus size={10} /> Add Task
                          </button>
                        </form>

                        <div className="space-y-1.5">
                          {tasks.map(t => (
                            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-start justify-between shadow-sm">
                              <div>
                                <div className="font-bold text-slate-250 leading-relaxed">{t.task}</div>
                                <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                  {t.assignedTo} • Due: {t.dueDate}
                                </div>
                              </div>
                              <button onClick={() => handleDeleteTaskAction(t.id)} className="text-red-400 hover:text-red-500 p-0.5 bg-red-500/10 border border-red-500/10 rounded">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Read-Only mode for Parent/Student */
                    <div className="space-y-4 leading-relaxed font-semibold">
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 space-y-3.5">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-brand-400 block mb-0.5">Academic Strengths:</span>
                          <p className="text-slate-250 italic">"{strengths || 'No remarks logged yet.'}"</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-brand-400 block mb-0.5">Areas of Improvement:</span>
                          <p className="text-slate-250 italic">"{weaknesses || 'No remarks logged yet.'}"</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-brand-400 block mb-0.5">Recommendations:</span>
                          <p className="text-slate-250 italic">"{recommendations || 'No remarks logged yet.'}"</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-brand-400 block mb-0.5">Behaviour:</span>
                          <p className="text-slate-200">{behaviouralNotes || 'No notes logged.'}</p>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-brand-400 block mb-0.5">Action Plan:</span>
                          <p className="text-slate-200">{actionPlan || 'No plan logged.'}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Your Assigned Action Items</h4>
                        <div className="space-y-1.5">
                          {tasks.map(t => (
                            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between">
                              <div>
                                <div className="font-bold text-slate-250">{t.task}</div>
                                <div className="text-[8px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                  Assigned: {t.assignedTo} • Due: {t.dueDate}
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                                t.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15'
                              }`}>
                                {t.status}
                              </span>
                            </div>
                          ))}
                          {tasks.length === 0 && (
                            <div className="text-center py-8 text-[9px] text-slate-650 uppercase font-bold">No follow-up action plan registered.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* Control bar footer controls */}
      <footer className="h-20 bg-[#0c1222]/90 border-t border-slate-800 px-6 flex items-center justify-between backdrop-blur-md z-10 select-none">
        
        {/* End Call / Leave Call */}
        <div>
          <button 
            onClick={handleLeaveCall}
            className="flex items-center gap-2 px-5 py-3 bg-red-600 hover:bg-red-700 transition-colors text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/10 border border-red-500/10 active:scale-95"
          >
            <PhoneOff size={14} />
            <span>Leave Call</span>
          </button>
        </div>

        {/* Media Buttons */}
        {!inWaitingRoom && (
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleMic}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center active:scale-95 ${
                micEnabled 
                  ? 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100' 
                  : 'bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30'
              }`}
              title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
            </button>

            <button 
              onClick={toggleVideo}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center active:scale-95 ${
                videoEnabled 
                  ? 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100' 
                  : 'bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30'
              }`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
            </button>

            <button 
              onClick={toggleScreenShare}
              disabled={currentUserRole === 'STUDENT' || (currentUserRole === 'PARENT' && !allowParticipantScreenShare)}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center active:scale-95 disabled:opacity-50 ${
                screenSharing 
                  ? 'bg-emerald-600/20 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30' 
                  : 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100'
              }`}
              title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              {screenSharing ? <MonitorOff size={16} /> : <Monitor size={16} />}
            </button>

            <button 
              onClick={toggleHandRaise}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center active:scale-95 ${
                handRaised 
                  ? 'bg-yellow-600/20 border-yellow-600/30 text-yellow-400 hover:bg-yellow-600/30 animate-pulse' 
                  : 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100'
              }`}
              title={handRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand size={16} />
            </button>

            {/* Local recording (Teacher / Admin only) */}
            {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && (
              isRecording ? (
                <button 
                  onClick={handleToggleRecording}
                  className="px-4 py-3 bg-red-600/20 border border-red-500/40 text-red-400 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-red-600/30 transition-all shadow-md animate-pulse"
                  title="Stop PTM Recording"
                >
                  <Circle className="fill-red-500" size={8} />
                  <span>Stop Recording</span>
                </button>
              ) : (
                <button 
                  onClick={handleToggleRecording}
                  className="px-4 py-3 bg-[#1b253b] border border-slate-750 hover:bg-[#25324e] text-slate-200 rounded-xl font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
                  title="Record Meeting"
                >
                  <Download size={12} />
                  <span>Record PTM</span>
                </button>
              )
            )}
          </div>
        )}

        {/* Side drawers triggers */}
        {!inWaitingRoom ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsNotesOpen(prev => !prev);
                setIsParticipantsOpen(false);
                setIsChatOpen(false);
              }}
              className={`px-4.5 py-3 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                isNotesOpen 
                  ? 'bg-brand-600/20 border-brand-500/35 text-brand-400 font-extrabold' 
                  : 'bg-[#162038]/80 hover:bg-[#1f2d4e] border-slate-800 text-slate-350'
              }`}
            >
              <FileText size={13} />
              <span>Notes</span>
            </button>

            <button 
              onClick={() => {
                setIsParticipantsOpen(prev => !prev);
                setIsChatOpen(false);
                setIsNotesOpen(false);
              }}
              className={`px-4.5 py-3 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider relative ${
                isParticipantsOpen 
                  ? 'bg-brand-600/20 border-brand-500/35 text-brand-400 font-extrabold' 
                  : 'bg-[#162038]/80 hover:bg-[#1f2d4e] border-slate-800 text-slate-350'
              }`}
            >
              <Users size={13} />
              <span>Participants</span>
              {waitingUsers.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-yellow-500 text-slate-950 flex items-center justify-center text-[9px] font-black animate-bounce border border-[#0c1222]">
                  {waitingUsers.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => {
                setIsChatOpen(prev => !prev);
                setIsParticipantsOpen(false);
                setIsNotesOpen(false);
              }}
              className={`px-4.5 py-3 rounded-xl border transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${
                isChatOpen 
                  ? 'bg-brand-600/20 border-brand-500/35 text-brand-400 font-extrabold' 
                  : 'bg-[#162038]/80 hover:bg-[#1f2d4e] border-slate-800 text-slate-350'
              }`}
            >
              <MessageSquare size={13} />
              <span>Chat</span>
            </button>
          </div>
        ) : (
          <div className="w-48"></div>
        )}

      </footer>

      {/* PDF & Images Viewer Modal Overlay */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 bg-[#04060d]/90 flex flex-col backdrop-blur animate-fade-in">
          <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0b101d]">
            <span className="text-xs font-extrabold text-slate-200 uppercase truncate max-w-lg">{previewAttachment.fileName}</span>
            <button 
              onClick={() => setPreviewAttachment(null)}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 p-8 flex items-center justify-center min-h-0 bg-[#080b13]">
            {previewAttachment.fileType.startsWith('image/') ? (
              <img 
                src={signedUrls[previewAttachment.storagePath || ''] || previewAttachment.publicUrl} 
                alt={previewAttachment.fileName} 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-slate-850"
              />
            ) : previewAttachment.fileType === 'application/pdf' ? (
              <iframe 
                src={signedUrls[previewAttachment.storagePath || ''] || previewAttachment.publicUrl} 
                title={previewAttachment.fileName}
                className="w-full h-full rounded-lg shadow-2xl border border-slate-850 bg-white"
              />
            ) : (
              <div className="text-center p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full space-y-4">
                <AlertCircle size={32} className="text-brand-400 mx-auto" />
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-wider">No Preview Available</h4>
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  This document type ({previewAttachment.fileType}) cannot be rendered directly. Please download the document to view.
                </p>
                <a 
                  href={signedUrls[previewAttachment.storagePath || ''] || previewAttachment.publicUrl} 
                  download={previewAttachment.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-650 text-white font-extrabold uppercase text-[10px] tracking-wider rounded-xl transition-all shadow"
                >
                  <Download size={12} /> Download Document
                </a>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
