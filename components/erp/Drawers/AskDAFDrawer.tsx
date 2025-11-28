'use client';

import React, { useState, useRef, useEffect } from 'react';
import { BaseDrawer } from './BaseDrawer';
import { Bot, Send, Loader2, Sparkles, User, FileText, Calculator, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AskDAFDrawerProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  context?: {
    type: 'invoice' | 'client' | 'supplier' | 'expense' | 'general';
    id?: string;
    name?: string;
  };
}

const suggestedQuestions = [
  { icon: Calculator, text: "Quel est mon solde TVA ce mois-ci ?" },
  { icon: FileText, text: "Liste les factures en retard" },
  { icon: TrendingUp, text: "Analyse mes dépenses du trimestre" },
  { icon: Sparkles, text: "Comment optimiser ma trésorerie ?" },
];

export function AskDAFDrawer({ open, onClose, orgId, context }: AskDAFDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: context?.name
        ? `Bonjour ! Je suis votre assistant DAF. Je vois que vous consultez ${context.name}. Comment puis-je vous aider ?`
        : 'Bonjour ! Je suis votre assistant DAF. Posez-moi vos questions sur la comptabilité, les factures, ou la gestion financière.',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the DAF chat API
      const response = await fetch('/api/erp/daf/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          org_id: orgId,
          context: context,
          history: messages.slice(-6), // Last 6 messages for context
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || "Je n'ai pas pu traiter votre demande. Veuillez réessayer.",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      // Fallback response
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Je suis désolé, je ne peux pas répondre pour le moment. L'API DAF n'est pas encore configurée. Contactez l'administrateur.",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
  };

  return (
    <BaseDrawer
      open={open}
      onClose={onClose}
      title="Ask DAF"
      subtitle="Assistant IA Financier"
      icon={<Bot size={20} />}
      width="lg"
    >
      <div className="flex flex-col h-[calc(100vh-200px)]">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-3",
                msg.role === 'user' ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'user'
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-purple-500/20 text-purple-400"
              )}>
                {msg.role === 'user' ? <User size={16} /> : <Sparkles size={16} />}
              </div>

              {/* Message Bubble */}
              <div className={cn(
                "max-w-[80%] p-4 rounded-2xl",
                msg.role === 'user'
                  ? "bg-cyan-500/10 border border-cyan-500/20 text-cyan-50"
                  : "bg-slate-800/80 border border-white/5 text-slate-200"
              )}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className="text-[10px] text-slate-500 mt-2 block">
                  {msg.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div className="bg-slate-800/80 border border-white/5 p-4 rounded-2xl">
                <div className="flex items-center gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm">Réflexion en cours...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions (show only when few messages) */}
        {messages.length <= 2 && (
          <div className="py-4 border-t border-white/5">
            <p className="text-xs text-slate-500 mb-3">Questions suggérées</p>
            <div className="grid grid-cols-2 gap-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestedQuestion(q.text)}
                  className="flex items-center gap-2 p-3 rounded-xl bg-slate-800/50 border border-white/5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:border-white/10 transition-colors"
                >
                  <q.icon size={14} className="text-cyan-400 shrink-0" />
                  <span className="truncate">{q.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-white/10 pt-4">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question..."
              rows={1}
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none resize-none"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 size={20} className="animate-spin text-white" />
              ) : (
                <Send size={20} className="text-white" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            DAF utilise l'IA pour analyser vos données financières. Les réponses sont indicatives.
          </p>
        </div>
      </div>
    </BaseDrawer>
  );
}

export default AskDAFDrawer;
