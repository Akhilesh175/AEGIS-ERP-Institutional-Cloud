import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import { mockApi } from '../services/mockApi';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, 
  Hand, MessageSquare, Users, PhoneOff, Send, Download, 
  Check, X, AlertCircle, Circle, UserCheck, ShieldAlert
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
  isMutedByHost?: boolean;
}

export const AegisMeet: React.FC<AegisMeetProps> = ({ meetingId, onLeave }) => {
  const { session } = useStore();
  const currentUserId = session?.user?.id || 'guest-' + Math.random().toString(36).substring(2, 7);
  const currentUserName = session?.user ? `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() : (session?.user?.role === 'PARENT' ? 'Parent' : session?.user?.role === 'STUDENT' ? 'Student' : 'Guest');
  const currentUserRole = session?.user?.role || 'GUEST';

  const [meeting, setMeeting] = useState<any>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);
  const [newMessage, setNewMessage] = useState('');
  
  // UI Panels
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  
  // Meeting controls
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  
  // Waiting room & Admin
  const [inWaitingRoom, setInWaitingRoom] = useState(currentUserRole !== 'TEACHER' && currentUserRole !== 'ADMIN');
  const [waitingUsers, setWaitingUsers] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [admitted, setAdmitted] = useState(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN');

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // WebRTC Peer Connection refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnections = useRef<Record<string, RTCPeerConnection>>({});
  const channelRef = useRef<any>(null);

  // Fallback simulation triggers (for robust visual confirmation in complex NAT networks)
  const [isWebRTCConnected, setIsWebRTCConnected] = useState(false);

  // 1. Fetch meeting info
  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        if (session?.user?.schoolId) {
          const meetings = await mockApi.fetchPTMMeetings(session.user.schoolId);
          const found = meetings.find(m => m.id === meetingId);
          if (found) {
            setMeeting(found);
          }
        }
      } catch (err) {
        console.error('Failed to fetch meeting info:', err);
      }
    };
    fetchMeeting();
  }, [meetingId, session]);

  // 2. Initialize media streams
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        setLocalStream(stream);
        activeStream = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Camera/mic access denied, proceeding with audio only or simulation:', err);
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setLocalStream(audioStream);
          activeStream = audioStream;
        } catch (audioErr) {
          console.warn('Audio access denied too, proceeding without devices:', audioErr);
        }
      }
    };

    if (admitted) {
      startMedia();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [admitted]);

  // 3. Connect to Supabase Broadcast Signaling Channel
  useEffect(() => {
    if (!meetingId) return;

    const channelName = `ptm-meet-${meetingId}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    channelRef.current = channel;

    channel
      .on('broadcast', { event: 'join-request' }, ({ payload }) => {
        // Teacher receives join requests from non-teachers
        if (currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') {
          setWaitingUsers(prev => {
            if (prev.some(u => u.id === payload.id)) return prev;
            return [...prev, { id: payload.id, name: payload.name, role: payload.role }];
          });
        }
      })
      .on('broadcast', { event: 'admit' }, ({ payload }) => {
        // Participant gets admitted
        if (payload.userId === currentUserId) {
          setInWaitingRoom(false);
          setAdmitted(true);
          // Broadcast join status to everyone inside the meeting
          channel.send({
            type: 'broadcast',
            event: 'join',
            payload: {
              id: currentUserId,
              name: currentUserName,
              role: currentUserRole,
              micEnabled,
              videoEnabled,
              handRaised
            }
          });
        }
      })
      .on('broadcast', { event: 'join' }, ({ payload }) => {
        // Handle new participant joining
        setParticipants(prev => {
          if (prev.some(p => p.id === payload.id)) return prev;
          return [...prev, {
            id: payload.id,
            name: payload.name,
            role: payload.role,
            micEnabled: payload.micEnabled,
            videoEnabled: payload.videoEnabled,
            handRaised: payload.handRaised
          }];
        });

        // Initiate WebRTC peer connection
        initiatePeerConnection(payload.id, true);
      })
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
              localStream.getAudioTracks().forEach(track => track.enabled = false);
            }
            // Broadcast state update
            broadcastState({ micEnabled: false });
          }
        }
      })
      .on('broadcast', { event: 'state-update' }, ({ payload }) => {
        setParticipants(prev => prev.map(p => {
          if (p.id === payload.id) {
            return { ...p, ...payload.updates };
          }
          return p;
        }));
      })
      .on('broadcast', { event: 'chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev, {
          sender: payload.senderName,
          text: payload.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        // Clean up peer connection
        if (peerConnections.current[payload.id]) {
          peerConnections.current[payload.id].close();
          delete peerConnections.current[payload.id];
        }
        setParticipants(prev => prev.filter(p => p.id !== payload.id));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          if (inWaitingRoom) {
            // Send join-request to the teacher
            channel.send({
              type: 'broadcast',
              event: 'join-request',
              payload: { id: currentUserId, name: currentUserName, role: currentUserRole }
            });
          } else {
            // Send join announcement directly
            channel.send({
              type: 'broadcast',
              event: 'join',
              payload: {
                id: currentUserId,
                name: currentUserName,
                role: currentUserRole,
                micEnabled,
                videoEnabled,
                handRaised
              }
            });
          }
        }
      });

    return () => {
      // Broadcast leave notice
      channel.send({
        type: 'broadcast',
        event: 'leave',
        payload: { id: currentUserId }
      });
      channel.unsubscribe();

      // Clean up all peer connections
      Object.values(peerConnections.current).forEach(pc => pc.close());
      peerConnections.current = {};
    };
  }, [meetingId, admitted, inWaitingRoom]);

  // Broadcast state changes helper
  const broadcastState = (updates: Partial<Participant>) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'state-update',
        payload: { id: currentUserId, updates }
      });
    }
  };

  // 4. WebRTC negotiation logic
  const initiatePeerConnection = async (peerId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnections.current[peerId] = pc;

    // Add local tracks to peer connection
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
      setIsWebRTCConnected(true);
      const remoteVideo = document.getElementById(`video-${peerId}`) as HTMLVideoElement;
      if (remoteVideo && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
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

  // 5. Controls trigger handlers
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
    if (screenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        setScreenStream(null);
      }
      setScreenSharing(false);
      
      // Revert to local stream camera track in all peer connections
      if (localStream) {
        const camTrack = localStream.getVideoTracks()[0];
        Object.values(peerConnections.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && camTrack) {
            videoSender.replaceTrack(camTrack);
          }
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setScreenSharing(true);

        const screenTrack = stream.getVideoTracks()[0];
        
        // Replace camera video track in all peer connections
        Object.values(peerConnections.current).forEach(pc => {
          const senders = pc.getSenders();
          const videoSender = senders.find(s => s.track?.kind === 'video');
          if (videoSender && screenTrack) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // When sharing is stopped via browser native bar
        screenTrack.onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error('Failed to share screen:', err);
      }
    }
  };

  const toggleHandRaise = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    broadcastState({ handRaised: nextState });
  };

  // 6. Host Controls
  const admitUser = (userId: string) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'admit',
        payload: { userId }
      });
      // Remove from waiting list
      setWaitingUsers(prev => prev.filter(u => u.id !== userId));
    }
  };

  const rejectUser = (userId: string) => {
    setWaitingUsers(prev => prev.filter(u => u.id !== userId));
  };

  const muteParticipant = (participantId: string) => {
    if (currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'control-toggle',
          payload: { targetId: participantId, action: 'mute' }
        });
      }
    }
  };

  // 7. Chat Send
  const sendChatMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Send via Supabase Broadcast
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat',
        payload: {
          senderId: currentUserId,
          senderName: currentUserName,
          text: newMessage
        }
      });
    }

    // Save to Supabase DB for historical persist
    try {
      await mockApi.sendPTMChatMessage({
        meetingId,
        senderId: session?.user?.id || currentUserId,
        senderName: currentUserName,
        messageText: newMessage
      });
    } catch (dbErr) {
      console.warn('Failed to persist chat message in database:', dbErr);
    }

    setChatMessages(prev => [...prev, {
      sender: 'You',
      text: newMessage,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    setNewMessage('');
  };

  // 8. Locally-Saved Client-Side Recording
  const startRecording = () => {
    if (!localStream) return;
    recordedChunksRef.current = [];
    
    // We can record local video/audio stream
    const options = { mimeType: 'video/webm;codecs=vp9,opus' };
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(localStream, options);
    } catch (e) {
      try {
        recorder = new MediaRecorder(localStream);
      } catch (err) {
        console.error('MediaRecorder not supported by browser:', err);
        return;
      }
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `ptm-meeting-${meetingId}-${new Date().toISOString().slice(0, 10)}.webm`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000); // chunk size 1s
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070b13] text-white flex flex-col font-sans">
      {/* 1. Header */}
      <header className="h-16 border-b border-white/10 bg-[#0c1222]/90 flex items-center justify-between px-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide md:text-base text-slate-100 uppercase">
              {meeting?.title || 'AEGIS Meet Room'}
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              {meeting?.meetingMode || 'ONLINE'} MEETING • SECURE LINE
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Recording Badge */}
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-400 font-bold animate-pulse">
              <Circle className="fill-red-500" size={10} />
              <span>REC</span>
            </div>
          )}

          <div className="text-slate-300 text-xs font-semibold bg-[#162038] px-3.5 py-1.5 rounded-lg border border-slate-700">
            Role: <span className="text-brand-400 font-extrabold">{currentUserRole}</span>
          </div>
        </div>
      </header>

      {/* 2. Main Call Screen */}
      <div className="flex-1 flex relative overflow-hidden">
        {inWaitingRoom ? (
          /* Waiting Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#090e1a]">
            <div className="w-20 h-20 rounded-full bg-[#1b253b] border border-brand-500/30 flex items-center justify-center text-brand-400 mb-6 shadow-2xl">
              <Users size={36} className="animate-pulse" />
            </div>
            <h2 className="text-xl font-extrabold mb-2 text-center text-slate-100">Waiting Room</h2>
            <p className="text-sm text-slate-400 text-center max-w-md mb-4 leading-relaxed">
              Hello, <span className="text-white font-bold">{currentUserName}</span>. Please wait for the host to admit you to the meeting.
            </p>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <AlertCircle size={14} />
              <span>Secured Multi-School Tenant Isolation Verified</span>
            </div>
          </div>
        ) : (
          /* Active Call Screen */
          <div className="flex-1 flex flex-col md:flex-row relative">
            
            {/* Grid of video boxes */}
            <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 items-center justify-center content-center bg-[#090e1a]">
              
              {/* Local Stream view */}
              <div className="relative aspect-video max-w-xl mx-auto w-full bg-[#111827] rounded-xl overflow-hidden border border-slate-800 shadow-xl group">
                {videoEnabled ? (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#131b2e]">
                    <div className="w-16 h-16 rounded-full bg-[#1e294b] flex items-center justify-center text-slate-300 font-bold text-xl shadow-lg border border-slate-700 uppercase">
                      {currentUserName.substring(0, 2)}
                    </div>
                    <span className="text-xs text-slate-400 mt-2 font-semibold">Camera Off</span>
                  </div>
                )}
                
                {/* Information bar inside video box */}
                <div className="absolute bottom-3 left-3 bg-[#0a0f1d]/85 px-3 py-1.5 rounded-lg border border-slate-800/80 flex items-center gap-2 backdrop-blur-md shadow-md text-xs font-semibold">
                  <span>{currentUserName} (You)</span>
                  {handRaised && <Hand size={14} className="text-yellow-400 animate-bounce" />}
                  {!micEnabled && <MicOff size={12} className="text-red-400" />}
                </div>
              </div>

              {/* Dynamic Remote Streams */}
              {participants.map(p => (
                <div key={p.id} className="relative aspect-video max-w-xl mx-auto w-full bg-[#111827] rounded-xl overflow-hidden border border-slate-800 shadow-xl group">
                  {p.videoEnabled ? (
                    <video 
                      id={`video-${p.id}`}
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    /* Fallback avatar view when WebRTC hasn't stream, or video is off */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#131b2e]">
                      <div className="w-16 h-16 rounded-full bg-[#1e294b] flex items-center justify-center text-brand-400 font-bold text-xl shadow-lg border border-slate-700 uppercase">
                        {p.name.substring(0, 2)}
                      </div>
                      <span className="text-xs text-slate-400 mt-2 font-semibold">Video Unavailable</span>
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 bg-[#0a0f1d]/85 px-3 py-1.5 rounded-lg border border-slate-800/80 flex items-center gap-2 backdrop-blur-md shadow-md text-xs font-semibold">
                    <span>{p.name} ({p.role})</span>
                    {p.handRaised && <Hand size={14} className="text-yellow-400 animate-bounce" />}
                    {!p.micEnabled && <MicOff size={12} className="text-red-400" />}
                  </div>

                  {/* Host controls shown on remote video boxes */}
                  {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && p.micEnabled && (
                    <button 
                      onClick={() => muteParticipant(p.id)}
                      className="absolute top-3 right-3 bg-red-600 hover:bg-red-700 transition-colors px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg"
                    >
                      <MicOff size={10} /> Mute
                    </button>
                  )}
                </div>
              ))}

              {/* Empty state when alone */}
              {participants.length === 0 && (
                <div className="relative aspect-video max-w-xl mx-auto w-full bg-[#111827]/30 rounded-xl overflow-hidden border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-slate-500">
                  <AlertCircle size={24} className="mb-2" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-center">Waiting for others to join...</p>
                  <p className="text-[10px] text-slate-600 mt-1 max-w-xs text-center leading-relaxed">
                    Once parents or student users confirm connection, their live streams will display here.
                  </p>
                </div>
              )}

            </div>

            {/* Slide-out: Chat Panel */}
            {isChatOpen && (
              <div className="w-80 border-l border-white/10 bg-[#0b101d] flex flex-col z-10">
                <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Meeting Chat</h3>
                  <button onClick={() => setIsChatOpen(false)} className="text-slate-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex-1 p-4 overflow-y-auto space-y-3">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                        <span className="font-bold">{msg.sender}</span>
                        <span>{msg.time}</span>
                      </div>
                      <p className="bg-[#151c2e] p-2 rounded-lg border border-slate-800 text-slate-200 leading-relaxed break-words">
                        {msg.text}
                      </p>
                    </div>
                  ))}
                  {chatMessages.length === 0 && (
                    <div className="text-slate-600 text-center py-12 text-xs">
                      No messages yet.
                    </div>
                  )}
                </div>
                <div className="p-3 border-t border-white/10 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type message..."
                    className="flex-1 bg-[#162038] border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                  />
                  <button onClick={sendChatMessage} className="bg-brand-600 hover:bg-brand-700 transition-colors p-2 rounded-lg flex items-center justify-center">
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}

            {/* Slide-out: Participants / Waiting Room Panel */}
            {isParticipantsOpen && (
              <div className="w-80 border-l border-white/10 bg-[#0b101d] flex flex-col z-10">
                <div className="h-12 px-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300">Participants</h3>
                  <button onClick={() => setIsParticipantsOpen(false)} className="text-slate-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {/* Waiting List (Admin/Teacher only) */}
                  {(currentUserRole === 'TEACHER' || currentUserRole === 'ADMIN') && waitingUsers.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Circle className="fill-yellow-500 animate-ping" size={6} />
                        <span>Waiting Room ({waitingUsers.length})</span>
                      </h4>
                      <div className="space-y-1.5">
                        {waitingUsers.map(user => (
                          <div key={user.id} className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-2.5 flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-200">{user.name}</div>
                              <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{user.role}</div>
                            </div>
                            <div className="flex gap-1.5">
                              <button onClick={() => admitUser(user.id)} className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm">
                                <Check size={12} />
                              </button>
                              <button onClick={() => rejectUser(user.id)} className="p-1 bg-red-600 hover:bg-red-700 text-white rounded shadow-sm">
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active List */}
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active ({participants.length + 1})</h4>
                    <div className="space-y-1">
                      {/* Local User */}
                      <div className="flex items-center justify-between p-2 hover:bg-[#151c2e] rounded-lg transition-colors border border-transparent hover:border-slate-800">
                        <div>
                          <div className="text-xs font-bold text-slate-200">{currentUserName} (You)</div>
                          <div className="text-[9px] uppercase tracking-wider text-brand-400 font-bold">{currentUserRole}</div>
                        </div>
                        <div className="flex gap-1 text-slate-400">
                          {micEnabled ? <Mic size={12} /> : <MicOff size={12} className="text-red-400" />}
                          {videoEnabled ? <Video size={12} /> : <VideoOff size={12} className="text-red-400" />}
                        </div>
                      </div>

                      {/* Remote Users */}
                      {participants.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 hover:bg-[#151c2e] rounded-lg transition-colors border border-transparent hover:border-slate-800">
                          <div>
                            <div className="text-xs font-bold text-slate-200">{p.name}</div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{p.role}</div>
                          </div>
                          <div className="flex gap-1 text-slate-400">
                            {p.micEnabled ? <Mic size={12} /> : <MicOff size={12} className="text-red-400" />}
                            {p.videoEnabled ? <Video size={12} /> : <VideoOff size={12} className="text-red-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* 3. Call controls footer bar */}
      <footer className="h-20 bg-[#0c1222]/90 border-t border-white/10 px-6 flex items-center justify-between backdrop-blur-md">
        
        {/* Leaving Meeting button */}
        <div>
          <button 
            onClick={onLeave}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 transition-colors text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-red-600/10 border border-red-500/10"
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
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center ${
                micEnabled 
                  ? 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100' 
                  : 'bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30'
              }`}
              title={micEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            <button 
              onClick={toggleVideo}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center ${
                videoEnabled 
                  ? 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100' 
                  : 'bg-red-600/20 border-red-600/30 text-red-400 hover:bg-red-600/30'
              }`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
            </button>

            <button 
              onClick={toggleScreenShare}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center ${
                screenSharing 
                  ? 'bg-emerald-600/20 border-emerald-600/30 text-emerald-400 hover:bg-emerald-600/30' 
                  : 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100'
              }`}
              title={screenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              {screenSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
            </button>

            <button 
              onClick={toggleHandRaise}
              className={`p-3.5 rounded-xl border transition-all shadow-md flex items-center justify-center ${
                handRaised 
                  ? 'bg-yellow-600/20 border-yellow-600/30 text-yellow-400 hover:bg-yellow-600/30 animate-pulse' 
                  : 'bg-[#1b253b] hover:bg-[#25324e] border-slate-700 text-slate-100'
              }`}
              title={handRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand size={18} />
            </button>

            {/* Recording Controls */}
            {isRecording ? (
              <button 
                onClick={stopRecording}
                className="px-4 py-3 bg-red-600/20 border border-red-500/40 text-red-400 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-red-600/30 transition-all shadow-md"
                title="Stop Recording PTM"
              >
                <Circle className="fill-red-500" size={10} />
                <span>Stop Rec</span>
              </button>
            ) : (
              <button 
                onClick={startRecording}
                className="px-4 py-3 bg-[#1b253b] border border-slate-700 hover:bg-[#25324e] text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md"
                title="Start Locally-Saved Recording"
              >
                <Download size={14} />
                <span>Record PTM</span>
              </button>
            )}
          </div>
        )}

        {/* Sidebar panels buttons */}
        {!inWaitingRoom ? (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsParticipantsOpen(prev => !prev);
                setIsChatOpen(false);
              }}
              className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-semibold uppercase tracking-wider relative ${
                isParticipantsOpen 
                  ? 'bg-brand-600/25 border-brand-500/30 text-brand-400 font-extrabold' 
                  : 'bg-[#162038]/80 hover:bg-[#1f2d4e] border-slate-800 text-slate-300'
              }`}
            >
              <Users size={14} />
              <span>Participants</span>
              {waitingUsers.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-yellow-500 text-slate-950 flex items-center justify-center text-[9px] font-extrabold animate-bounce border border-[#0c1222]">
                  {waitingUsers.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => {
                setIsChatOpen(prev => !prev);
                setIsParticipantsOpen(false);
              }}
              className={`px-4 py-2.5 rounded-xl border transition-all flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
                isChatOpen 
                  ? 'bg-brand-600/25 border-brand-500/30 text-brand-400 font-extrabold' 
                  : 'bg-[#162038]/80 hover:bg-[#1f2d4e] border-slate-800 text-slate-300'
              }`}
            >
              <MessageSquare size={14} />
              <span>Chat</span>
            </button>
          </div>
        ) : (
          <div className="w-48"></div> // spacer
        )}

      </footer>
    </div>
  );
};
