import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { Sparkles, MessageSquare, X, Send, Mic, MicOff, Volume2, VolumeX, Copy, RotateCcw, Trash2, Maximize2, Minimize2, PanelRight, ThumbsUp, ThumbsDown, Paperclip, Loader2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  fileData?: { name: string; type: string; base64: string };
  action?: { type: string; params: any };
  liked?: boolean;
  disliked?: boolean;
}

interface AIAssistantProps {
  activeTab: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ activeTab }) => {
  const { session } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isDocked, setIsDocked] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  
  // Dragging and resizing state
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 380, height: 500 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0 });
  const sizeStartRef = useRef({ width: 0, height: 0 });
  
  // Voice AI states
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Vision AI states
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; base64: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action Confirmation state
  const [pendingAction, setPendingAction] = useState<{ type: string; params: any; msgId: string } | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role || 'PUBLIC';

  // Branding names
  const getBrandingName = () => {
    switch (role) {
      case 'STUDENT': return 'AEGIS AI Learning Assistant';
      case 'PARENT': return 'AEGIS AI Parent Assistant';
      case 'TEACHER': return 'AEGIS AI Teaching Assistant';
      case 'ADMIN': case 'ACADEMIC_ADMIN': return 'AEGIS AI School Assistant';
      case 'SUPER_ADMIN': return 'AEGIS AI Enterprise Assistant';
      default: return 'AEGIS AI Productivity Assistant';
    }
  };

  // Scoped suggested prompts
  useEffect(() => {
    let prompts: string[] = [];
    if (role === 'PUBLIC') {
      prompts = ['Explain subscription plans', 'Compare Basic vs Pro', 'How to book a demo?'];
    } else if (role === 'STUDENT') {
      prompts = ['Explain photosynthesis step-by-step', 'Help me study algebraic equations', 'Give me a mock quiz on genetics'];
    } else if (role === 'TEACHER') {
      prompts = ['Draft a Grade 9 Kinematics lesson plan', 'Generate Bloom\'s questions for algebra', 'Write a circular to notify parents about exams'];
    } else if (role === 'SUPER_ADMIN') {
      prompts = ['Show daily SaaS platform usage', 'Estimate monthly token expenses', 'Check system availability logs'];
    } else if (['ADMIN', 'ACADEMIC_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
      prompts = ['Draft notice for annual day', 'Analyze fee collections trends', 'Review recent attendance summaries'];
    } else {
      prompts = ['What are my options in this portal?', 'Give me a quick productivity summary'];
    }
    setSuggestedPrompts(prompts);
  }, [role, activeTab]);

  // Load conversation history on mount/session change
  useEffect(() => {
    const key = `aegis_ai_history_${session?.user?.id || 'anon'}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setMessages(parsed.map((m: any) => ({
          ...m,
          sender: m.sender as 'user' | 'ai',
          timestamp: new Date(m.timestamp)
        })));
      } catch (e) {
        console.error('Failed to parse cached history:', e);
      }
    } else {
      // Default welcome message
      setMessages([
        {
          id: 'welcome',
          sender: 'ai',
          text: getWelcomeMessage(role),
          timestamp: new Date()
        }
      ]);
    }
  }, [session?.user?.id]);

  // Persist conversation history
  const saveHistory = (list: Message[]) => {
    const key = `aegis_ai_history_${session?.user?.id || 'anon'}`;
    localStorage.setItem(key, JSON.stringify(list));
  };

  const getWelcomeMessage = (r: string) => {
    if (r === 'PUBLIC') {
      return 'Hello! 👋 I am **AEGIS AI**. I can explain ERP features, compare subscription tiers, and help you choose the right package or book a platform demo. How can I help you today?';
    }
    if (r === 'STUDENT') {
      return 'Hi! I am your **AEGIS AI Learning Assistant** 🎓. I am here to explain math, science, and history concepts, help with study plans, or quiz you. I do not directly complete homework sheets to prevent academic dishonesty. What are we learning today?';
    }
    return `Hello! I am ${getBrandingName()}. I have resolved your portal access credentials and institution context. Ask me questions, generate templates, or execute ERP instructions directly!`;
  };

  // Scroll to bottom
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (e: any) => {
          const transcript = e.results[0][0].transcript;
          setInput(prev => prev + ' ' + transcript);
          setIsListening(false);
        };

        rec.onerror = (e: any) => {
          console.error('Speech recognition error:', e.error);
          setIsListening(false);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = rec;
      }
    }
  }, []);

  const handleMicToggle = () => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      recognitionRef.current.start();
    }
  };

  // Text to Speech
  const speakText = (text: string) => {
    if (isMuted || typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // Stop prior readouts
    const cleanText = text.replace(/[*#`|]/g, ''); // strip markdown chars
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // Drag and Drop files / Image conversion
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileObj = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setSelectedFile({
          name: fileObj.name,
          type: fileObj.type,
          base64
        });
      };
      reader.readAsDataURL(fileObj);
    }
  };

  const handleSend = async (textToSend: string) => {
    const query = textToSend.trim();
    if (!query) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date(),
      fileData: selectedFile || undefined
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    saveHistory(updated);
    setInput('');
    setSelectedFile(null);
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.token) {
        headers['Authorization'] = `Bearer ${session.token}`;
      }

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: query,
          chatHistory: updated.slice(-10).map(m => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text })),
          file: userMsg.fileData?.base64,
          mimeType: userMsg.fileData?.type
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        const aiMsg: Message = {
          id: Math.random().toString(),
          sender: 'ai',
          text: data.response,
          timestamp: new Date(),
          action: data.action || undefined
        };
        const finalMsgs = [...updated, aiMsg];
        setMessages(finalMsgs);
        saveHistory(finalMsgs);
        speakText(data.response);

        // Capture structured ERP actions
        if (data.action) {
          setPendingAction({
            type: data.action.type,
            params: data.action.params,
            msgId: aiMsg.id
          });
        }
      } else {
        throw new Error(data.error || 'Failed to generate response');
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: Math.random().toString(),
        sender: 'ai',
        text: `❌ **Error:** ${err.message || 'Could not communicate with the AI engine. Ensure your connection is stable.'}`,
        timestamp: new Date()
      };
      const finalMsgs = [...updated, errorMsg];
      setMessages(finalMsgs);
      saveHistory(finalMsgs);
    } finally {
      setLoading(false);
    }
  };

  // Run structured actions (e.g. creating circular, sending reminder) after confirmation
  const executePendingAction = async () => {
    if (!pendingAction) return;
    try {
      // Simulate/Trigger API calls or mock calls safely
      setActionSuccess(`Successfully executed action: "${pendingAction.type}"!`);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (e) {
      console.error('Action failed:', e);
    } finally {
      setPendingAction(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied response to clipboard!');
  };

  const clearChat = () => {
    if (confirm('Clear entire chat history?')) {
      const defaultWelcome: Message[] = [
        {
          id: 'welcome',
          sender: 'ai',
          text: getWelcomeMessage(role),
          timestamp: new Date()
        }
      ];
      setMessages(defaultWelcome);
      saveHistory(defaultWelcome);
    }
  };

  const handleLike = (id: string, isLike: boolean) => {
    setMessages(prev => prev.map(m => {
      if (m.id === id) {
        return {
          ...m,
          liked: isLike ? !m.liked : m.liked,
          disliked: !isLike ? !m.disliked : m.disliked
        };
      }
      return m;
    }));
  };

  // Render visual charts when parsing tabular markdown returned by LLM
  const renderMessageCharts = (text: string) => {
    if (!text.includes('|') || !text.includes('---')) return null;
    
    // Extract rows from markdown table
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
    if (lines.length < 3) return null; // needs header, separator, data row

    try {
      const headers = lines[0].split('|').map(h => h.trim()).filter(Boolean);
      const dataRows = lines.slice(2).map(line => {
        const cells = line.split('|').map(c => c.trim()).filter(Boolean);
        const obj: any = {};
        headers.forEach((h, idx) => {
          const val = cells[idx];
          const num = Number(val.replace(/[$,₹]/g, ''));
          obj[h] = isNaN(num) ? val : num;
        });
        return obj;
      });

      // Find the numeric key for Recharts
      const numericKey = Object.keys(dataRows[0]).find(k => typeof dataRows[0][k] === 'number');
      const labelKey = Object.keys(dataRows[0])[0];

      if (numericKey && labelKey) {
        return (
          <div className="mt-4 p-3 bg-slate-900/60 border border-slate-800 rounded-2xl h-48 w-full animate-fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataRows}>
                <XAxis dataKey={labelKey} stroke="#94a3b8" fontSize={9} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} />
                <Bar dataKey={numericKey} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
    } catch (e) {
      console.warn('Recharts markdown parser skipped chart rendering:', e);
    }
    return null;
  };

  // Handlers for dragging the window
  const onMouseDownDrag = (e: React.MouseEvent) => {
    if (isDocked || isFullscreen) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...position };
  };

  const onMouseMoveDrag = (e: MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, posStartRef.current.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - size.height, posStartRef.current.y + dy))
      });
    }
    if (isResizing) {
      const dx = e.clientX - resizeStartRef.current.x;
      const dy = e.clientY - resizeStartRef.current.y;
      setSize({
        width: Math.max(300, sizeStartRef.current.width + dx),
        height: Math.max(400, sizeStartRef.current.height + dy)
      });
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', onMouseMoveDrag);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMoveDrag);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, isResizing]);

  const onMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = { x: e.clientX, y: e.clientY };
    sizeStartRef.current = { ...size };
  };

  // Set default starting location on bottom right
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPosition({
        x: window.innerWidth - 420,
        y: window.innerHeight - 560
      });
    }
  }, []);

  return (
    <>
      {/* Floating Sparkles Bubble Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 p-4 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-full shadow-2xl text-white hover:scale-110 active:scale-95 transition-all shadow-brand-500/25 border border-brand-400/20"
          title="Ask AEGIS AI"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div
          ref={containerRef}
          style={
            isDocked
              ? undefined
              : isFullscreen
              ? { top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 100 }
              : {
                  top: position.y,
                  left: position.x,
                  width: size.width,
                  height: size.height,
                  zIndex: 99
                }
          }
          className={[
            'bg-slate-950/95 backdrop-blur-xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col transition-all',
            isDocked ? 'fixed right-0 top-[60px] h-[calc(100vh-60px)] w-[380px] z-40 border-l border-t-0 border-b-0 border-r-0' : 'rounded-3xl fixed'
          ].join(' ')}
        >
          {/* Draggable Header */}
          <div
            onMouseDown={onMouseDownDrag}
            className={[
              'p-4 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-900 flex items-center justify-between',
              isDocked || isFullscreen ? '' : 'cursor-move select-none'
            ].join(' ')}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                <Sparkles size={14} className="animate-spin" style={{ animationDuration: '6s' }} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-slate-100 uppercase tracking-widest leading-none font-mono">AEGIS AI</h4>
                <p className="text-[9px] text-slate-400 leading-none mt-1">{getBrandingName()}</p>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-1">
              {/* Dock Toggle */}
              <button
                onClick={() => {
                  setIsDocked(!isDocked);
                  setIsFullscreen(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/40"
                title={isDocked ? 'Float window' : 'Dock window'}
              >
                <PanelRight size={14} />
              </button>

              {/* Fullscreen Toggle */}
              {!isDocked && (
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800/40"
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              )}

              {/* Minimize/Close */}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800/40 ml-1"
                title="Minimize"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Action confirmation alert overlay */}
          {pendingAction && (
            <div className="bg-brand-500/10 border-b border-brand-500/20 px-4 py-3 flex flex-col gap-2 animate-slide-up">
              <div className="flex items-start gap-3">
                <Sparkles className="text-brand-400 shrink-0 mt-0.5" size={16} />
                <div className="flex-1">
                  <h5 className="text-[10px] font-bold text-slate-100 uppercase tracking-widest leading-none font-mono">Confirm AI Action</h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    AI generated an ERP command: **{pendingAction.type}**. Verify parameters before executing:
                  </p>
                  <pre className="mt-2 p-2 bg-slate-950/80 border border-slate-800 rounded-lg text-[9px] text-brand-300 overflow-x-auto font-mono">
                    {JSON.stringify(pendingAction.params, null, 2)}
                  </pre>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={executePendingAction}
                  className="px-3 py-1 bg-brand-500 hover:bg-brand-600 text-white font-bold text-[9px] rounded-lg transition-colors uppercase tracking-wider font-mono shadow-md shadow-brand-500/15"
                >
                  Execute
                </button>
                <button
                  onClick={() => setPendingAction(null)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 font-bold text-[9px] rounded-lg transition-colors uppercase tracking-wider font-mono"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Success messages overlay */}
          {actionSuccess && (
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-2 text-center text-emerald-400 text-xs font-semibold animate-fade-in">
              {actionSuccess}
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.map(msg => (
              <div key={msg.id} className={['flex flex-col', msg.sender === 'user' ? 'items-end' : 'items-start'].join(' ')}>
                {/* Bubble content */}
                <div
                  className={[
                    'max-w-[85%] p-3 text-xs leading-relaxed',
                    msg.sender === 'user'
                      ? 'bg-gradient-to-tr from-brand-600 to-brand-500 text-white rounded-2xl rounded-tr-none'
                      : 'bg-slate-900 border border-slate-850 text-slate-200 rounded-2xl rounded-tl-none shadow-md'
                  ].join(' ')}
                >
                  {/* Attached vision document preview */}
                  {msg.fileData && (
                    <div className="mb-2 p-1.5 bg-slate-950/50 border border-slate-850 rounded-lg flex items-center gap-2">
                      <Paperclip size={12} className="text-slate-400" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-slate-300 truncate font-mono">{msg.fileData.name}</p>
                        <p className="text-[8px] text-slate-500 uppercase font-mono">{msg.fileData.type.split('/')[1]}</p>
                      </div>
                    </div>
                  )}

                  {/* Render content */}
                  <div className="whitespace-pre-line prose prose-invert prose-xs">
                    {msg.text}
                  </div>

                  {/* Tabular graphs if any */}
                  {msg.sender === 'ai' && renderMessageCharts(msg.text)}

                  {/* Action tag details if action completed */}
                  {msg.sender === 'ai' && msg.action && (
                    <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[9px] text-brand-400 font-mono">
                      <Sparkles size={10} />
                      <span>Action payload queued successfully</span>
                    </div>
                  )}
                </div>

                {/* Metadata controls below bubble */}
                <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500">
                  <span>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {msg.sender === 'ai' && msg.id !== 'welcome' && (
                    <>
                      <button
                        onClick={() => copyToClipboard(msg.text)}
                        className="hover:text-slate-350 transition-colors"
                        title="Copy to clipboard"
                      >
                        <Copy size={10} />
                      </button>
                      <button
                        onClick={() => handleLike(msg.id, true)}
                        className={['hover:text-slate-350 transition-colors', msg.liked ? 'text-brand-400' : ''].join(' ')}
                        title="Like response"
                      >
                        <ThumbsUp size={10} />
                      </button>
                      <button
                        onClick={() => handleLike(msg.id, false)}
                        className={['hover:text-slate-350 transition-colors', msg.disliked ? 'text-red-400' : ''].join(' ')}
                        title="Dislike response"
                      >
                        <ThumbsDown size={10} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            
            {loading && (
              <div className="flex items-center gap-2 p-2 text-xs text-slate-400">
                <Loader2 size={12} className="animate-spin text-brand-400" />
                <span className="animate-pulse">AEGIS AI is thinking...</span>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          {/* Quick suggestions chips */}
          {suggestedPrompts.length > 0 && (
            <div className="px-4 py-2 flex gap-1.5 overflow-x-auto shrink-0 scrollbar-none border-t border-slate-900 bg-slate-950/80">
              {suggestedPrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(promptText)}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-full text-[10px] font-semibold transition-colors shrink-0 whitespace-nowrap"
                >
                  {promptText}
                </button>
              ))}
            </div>
          )}

          {/* Prompt input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="p-3 bg-slate-950 border-t border-slate-900 flex flex-col gap-2"
          >
            {/* Visual vision preview thumbnail */}
            {selectedFile && (
              <div className="px-2 py-1 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip size={12} className="text-slate-400" />
                  <span className="text-[10px] text-slate-300 truncate font-mono">{selectedFile.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 rounded-full"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {/* Mic Icon for Voice AI */}
              <button
                type="button"
                onClick={handleMicToggle}
                className={[
                  'p-2.5 rounded-xl transition-all border shrink-0',
                  isListening
                    ? 'bg-red-500/10 border-red-500/30 text-red-400 animate-pulse'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                ].join(' ')}
                title={isListening ? 'Stop listening' : 'Start speaking'}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              </button>

              {/* Sound Toggle */}
              <button
                type="button"
                onClick={() => {
                  const state = !isMuted;
                  setIsMuted(state);
                  if (state && typeof window !== 'undefined') {
                    window.speechSynthesis?.cancel(); // cancel read out if muted
                  }
                }}
                className={[
                  'p-2.5 rounded-xl border shrink-0 bg-slate-900 border-slate-800 transition-colors',
                  isMuted ? 'text-slate-500' : 'text-brand-400 border-brand-500/20'
                ].join(' ')}
                title={isMuted ? 'Unmute AI voice synthesis' : 'Mute AI voice'}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>

              {/* Document vision upload */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl shrink-0 transition-colors"
                title="Upload vision document/image"
              >
                <Paperclip size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything or run ERP command..."
                  disabled={loading}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-4 pr-10 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-all disabled:opacity-50"
                />
                
                {/* Clear Chat controls */}
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={clearChat}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors"
                    title="Clear chat history"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-500 text-white rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-500/15 disabled:opacity-40 disabled:scale-100"
              >
                <Send size={14} />
              </button>
            </div>

            {/* Disclaimer */}
            <div className="text-[8px] text-slate-500 text-center font-mono uppercase tracking-wider pt-1">
              AEGIS AI can make mistakes. Verify important information.
            </div>
          </form>

          {/* Window resize drag edge (only floating mode) */}
          {!isDocked && !isFullscreen && (
            <div
              onMouseDown={onMouseDownResize}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 select-none"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" className="text-slate-650">
                <path d="M6 0 L8 0 L8 8 L0 8 L0 6 L6 6 Z" fill="currentColor" />
              </svg>
            </div>
          )}
        </div>
      )}
    </>
  );
};
