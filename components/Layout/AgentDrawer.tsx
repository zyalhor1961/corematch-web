'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Send, Bot } from 'lucide-react';

interface AgentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'agent' | 'user';
  text: string;
}

const AgentDrawer = ({ isOpen, onClose }: AgentDrawerProps) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', text: 'Bonsoir. J\'ai analysé votre trésorerie. Souhaitez-vous un résumé ?' }
  ]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real AI integration with DAF API
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input;
    const newMsgs = [...messages, { role: 'user', text: userMessage } as Message];
    setMessages(newMsgs);
    setInput('');

    // Add loading message
    setMessages(prev => [...prev, { role: 'agent', text: '...' }]);

    try {
      const response = await fetch('/api/daf/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: userMessage,
          language: 'fr',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      // Remove loading message and add real response
      setMessages(prev => {
        const withoutLoading = prev.slice(0, -1);
        return [...withoutLoading, {
          role: 'agent',
          text: data.data?.answer || 'Je suis désolé, je n\'ai pas pu traiter votre demande.'
        }];
      });
    } catch (error) {
      console.error('Error calling DAF API:', error);
      // Remove loading message and add error message
      setMessages(prev => {
        const withoutLoading = prev.slice(0, -1);
        return [...withoutLoading, {
          role: 'agent',
          text: 'Désolé, une erreur s\'est produite. Veuillez réessayer.'
        }];
      });
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-navy-glass/90 backdrop-blur-xl border-l border-white/10 z-50 transform transition-transform duration-300 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded bg-agent-purple/20 flex items-center justify-center text-agent-purple">
              <Bot size={18} />
            </div>
            <span className="font-bold text-white">Demander à DAF</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                ? 'bg-neon-teal/20 text-neon-teal border border-neon-teal/30 rounded-tr-none'
                : 'bg-white/5 text-slate-300 border border-white/5 rounded-tl-none'
                }`}>
                {typeof msg.text === 'string' ? msg.text : JSON.stringify(msg.text)}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Posez une question sur vos finances..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-agent-purple/50 focus:ring-1 focus:ring-agent-purple/50 transition-all"
            />
            <button
              onClick={handleSend}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-agent-purple/20 text-agent-purple rounded-lg hover:bg-agent-purple hover:text-white transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default AgentDrawer;
