'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, Shield, UserCog, Users, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OrganizationMember } from './UserManagementCard';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: OrganizationMember['role']) => Promise<void>;
  existingEmails?: string[];
}

const roleOptions = [
  {
    value: 'admin' as const,
    label: 'Administrateur',
    icon: Shield,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    border: 'border-cyan-500/30',
    description: 'Accès complet aux données et paramètres',
  },
  {
    value: 'accountant' as const,
    label: 'Comptable',
    icon: UserCog,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    border: 'border-emerald-500/30',
    description: 'Accès aux factures, écritures et rapprochements',
  },
  {
    value: 'viewer' as const,
    label: 'Lecteur',
    icon: Users,
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    border: 'border-slate-500/30',
    description: 'Consultation uniquement, pas de modification',
  },
];

export function InviteUserModal({ isOpen, onClose, onInvite, existingEmails = [] }: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<OrganizationMember['role']>('accountant');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Reset form when modal closes
      setEmail('');
      setRole('accountant');
      setError(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email.trim()) {
      setError('Veuillez entrer une adresse email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Adresse email invalide');
      return;
    }

    if (existingEmails.includes(email.toLowerCase())) {
      setError('Cette adresse email est déjà membre de l\'équipe');
      return;
    }

    setIsSubmitting(true);
    try {
      await onInvite(email.toLowerCase(), role);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi de l\'invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg backdrop-blur-xl bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Neural accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Mail size={20} className="text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Inviter un membre</h2>
              <p className="text-sm text-slate-400">Envoyez une invitation par email</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Adresse email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="collaborateur@entreprise.fr"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/25 transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Rôle
            </label>
            <div className="space-y-2">
              {roleOptions.map((option) => {
                const Icon = option.icon;
                const isSelected = role === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setRole(option.value)}
                    className={cn(
                      "w-full p-4 rounded-xl border text-left transition-all",
                      isSelected
                        ? `${option.bg} ${option.border}`
                        : "bg-white/5 border-white/10 hover:bg-white/[0.07]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        isSelected ? option.bg : "bg-white/10"
                      )}>
                        <Icon size={16} className={isSelected ? option.color : "text-slate-400"} />
                      </div>
                      <div>
                        <div className={cn(
                          "font-medium",
                          isSelected ? "text-white" : "text-slate-300"
                        )}>
                          {option.label}
                        </div>
                        <div className="text-sm text-slate-500">
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !email.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} />
              {isSubmitting ? 'Envoi...' : 'Envoyer l\'invitation'}
            </button>
          </div>
        </form>

        {/* Footer Note */}
        <div className="px-6 pb-6">
          <p className="text-xs text-slate-500 text-center">
            Un email sera envoyé avec un lien d'invitation valable 7 jours.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default InviteUserModal;
