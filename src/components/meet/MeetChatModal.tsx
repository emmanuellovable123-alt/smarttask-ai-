import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Shield, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export interface MeetPerson {
  id: string;
  name: string;
  photoUrl?: string;
  maritalStatus: string;
  approximateLocation: string;
  onlineStatus: 'online' | 'recent';
  lastSeenText: string;
  currentTask: string;
  taskCategory: string;
  friendStatus?: 'none' | 'pending' | 'accepted' | 'declined';
}

interface MeetChatModalProps {
  person: MeetPerson;
  currentUserId: string;
  currentUserAge: string;
  currentUserName: string;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'me' | 'them';
  text: string;
  timestamp: string;
}

export function MeetChatModal({
  person,
  currentUserId,
  currentUserAge,
  currentUserName,
  onClose
}: MeetChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load conversation messages from server
  useEffect(() => {
    let isMounted = true;
    async function fetchMessages() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          userId: currentUserId,
          userAge: currentUserAge,
          targetUserId: person.id
        });
        const res = await fetch(`/api/meet/chat/get-messages?${query.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load conversation');

        if (isMounted) {
          if (Array.isArray(data.messages) && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            // Seed a polite icebreaker message if new conversation
            setMessages([
              {
                id: 'icebreaker',
                sender: 'them',
                text: `Hi ${currentUserName}! I noticed we're both focused on ${person.taskCategory}. Let's stay accountable!`,
                timestamp: 'Just now'
              }
            ]);
          }
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Error loading messages');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchMessages();
    return () => {
      isMounted = false;
    };
  }, [currentUserId, currentUserAge, person.id, currentUserName, person.taskCategory]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    // Optimistic message
    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      sender: 'me',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');

    try {
      const res = await fetch('/api/meet/chat/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: currentUserId,
          senderAge: currentUserAge,
          receiverId: person.id,
          text
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      if (data.message) {
        setMessages(prev =>
          prev.map(m => (m.id === tempId ? data.message : m))
        );
      }
    } catch (err: any) {
      setError(err.message || 'Message could not be delivered');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      id="meet-chat-backdrop"
      className="fixed inset-0 z-[270] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs"
    >
      <motion.div
        id="meet-chat-modal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 flex flex-col h-[520px] overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="relative">
              {person.photoUrl ? (
                <img
                  src={person.photoUrl}
                  alt={person.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                  {person.name.charAt(0)}
                </div>
              )}
              {person.onlineStatus === 'online' && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>{person.name}</span>
                <span className="text-[10px] text-slate-400 font-normal">({person.maritalStatus})</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                {person.approximateLocation} • <span className="text-emerald-600 font-medium">{person.lastSeenText}</span>
              </p>
            </div>
          </div>

          <button
            id="close-meet-chat-btn"
            onClick={onClose}
            aria-label="Close Chat"
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Safety Note banner */}
        <div className="bg-amber-50/80 px-4 py-1.5 border-b border-amber-100 flex items-center gap-1.5 text-[11px] text-amber-800">
          <Shield className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
          <span>Keep conversations respectful. Private contact details are never shared.</span>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
          {loading ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Loading messages...</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-2 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-1.5 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'me' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === 'me'
                        ? 'bg-blue-600 text-white rounded-br-xs shadow-xs'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs shadow-xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.timestamp}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Bar (NO ads while typing or sending messages!) */}
        <form
          onSubmit={handleSend}
          className="p-3 bg-white border-t border-slate-100 flex items-center gap-2 flex-shrink-0"
        >
          <input
            id="meet-chat-input"
            type="text"
            value={inputText}
            disabled={sending}
            onChange={e => setInputText(e.target.value)}
            placeholder={`Message ${person.name}...`}
            className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            id="send-chat-msg-btn"
            disabled={!inputText.trim() || sending}
            className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors shadow-xs"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
