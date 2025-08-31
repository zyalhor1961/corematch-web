"use client";
import React, { useState, useRef, useEffect } from 'react';
import Sidebar from '@/app/components/dashboard/Sidebar';
import { Send, Bot, User, Sparkles, FileText, TrendingUp } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Message d'accueil
    const welcomeMessage: Message = {
      id: '1',
      type: 'ai',
      content: "Salut ! Je suis votre assistant IA CoreMatch. Je peux analyser vos candidats, filtrer les profils, ou répondre à vos questions sur le recrutement. Comment puis-je vous aider ?",
      timestamp: new Date(),
      suggestions: [
        "Quels sont mes meilleurs candidats ?",
        "Analyse les compétences des candidats",
        "Qui correspond au poste de développeur ?",
        "Génère un rapport de sélection"
      ]
    };
    setMessages([welcomeMessage]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAIResponse = async (userMessage: string): Promise<Message> => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('meilleur') || message.includes('candidat')) {
      return {
        id: Date.now().toString(),
        type: 'ai',
        content: "Voici vos 3 meilleurs candidats basés sur les scores IA :\n\n**1. Sophie Martin (92%)** - Développeur Full-Stack\n✅ Excellente maîtrise React/Node.js\n✅ 5 ans d'expérience\n\n**2. Thomas Dubois (87%)** - Data Scientist\n✅ Expert Python/ML\n✅ Portfolio solide\n\n**3. Marie Leroy (84%)** - UX Designer\n✅ Design thinking\n✅ Expérience startup",
        timestamp: new Date(),
        suggestions: [
          "Analyse Sophie Martin en détail",
          "Compare Thomas et Sophie",
          "Planning d'entretiens",
          "Génère rapport PDF"
        ]
      };
    }
    
    return {
      id: Date.now().toString(),
      type: 'ai',
      content: "Je comprends votre question. Voici ce que je peux faire :\n\n📊 **Analyse de candidats** - Scoring et comparaisons\n🔍 **Recherche intelligente** - Filtrage par critères\n📋 **Gestion process** - Suivi des présélections\n📈 **Rapports** - Insights et métriques\n\nQue souhaitez-vous explorer ?",
      timestamp: new Date(),
      suggestions: [
        "Analyser mes candidats",
        "Filtrer par compétences",
        "Voir les statistiques",
        "Aide pour entretiens"
      ]
    };
  };

  const sendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    setTimeout(async () => {
      const aiResponse = await getAIResponse(currentMessage);
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  const sendSuggestion = (suggestion: string) => {
    setCurrentMessage(suggestion);
    setTimeout(() => sendMessage(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b13] text-white flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/5 backdrop-blur-xl border-b border-white/10 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30 mr-4">
                <Bot className="h-6 w-6 text-purple-300" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Chat IA CoreMatch</h1>
                <p className="text-white/60">Assistant intelligent pour votre recrutement</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-white/60">
              <Sparkles className="h-4 w-4" />
              <span>Powered by OpenAI & Claude</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : ''}`}>
              {message.type === 'ai' && (
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="h-5 w-5 text-white" />
                </div>
              )}
              
              <div className={`max-w-2xl ${message.type === 'user' ? 'order-first' : ''}`}>
                <div className={`p-4 rounded-2xl ${
                  message.type === 'user' 
                    ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white' 
                    : 'bg-white/5 border border-white/10 text-white'
                }`}>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content.split('**').map((part, index) => 
                      index % 2 === 0 ? part : <strong key={index}>{part}</strong>
                    )}
                  </div>
                  
                  {message.suggestions && message.type === 'ai' && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {message.suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          onClick={() => sendSuggestion(suggestion)}
                          className="text-xs bg-white/10 hover:bg-white/20 text-white/80 px-3 py-1 rounded-full border border-white/20 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className={`text-xs text-white/40 mt-1 ${message.type === 'user' ? 'text-right' : ''}`}>
                  {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {message.type === 'user' && (
                <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-white/5 backdrop-blur-xl border-t border-white/10 p-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <textarea
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Posez une question sur vos candidats, demandez une analyse..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:border-purple-500/50 focus:outline-none resize-none"
                rows={1}
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
            </div>
            
            <button
              onClick={sendMessage}
              disabled={!currentMessage.trim() || isTyping}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-xl hover:from-purple-400 hover:to-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-3 text-xs text-white/40">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                127 candidats analysés
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                8 offres actives
              </span>
            </div>
            <span>Appuyez sur Entrée pour envoyer</span>
          </div>
        </div>
      </div>
    </div>
  );
}