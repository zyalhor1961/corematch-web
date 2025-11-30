'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Building2, User, Mail, Phone, Globe, Calendar, TrendingUp,
  Sparkles, MessageSquare, Edit2, Save, Trash2, Plus, Clock,
  Target, FileText, Handshake, Trophy, XCircle, ChevronRight,
  ExternalLink, DollarSign
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { type Lead } from './LeadCard';

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: 'note' | 'email' | 'call' | 'meeting' | 'status_change';
  content: string;
  created_by?: string;
  created_at: string;
}

interface LeadDrawerProps {
  lead: Lead | null;
  activities?: LeadActivity[];
  isOpen: boolean;
  onClose: () => void;
  onSave?: (lead: Partial<Lead>) => Promise<void>;
  onDelete?: (leadId: string) => Promise<void>;
  onAddActivity?: (leadId: string, activity: Omit<LeadActivity, 'id' | 'lead_id' | 'created_at'>) => Promise<void>;
  onStatusChange?: (leadId: string, newStatus: Lead['status']) => Promise<void>;
}

const statusConfig = {
  new: { label: 'Nouveau', icon: Sparkles, color: 'text-slate-400', bg: 'bg-slate-500/20' },
  qualified: { label: 'Qualifié', icon: Target, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  proposal: { label: 'Proposition', icon: FileText, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  negotiation: { label: 'Négociation', icon: Handshake, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  won: { label: 'Gagné', icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  lost: { label: 'Perdu', icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/20' },
};

const activityIcons = {
  note: MessageSquare,
  email: Mail,
  call: Phone,
  meeting: Calendar,
  status_change: TrendingUp,
};

export function LeadDrawer({
  lead,
  activities = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  onAddActivity,
  onStatusChange,
}: LeadDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedLead, setEditedLead] = useState<Partial<Lead>>({});
  const [newNote, setNewNote] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  useEffect(() => {
    if (lead) {
      setEditedLead(lead);
    }
  }, [lead]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!lead) return null;

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editedLead);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save lead:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || !confirm('Êtes-vous sûr de vouloir supprimer ce lead ?')) return;
    try {
      await onDelete(lead.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete lead:', error);
    }
  };

  const handleQuickStatusChange = async (newStatus: Lead['status']) => {
    if (!lead) return;

    // If we have onStatusChange, use it (preferred for optimistic updates)
    if (onStatusChange) {
      setIsChangingStatus(true);
      try {
        await onStatusChange(lead.id, newStatus);
        onClose();
      } catch (error) {
        console.error('Failed to change status:', error);
      } finally {
        setIsChangingStatus(false);
      }
    }
    // Fallback to onSave if available
    else if (onSave) {
      setIsChangingStatus(true);
      try {
        await onSave({ status: newStatus });
        onClose();
      } catch (error) {
        console.error('Failed to change status:', error);
      } finally {
        setIsChangingStatus(false);
      }
    }
  };

  const handleAddNote = async () => {
    if (!onAddActivity || !newNote.trim()) return;
    setIsAddingNote(true);
    try {
      await onAddActivity(lead.id, {
        activity_type: 'note',
        content: newNote,
      });
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    } finally {
      setIsAddingNote(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'EUR') => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const StatusIcon = statusConfig[lead.status].icon;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-xl bg-slate-900 border-l border-white/10 z-50 transition-transform duration-300",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 p-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {lead.logo_url ? (
                <img
                  src={lead.logo_url}
                  alt={lead.company_name}
                  className="w-10 h-10 rounded-xl object-cover bg-white/10"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                  <Building2 size={20} className="text-cyan-400" />
                </div>
              )}
              <div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedLead.company_name || ''}
                    onChange={(e) => setEditedLead({ ...editedLead, company_name: e.target.value })}
                    className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white font-medium"
                  />
                ) : (
                  <h2 className="text-lg font-semibold text-white">{lead.company_name}</h2>
                )}
                <div className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium mt-1",
                  statusConfig[lead.status].bg,
                  statusConfig[lead.status].color
                )}>
                  <StatusIcon size={12} />
                  {statusConfig[lead.status].label}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedLead(lead);
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500 text-white font-medium hover:bg-cyan-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    <Save size={14} />
                    {isSaving ? 'Enregistrement...' : 'Sauvegarder'}
                  </button>
                </>
              ) : (
                <>
                  {onSave && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100%-80px)] p-4 space-y-6">
          {/* Quick Actions Bar */}
          {!isEditing && lead.status !== 'won' && lead.status !== 'lost' && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Actions rapides</h3>
              <div className="flex flex-wrap gap-2">
                {/* Mark as Won */}
                <button
                  onClick={() => handleQuickStatusChange('won')}
                  disabled={isChangingStatus}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <Trophy size={14} />
                  Marquer Gagné
                </button>
                {/* Mark as Lost */}
                <button
                  onClick={() => {
                    if (confirm('Voulez-vous marquer ce lead comme perdu ?')) {
                      handleQuickStatusChange('lost');
                    }
                  }}
                  disabled={isChangingStatus}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  <XCircle size={14} />
                  Marquer Perdu
                </button>
                {/* Delete */}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    disabled={isChangingStatus}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Value & Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <DollarSign size={14} />
                Valeur potentielle
              </div>
              {isEditing ? (
                <input
                  type="number"
                  value={editedLead.potential_value || 0}
                  onChange={(e) => setEditedLead({ ...editedLead, potential_value: parseFloat(e.target.value) })}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white font-mono text-xl"
                />
              ) : (
                <p className="text-2xl font-bold text-white font-mono">
                  {formatCurrency(lead.potential_value, lead.currency)}
                </p>
              )}
            </div>
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                <TrendingUp size={14} />
                Probabilité
              </div>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={editedLead.probability || 0}
                    onChange={(e) => setEditedLead({ ...editedLead, probability: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-white font-mono w-12">{editedLead.probability}%</span>
                </div>
              ) : (
                <>
                  <p className={cn(
                    "text-2xl font-bold font-mono",
                    lead.probability <= 30 ? "text-rose-400" :
                    lead.probability <= 60 ? "text-amber-400" : "text-emerald-400"
                  )}>
                    {lead.probability}%
                  </p>
                  <div className="h-2 rounded-full bg-slate-800 mt-2 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        lead.probability <= 30 ? "bg-rose-500" :
                        lead.probability <= 60 ? "bg-amber-500" : "bg-emerald-500"
                      )}
                      style={{ width: `${lead.probability}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Status Change (only in edit mode) */}
          {isEditing && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-slate-400 text-sm mb-3">Changer le statut</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statusConfig).map(([status, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={status}
                      onClick={() => setEditedLead({ ...editedLead, status: status as Lead['status'] })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all",
                        editedLead.status === status
                          ? `${config.bg} ${config.color} ring-1 ring-current`
                          : "bg-white/5 text-slate-400 hover:bg-white/10"
                      )}
                    >
                      <Icon size={14} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <User size={14} />
              Contact
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <User size={16} className="text-slate-500" />
                {isEditing ? (
                  <input
                    type="text"
                    value={editedLead.contact_name || ''}
                    onChange={(e) => setEditedLead({ ...editedLead, contact_name: e.target.value })}
                    placeholder="Nom du contact"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                ) : (
                  <span className="text-white">{lead.contact_name || '-'}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Mail size={16} className="text-slate-500" />
                {isEditing ? (
                  <input
                    type="email"
                    value={editedLead.contact_email || ''}
                    onChange={(e) => setEditedLead({ ...editedLead, contact_email: e.target.value })}
                    placeholder="Email"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                ) : lead.contact_email ? (
                  <a href={`mailto:${lead.contact_email}`} className="text-cyan-400 hover:underline">
                    {lead.contact_email}
                  </a>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Phone size={16} className="text-slate-500" />
                {isEditing ? (
                  <input
                    type="tel"
                    value={editedLead.contact_phone || ''}
                    onChange={(e) => setEditedLead({ ...editedLead, contact_phone: e.target.value })}
                    placeholder="Téléphone"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                ) : lead.contact_phone ? (
                  <a href={`tel:${lead.contact_phone}`} className="text-cyan-400 hover:underline">
                    {lead.contact_phone}
                  </a>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-slate-500" />
                {isEditing ? (
                  <input
                    type="url"
                    value={editedLead.website || ''}
                    onChange={(e) => setEditedLead({ ...editedLead, website: e.target.value })}
                    placeholder="Site web"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
                  />
                ) : lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:underline flex items-center gap-1"
                  >
                    {lead.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-slate-500">-</span>
                )}
              </div>
            </div>
          </div>

          {/* AI Insights */}
          {(lead.ai_summary || lead.ai_next_action) && (
            <div className="backdrop-blur-xl bg-purple-500/5 border border-purple-500/20 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                <Sparkles size={14} />
                Insights IA
              </h3>
              {lead.ai_summary && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Résumé</p>
                  <p className="text-sm text-slate-300">{lead.ai_summary}</p>
                </div>
              )}
              {lead.ai_next_action && (
                <div className="space-y-1">
                  <p className="text-xs text-slate-500">Prochaine action suggérée</p>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <ChevronRight size={14} className="text-cyan-400" />
                    <p className="text-sm text-cyan-300">{lead.ai_next_action}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add Note */}
          {onAddActivity && (
            <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Plus size={14} />
                Ajouter une note
              </h3>
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Écrivez une note..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm resize-none h-20 placeholder:text-slate-500"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim() || isAddingNote}
                className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <MessageSquare size={14} />
                {isAddingNote ? 'Ajout...' : 'Ajouter la note'}
              </button>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Clock size={14} />
              Historique
            </h3>
            <div className="space-y-3">
              {activities.length > 0 ? (
                activities.map((activity) => {
                  const ActivityIcon = activityIcons[activity.activity_type];
                  return (
                    <div
                      key={activity.id}
                      className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-3 flex gap-3"
                    >
                      <div className="p-2 rounded-lg bg-white/10 h-fit">
                        <ActivityIcon size={14} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{activity.content}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {formatRelativeDate(activity.created_at)}
                          {activity.created_by && ` • ${activity.created_by}`}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 text-center">
                  <Clock size={24} className="text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Aucune activité enregistrée</p>
                </div>
              )}
            </div>
          </div>

          {/* Timestamps */}
          <div className="text-xs text-slate-500 space-y-1 pt-4 border-t border-white/10">
            <p>Créé le {formatDate(lead.created_at)}</p>
            <p>Dernière activité le {formatDate(lead.last_activity_at)}</p>
          </div>
        </div>
      </div>
    </>
  );
}

export default LeadDrawer;
