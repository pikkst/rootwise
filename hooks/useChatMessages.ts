import { useState, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { ChatMessage, DbChatMessage } from '../types';

export function useChatMessages(userId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (data) {
      setMessages(
        (data as DbChatMessage[]).map((m) => ({
          id: m.id,
          sender: m.sender,
          text: m.text,
          timestamp: new Date(m.created_at),
        }))
      );
    }
    setLoading(false);
  }, [userId]);

  const addMessage = async (
    sender: 'user' | 'ai' | 'partner',
    text: string
  ) => {
    if (!userId) return;

    const msg: ChatMessage = {
      id: Date.now().toString(),
      sender,
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, msg]);

    // Persist to Supabase
    const { data } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        sender,
        text,
      })
      .select()
      .single();

    // Update with real ID
    if (data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, id: (data as DbChatMessage).id }
            : m
        )
      );
    }

    return msg;
  };

  const clearMessages = () => setMessages([]);

  return {
    messages,
    loading,
    fetchMessages,
    addMessage,
    clearMessages,
  };
}
