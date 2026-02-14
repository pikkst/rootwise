import React, { useEffect, useRef, useState } from 'react';
import SEOHead from '../components/SEOHead';
import { useAuth } from '../context/AuthContext';
import { useChatMessages } from '../hooks/useChatMessages';
import { RootwiseAIService } from '../services/geminiService';

const AiNexusPage: React.FC = () => {
  const { profile } = useAuth();
  const { messages, addMessage, fetchMessages } = useChatMessages(profile?.id);
  const [inputMessage, setInputMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const aiService = useRef(new RootwiseAIService());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile?.id) fetchMessages();
  }, [profile?.id, fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !profile) return;

    await addMessage('user', inputMessage);
    const msgText = inputMessage;
    setInputMessage('');
    setIsAiLoading(true);

    const history = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));
    history.push({ role: 'user', parts: [{ text: msgText }] });

    const response = await aiService.current.getAiMentorResponse(history);
    await addMessage('ai', response || "I'm listening. Tell me more about your goals.");

    setIsAiLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pt-24 pb-32 h-screen flex flex-col">
      <SEOHead
        title="Nexus AI Mentor - Rootwise"
        description="Get personalized guidance from Rootwise's AI mentor. Find quests, learn skills, and connect with community partners."
        path="/ai-nexus"
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-lg">
          ✨
        </div>
        <div>
          <h2 className="text-2xl font-bold">Nexus AI Mentor</h2>
          <p className="text-sm text-slate-500">Your intelligent bridge to community wisdom.</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl">
                👋
              </div>
              <h4 className="font-bold text-slate-800 mb-2 text-xl">How can I help you grow today?</h4>
              <p className="text-slate-500 max-w-sm mx-auto">
                Ask for a new quest, help with a specific skill, or find a community partner.
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-lg mx-auto">
                <button
                  onClick={() => setInputMessage('I want to learn gardening from a senior.')}
                  className="p-4 bg-slate-50 rounded-2xl text-sm hover:bg-indigo-50 transition-colors border border-slate-100 text-left"
                >
                  🌱 "Find me a gardening Sage"
                </button>
                <button
                  onClick={() => setInputMessage('How can I teach coding to teenagers?')}
                  className="p-4 bg-slate-50 rounded-2xl text-sm hover:bg-indigo-50 transition-colors border border-slate-100 text-left"
                >
                  💻 "Offer my coding skills"
                </button>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                  m.sender === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-slate-100 text-slate-800 rounded-tl-none'
                }`}
              >
                <p className="text-sm leading-relaxed">{m.text}</p>
                <p
                  className={`text-[10px] mt-2 opacity-60 ${m.sender === 'user' ? 'text-right' : 'text-left'}`}
                >
                  {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}

          {isAiLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-2">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-.5s]"></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200">
          <div className="relative flex items-center">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask Nexus anything..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-4 pl-6 pr-14 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <button
              onClick={handleSendMessage}
              disabled={isAiLoading}
              className="absolute right-2 p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiNexusPage;
