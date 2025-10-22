'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { useTheme } from '@/app/components/ThemeProvider';
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  Settings,
  Plus,
  Trash2,
  Check,
  Loader2
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AnalysisCriteria {
  id: string;
  name: string;
  description: string;
  weight: number; // 1-5 importance
}

interface AnalysisChatbotProps {
  projectId: string;
  candidateId?: string;
  defaultCriteria?: AnalysisCriteria[];
}

const DEFAULT_CRITERIA: AnalysisCriteria[] = [
  {
    id: 'experience',
    name: 'Expérience professionnelle',
    description: 'Années d\'expérience et pertinence par rapport au poste',
    weight: 5
  },
  {
    id: 'skills',
    name: 'Compétences techniques',
    description: 'Maîtrise des technologies et outils requis',
    weight: 5
  },
  {
    id: 'education',
    name: 'Formation',
    description: 'Diplômes et formations pertinentes',
    weight: 3
  },
  {
    id: 'languages',
    name: 'Langues',
    description: 'Maîtrise des langues requises',
    weight: 2
  },
  {
    id: 'soft_skills',
    name: 'Soft skills',
    description: 'Leadership, communication, travail en équipe',
    weight: 3
  }
];

export default function AnalysisChatbot({
  projectId,
  candidateId,
  defaultCriteria
}: AnalysisChatbotProps) {
  const { isDarkMode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis votre assistant d\'analyse CV. Je peux vous aider à personnaliser les critères d\'évaluation et analyser les candidats selon vos besoins spécifiques. Comment puis-je vous aider ?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [criteria, setCriteria] = useState<AnalysisCriteria[]>(
    defaultCriteria || DEFAULT_CRITERIA
  );
  const [newCriterion, setNewCriterion] = useState({
    name: '',
    description: '',
    weight: 3
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/cv/analysis-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          candidateId,
          message: inputValue,
          criteria,
          conversationHistory: messages
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la communication avec l\'assistant');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Désolé, une erreur s\'est produite. Veuillez réessayer.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCriterion = () => {
    if (!newCriterion.name.trim()) return;

    const criterion: AnalysisCriteria = {
      id: Date.now().toString(),
      ...newCriterion
    };

    setCriteria(prev => [...prev, criterion]);
    setNewCriterion({ name: '', description: '', weight: 3 });
  };

  const handleRemoveCriterion = (id: string) => {
    setCriteria(prev => prev.filter(c => c.id !== id));
  };

  const handleSaveCriteria = async () => {
    try {
      const response = await fetch(`/api/cv/projects/${projectId}/criteria`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ criteria })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la sauvegarde');
      }

      setShowSettings(false);

      // Add confirmation message
      const confirmMessage: Message = {
        role: 'assistant',
        content: `✅ Critères d'analyse mis à jour ! ${criteria.length} critères configurés. Les prochaines analyses utiliseront ces nouveaux critères.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, confirmMessage]);
    } catch (error) {
      console.error('Save criteria error:', error);
      alert('Erreur lors de la sauvegarde des critères');
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          isDarkMode
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-blue-500 hover:bg-blue-600'
        }`}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 w-96 h-[600px] rounded-lg shadow-2xl flex flex-col overflow-hidden ${
        isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
      }`}
    >
      {/* Header */}
      <div className={`p-4 flex items-center justify-between border-b ${
        isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-blue-50'
      }`}>
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Assistant Analyse CV
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {criteria.length} critères actifs
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <Settings className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className={`p-2 rounded-lg ${
              isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
            }`}
          >
            <X className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`p-4 border-b overflow-y-auto max-h-80 ${
          isDarkMode ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-gray-50'
        }`}>
          <h4 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Critères d'analyse
          </h4>

          {/* Existing Criteria */}
          <div className="space-y-2 mb-4">
            {criteria.map(criterion => (
              <div
                key={criterion.id}
                className={`p-3 rounded-lg flex items-start justify-between ${
                  isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h5 className={`font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {criterion.name}
                    </h5>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      criterion.weight >= 4
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : criterion.weight >= 3
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      Priorité {criterion.weight}/5
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {criterion.description}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveCriterion(criterion.id)}
                  className="ml-2 p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Add New Criterion */}
          <div className={`p-3 rounded-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h5 className={`font-medium text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Ajouter un critère
            </h5>
            <input
              type="text"
              placeholder="Nom du critère"
              value={newCriterion.name}
              onChange={e => setNewCriterion(prev => ({ ...prev, name: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${
                isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-gray-50 text-gray-900 border-gray-200'
              } border`}
            />
            <textarea
              placeholder="Description"
              value={newCriterion.description}
              onChange={e => setNewCriterion(prev => ({ ...prev, description: e.target.value }))}
              className={`w-full px-3 py-2 rounded-lg text-sm mb-2 ${
                isDarkMode
                  ? 'bg-gray-700 text-white border-gray-600'
                  : 'bg-gray-50 text-gray-900 border-gray-200'
              } border`}
              rows={2}
            />
            <div className="flex items-center justify-between">
              <select
                value={newCriterion.weight}
                onChange={e => setNewCriterion(prev => ({ ...prev, weight: parseInt(e.target.value) }))}
                className={`px-3 py-2 rounded-lg text-sm ${
                  isDarkMode
                    ? 'bg-gray-700 text-white border-gray-600'
                    : 'bg-gray-50 text-gray-900 border-gray-200'
                } border`}
              >
                <option value={1}>Priorité 1 (Faible)</option>
                <option value={2}>Priorité 2</option>
                <option value={3}>Priorité 3 (Moyenne)</option>
                <option value={4}>Priorité 4</option>
                <option value={5}>Priorité 5 (Critique)</option>
              </select>
              <button
                onClick={handleAddCriterion}
                className="ml-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm flex items-center"
              >
                <Plus className="w-4 h-4 mr-1" />
                Ajouter
              </button>
            </div>
          </div>

          <Button
            onClick={handleSaveCriteria}
            className="w-full mt-3 bg-green-500 hover:bg-green-600"
          >
            <Check className="w-4 h-4 mr-2" />
            Sauvegarder les critères
          </Button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-2 ${
              message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-blue-500'
                  : isDarkMode
                  ? 'bg-gray-700'
                  : 'bg-gray-200'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
              )}
            </div>
            <div
              className={`flex-1 px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : isDarkMode
                  ? 'bg-gray-700 text-gray-100'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className={`text-xs mt-1 ${
                message.role === 'user' ? 'text-blue-100' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                {message.timestamp.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start space-x-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <Bot className={`w-5 h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`} />
            </div>
            <div className={`px-4 py-2 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
            placeholder="Posez une question sur l'analyse..."
            disabled={isLoading}
            className={`flex-1 px-4 py-2 rounded-lg ${
              isDarkMode
                ? 'bg-gray-700 text-white border-gray-600'
                : 'bg-gray-50 text-gray-900 border-gray-200'
            } border focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white rounded-lg transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
