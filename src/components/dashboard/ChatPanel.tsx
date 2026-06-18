'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FRMConfig, ChatMessage } from '@/lib/types';
import { fetchEndpoint, sendChatMessage } from '@/lib/api';
import { useTheme } from '@/lib/useTheme';

interface Props {
  config: FRMConfig;
}

/**
 * In-game chat panel that polls the FRM server for chat messages
 * and allows the user to send messages to players in-game.
 */
export function ChatPanel({ config }: Props) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const data = await fetchEndpoint<ChatMessage[]>(config, 'getChatMessages');
      setMessages(data || []);
      setError(null);
    } catch (e) {
      // Chat may not be enabled or endpoint unavailable
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      await sendChatMessage(config, text);
      // Optimistically add the message
      setMessages(prev => [...prev, {
        Name: 'You',
        Message: text,
        Timestamp: Date.now() / 1000,
      }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-8 h-8" style={{ color: theme.accent }} fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2"
      >
        {messages.length === 0 ? (
          <div className="text-center py-16" style={{ color: theme.textSecondary }}>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm mt-1">Type a message to send it to the game chat</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isOwn = msg.Name === 'You';
            return (
              <div key={i} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] rounded-xl px-4 py-2.5"
                  style={{
                    backgroundColor: isOwn ? theme.accent + '20' : theme.bgCard,
                    border: `1px solid ${isOwn ? theme.accent + '40' : theme.borderColor}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: isOwn ? theme.accent : theme.info }}>
                      {msg.Name}
                    </span>
                    {msg.Timestamp && (
                      <span className="text-[10px]" style={{ color: theme.muted }}>{formatTime(msg.Timestamp)}</span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words" style={{ color: theme.textPrimary }}>{msg.Message}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs px-3 py-2 rounded-lg mb-2" style={{ color: theme.danger, backgroundColor: theme.danger + '18' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send)"
          rows={1}
          className="flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none transition-colors resize-none search-input"
          style={{ backgroundColor: theme.bgCard, borderColor: theme.borderColor, color: theme.textPrimary, borderWidth: '1px', borderStyle: 'solid' }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !input.trim()}
          className="px-4 py-2.5 rounded-lg text-black text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all btn-accent"
          style={{ backgroundColor: theme.accent }}
        >
          {sending ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
