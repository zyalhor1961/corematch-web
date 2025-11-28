'use client';

import React, { useState } from 'react';
import { Users, UserPlus, Shield, Mail, MoreVertical, Trash2, Edit2, Crown, UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OrganizationMember {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'accountant' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  invited_at?: string;
  joined_at?: string;
  last_seen_at?: string;
}

interface UserManagementCardProps {
  members: OrganizationMember[];
  currentUserId: string;
  onInvite: () => void;
  onUpdateRole: (memberId: string, role: OrganizationMember['role']) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onResendInvite: (memberId: string) => Promise<void>;
  isLoading?: boolean;
}

const roleConfig = {
  owner: {
    label: 'Propriétaire',
    icon: Crown,
    color: 'text-amber-400',
    bg: 'bg-amber-500/20',
    description: 'Accès complet + gestion organisation',
  },
  admin: {
    label: 'Administrateur',
    icon: Shield,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/20',
    description: 'Accès complet aux données',
  },
  accountant: {
    label: 'Comptable',
    icon: UserCog,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/20',
    description: 'Accès comptabilité uniquement',
  },
  viewer: {
    label: 'Lecteur',
    icon: Users,
    color: 'text-slate-400',
    bg: 'bg-slate-500/20',
    description: 'Lecture seule',
  },
};

export function UserManagementCard({
  members,
  currentUserId,
  onInvite,
  onUpdateRole,
  onRemove,
  onResendInvite,
  isLoading,
}: UserManagementCardProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  const handleRoleChange = async (memberId: string, newRole: OrganizationMember['role']) => {
    setUpdatingMember(memberId);
    try {
      await onUpdateRole(memberId, newRole);
    } finally {
      setUpdatingMember(null);
      setActiveMenu(null);
    }
  };

  const handleRemove = async (memberId: string) => {
    setUpdatingMember(memberId);
    try {
      await onRemove(memberId);
    } finally {
      setUpdatingMember(null);
      setActiveMenu(null);
    }
  };

  if (isLoading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingInvites = members.filter(m => m.status === 'invited');

  return (
    <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/20">
            <Users size={20} className="text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Équipe</h3>
            <p className="text-sm text-slate-400">
              {activeMembers.length} membre{activeMembers.length > 1 ? 's' : ''} actif{activeMembers.length > 1 ? 's' : ''}
              {pendingInvites.length > 0 && ` • ${pendingInvites.length} invitation${pendingInvites.length > 1 ? 's' : ''} en attente`}
            </p>
          </div>
        </div>

        <button
          onClick={onInvite}
          className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all flex items-center gap-2"
        >
          <UserPlus size={16} />
          Inviter
        </button>
      </div>

      {/* Members List */}
      <div className="divide-y divide-white/5">
        {members.map(member => {
          const role = roleConfig[member.role];
          const RoleIcon = role.icon;
          const isCurrentUser = member.user_id === currentUserId;
          const isUpdating = updatingMember === member.id;

          return (
            <div
              key={member.id}
              className={cn(
                "p-4 flex items-center gap-4 transition-colors",
                isUpdating && "opacity-50"
              )}
            >
              {/* Avatar */}
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 flex items-center justify-center overflow-hidden">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.full_name || member.email} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-slate-300">
                      {getInitials(member.full_name, member.email)}
                    </span>
                  )}
                </div>
                {member.status === 'invited' && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 border-2 border-slate-900 flex items-center justify-center">
                    <Mail size={8} className="text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">
                    {member.full_name || member.email}
                  </span>
                  {isCurrentUser && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[10px] text-slate-300">
                      Vous
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {member.full_name && (
                    <span className="text-sm text-slate-500 truncate">{member.email}</span>
                  )}
                  {member.status === 'invited' && member.invited_at && (
                    <span className="text-xs text-amber-400">
                      Invité le {formatDate(member.invited_at)}
                    </span>
                  )}
                </div>
              </div>

              {/* Role Badge */}
              <div className={cn("px-2.5 py-1 rounded-lg flex items-center gap-1.5", role.bg)}>
                <RoleIcon size={14} className={role.color} />
                <span className={cn("text-sm font-medium", role.color)}>{role.label}</span>
              </div>

              {/* Actions Menu */}
              {!isCurrentUser && member.role !== 'owner' && (
                <div className="relative">
                  <button
                    onClick={() => setActiveMenu(activeMenu === member.id ? null : member.id)}
                    className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeMenu === member.id && (
                    <>
                      {/* Backdrop */}
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActiveMenu(null)}
                      />

                      {/* Menu */}
                      <div className="absolute right-0 top-full mt-1 w-56 py-2 backdrop-blur-xl bg-slate-800/95 border border-white/10 rounded-xl shadow-xl z-20">
                        {/* Role Options */}
                        <div className="px-3 py-1.5 text-xs text-slate-500 font-medium">
                          Changer le rôle
                        </div>
                        {(['admin', 'accountant', 'viewer'] as const).map(roleKey => {
                          const r = roleConfig[roleKey];
                          const Icon = r.icon;
                          return (
                            <button
                              key={roleKey}
                              onClick={() => handleRoleChange(member.id, roleKey)}
                              className={cn(
                                "w-full px-3 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors",
                                member.role === roleKey && "bg-white/5"
                              )}
                            >
                              <Icon size={14} className={r.color} />
                              <div className="text-left">
                                <span className="text-sm text-white block">{r.label}</span>
                                <span className="text-xs text-slate-500">{r.description}</span>
                              </div>
                            </button>
                          );
                        })}

                        <div className="my-2 border-t border-white/10" />

                        {/* Resend Invite */}
                        {member.status === 'invited' && (
                          <button
                            onClick={() => {
                              onResendInvite(member.id);
                              setActiveMenu(null);
                            }}
                            className="w-full px-3 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors"
                          >
                            <Mail size={14} className="text-slate-400" />
                            <span className="text-sm text-white">Renvoyer l'invitation</span>
                          </button>
                        )}

                        {/* Remove */}
                        <button
                          onClick={() => handleRemove(member.id)}
                          className="w-full px-3 py-2 flex items-center gap-3 hover:bg-rose-500/10 transition-colors text-rose-400"
                        >
                          <Trash2 size={14} />
                          <span className="text-sm">
                            {member.status === 'invited' ? "Annuler l'invitation" : 'Retirer de l\'équipe'}
                          </span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {members.length === 0 && (
        <div className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-slate-500" />
          </div>
          <p className="text-slate-400">Aucun membre dans l'équipe</p>
          <button
            onClick={onInvite}
            className="mt-4 text-cyan-400 hover:text-cyan-300 text-sm font-medium"
          >
            Inviter le premier membre
          </button>
        </div>
      )}
    </div>
  );
}

export default UserManagementCard;
