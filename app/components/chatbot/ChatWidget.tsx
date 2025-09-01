"use client";
import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Sparkles, Star, Rocket } from "lucide-react";

type Role = "user" | "assistant";
interface UiMessage {
  id: string;
  type: "user" | "bot";
  content: string;
  timestamp: Date;
}
interface ApiMessage {
  role: Role;
  content: string;
}

const DEVICE_KEY = "cm_device_id";
const CONV_KEY = "cm_conversation_id";

function ensureDeviceId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Init deviceId + conversationId
  useEffect(() => {
    const did = ensureDeviceId();
    setDeviceId(did || null);
    const savedConv = typeof window !== "undefined" ? localStorage.getItem(CONV_KEY) : null;
    if (savedConv) setConversationId(savedConv);
  }, []);

  // 🔄 Charger l’historique si on a déjà une conversation existante
  useEffect(() => {
    async function loadHistory() {
      if (!conversationId || !deviceId) return;
      try {
        const res = await fetch(`/api/history?conversationId=${conversationId}&limit=100`, {
          headers: { "x-device-id": deviceId },
        });
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(
            data.messages.map((m: { id: string; type: "user" | "bot"; content: string; timestamp: string }) => ({
              id: m.id,
              type: m.type, // 'user' | 'bot'
              content: m.content,
              timestamp: new Date(m.timestamp),
            }))
          );
        }
      } catch (e) {
        console.error("Erreur loadHistory:", e);
      }
    }
    loadHistory();
  }, [conversationId, deviceId]);

  // Auto-ouverture et message de bienvenue
  useEffect(() => {
    const hasVisited = typeof window !== 'undefined' ? localStorage.getItem('cm_has_visited') : null;
    
    if (!hasVisited && !hasAutoOpened) {
      const autoOpenTimer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoOpened(true);
        setIsTyping(true);
        
        // Message d'accueil avec effet de frappe
        const welcomeTimer = setTimeout(() => {
          setIsTyping(false);
          setMessages([
            {
              id: "welcome",
              type: "bot",
              content: "👋 Salut ! Je suis l'assistant IA CoreMatch.\n\n🚀 Je peux t'aider à :\n• Améliorer tes offres d'emploi\n• Scorer des CV automatiquement\n• Automatiser tes flux documentaires\n\nQue veux-tu tester en premier ?",
              timestamp: new Date(),
            },
          ]);
          setShowPulse(true);
          setTimeout(() => setShowPulse(false), 3000);
          
          // Marquer comme visité après le premier message
          if (typeof window !== 'undefined') {
            localStorage.setItem('cm_has_visited', 'true');
          }
        }, 2000);
        
        return () => clearTimeout(welcomeTimer);
      }, 3000); // S'ouvre 3 secondes après le chargement
      
      return () => clearTimeout(autoOpenTimer);
    }
  }, [hasAutoOpened]);
  
  // Message de bienvenue pour les visites suivantes
  useEffect(() => {
    const hasVisited = typeof window !== 'undefined' ? localStorage.getItem('cm_has_visited') : null;
    
    if (hasVisited && !hasInteracted && messages.length === 0 && isOpen) {
      const t = setTimeout(() => {
        setMessages([
          {
            id: "welcome_back",
            type: "bot",
            content: "Re-salut ! 👋\n\nJe suis toujours là pour t'aider avec CoreMatch. Qu'est-ce qui t'intéresse aujourd'hui ?",
            timestamp: new Date(),
          },
        ]);
        setShowPulse(true);
        setTimeout(() => setShowPulse(false), 2500);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [hasInteracted, messages.length, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Convert UI -> API
  function toApiMessages(list: UiMessage[]): ApiMessage[] {
    return list.map((m) => ({
      role: m.type === "user" ? "user" : "assistant",
      content: m.content,
    }));
  }

  async function sendMessage() {
    if (!currentMessage.trim()) return;

    setHasInteracted(true);
    setShowPulse(false);

    const userMsg: UiMessage = {
      id: Date.now().toString(),
      type: "user",
      content: currentMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setCurrentMessage("");
    setIsTyping(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: null,
          deviceId,         // 👈 identifiant anonyme
          conversationId,   // 👈 conversation existante si connue
          messages: [
            ...toApiMessages(messages),
            { role: "user", content: userMsg.content } as ApiMessage,
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Erreur API");
      }

      const data = (await res.json()) as { reply?: string; conversationId?: string };
      const content =
        data?.reply?.trim() ||
        "Désolé, je n’ai pas pu répondre maintenant. Réessaie dans un instant 🙏";

      // Sauvegarde conversationId si renvoyé pour la 1ère fois
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
        try {
          localStorage.setItem(CONV_KEY, data.conversationId);
        } catch {}
      }

      const aiMsg: UiMessage = {
        id: (Date.now() + 1).toString(),
        type: "bot",
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      console.error("Chat error:", e);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          type: "bot",
          content:
            "Oups, une erreur est survenue côté assistant. Vérifie la clé OPENAI côté serveur ou réessaie.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };


  return (
    <>
      {/* Bouton flottant */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <div className="relative">
            <div className={`absolute inset-0 ${showPulse ? "animate-ping" : ""}`}>
              <div className="w-16 h-16 bg-gradient-to-r from-cyan-400/30 to-purple-500/30 rounded-full" />
            </div>
            <button
              onClick={() => setIsOpen(true)}
              className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-full p-4 shadow-2xl hover:shadow-purple-500/25 transition-all duration-500 group hover:scale-110"
              aria-label="Ouvrir le chat"
            >
              <MessageCircle className="h-6 w-6" />
              {messages.length > 0 && !hasInteracted && (
                <div className="absolute -top-3 -right-3 bg-gradient-to-r from-orange-400 to-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center animate-bounce font-bold shadow-lg">
                  <Sparkles className="h-3 w-3" />
                </div>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Fenêtre du chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[650px] z-50 flex flex-col overflow-hidden">
          <div className="bg-gray-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 flex flex-col h-full">
            {/* Header */}
            <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-5 rounded-t-3xl">
              {/* Animation d'attention au premier chargement */}
              {!hasInteracted && messages.length <= 1 && (
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 to-purple-500/20 rounded-t-3xl animate-pulse"></div>
              )}
              
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="bg-white/20 p-2 rounded-xl mr-3 border border-white/20">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg">CoreMatch IA</h3>
                    <div className="flex items-center text-white/90 text-sm">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                      <Sparkles className="h-3 w-3 mr-1" />
                      <span>{isTyping ? "En train d'écrire..." : "Assistant en ligne"}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-white/20 p-2 rounded-xl transition-all duration-300 hover:rotate-90"
                  aria-label="Fermer le chat"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 bg-gradient-to-b from-gray-900/50 to-gray-900/80 custom-scrollbar">
              <div className="space-y-4">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.type === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`flex items-start gap-3 max-w-[85%] ${m.type === "user" ? "flex-row-reverse" : ""}`}>
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          m.type === "user"
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                            : "bg-gradient-to-r from-purple-500 to-pink-500"
                        }`}
                      >
                        {m.type === "user" ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-white" />}
                      </div>
                      <div
                        className={`relative p-4 rounded-2xl text-sm ${
                          m.type === "user"
                            ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white"
                            : "bg-white/10 border border-white/20 text-white"
                        }`}
                      >
                        <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                        <div className={`text-xs mt-2 opacity-70 ${m.type === "user" ? "text-cyan-100" : "text-gray-300"}`}>
                          {m.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-white" />
                      </div>
                      <div className="bg-white/10 border border-white/20 p-4 rounded-2xl">
                        <div className="flex gap-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick suggestions */}
              {messages.length <= 1 && !isTyping && (
                <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-white/70 text-xs mb-3 flex items-center">
                    <Star className="h-3 w-3 mr-1 text-yellow-400" />
                    Essayez ces fonctionnalités
                  </p>
                  <div className="space-y-2">
                    {[
                      { text: "🎯 Améliorer une offre d'emploi", action: "Je veux améliorer une offre d'emploi" },
                      { text: "📄 Scorer un CV", action: "Je veux scorer un CV de développeur" },
                      { text: "📊 Automatiser des factures", action: "Comment automatiser l'extraction de factures ?" },
                      { text: "💰 Voir les tarifs", action: "Quels sont vos tarifs ?" }
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentMessage(item.action);
                          setTimeout(() => sendMessage(), 100);
                        }}
                        className="w-full text-left text-xs bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-white/20 text-white px-3 py-2 rounded-xl hover:from-indigo-500/30 hover:to-purple-500/30 transition-all duration-200 hover:scale-105"
                      >
                        {item.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-gray-900/80 border-t border-white/10 rounded-b-3xl">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Posez vos questions sur CoreMatch…"
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/50 focus:outline-none"
                  disabled={isTyping}
                />
                <button
                  onClick={sendMessage}
                  disabled={!currentMessage.trim() || isTyping}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-2xl disabled:opacity-50"
                  aria-label="Envoyer"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <div className="flex items-center justify-between mt-3 text-xs text-white/40">
                <div className="flex items-center">
                  <Rocket className="h-3 w-3 mr-1" />
                  <span>Propulsé par CoreMatch (OpenAI)</span>
                </div>
                {/* Bouton debug pour réinitialiser l'auto-ouverture */}
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('cm_has_visited');
                      setMessages([]);
                      setHasInteracted(false);
                      setHasAutoOpened(false);
                      setIsOpen(false);
                    }
                  }}
                  className="text-xs opacity-30 hover:opacity-100 transition-opacity"
                  title="Réinitialiser l'auto-ouverture"
                >
                  🔄
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, rgba(139,92,246,.6), rgba(219,39,119,.6));
          border-radius: 10px;
        }
      `}</style>
    </>
  );
}
