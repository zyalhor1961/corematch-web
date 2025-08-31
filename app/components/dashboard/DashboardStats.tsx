"use client";
import React from 'react';
import { Users, FileText, TrendingUp, Star, Upload, MessageSquare } from 'lucide-react';

const stats = [
  { icon: FileText, label: 'Offres actives', value: '8', change: '+2 ce mois', color: 'from-blue-500 to-cyan-500' },
  { icon: Users, label: 'Candidats', value: '127', change: '+15 cette semaine', color: 'from-green-500 to-emerald-500' },
  { icon: TrendingUp, label: 'Analyses IA', value: '89', change: '+12 aujourd\'hui', color: 'from-purple-500 to-violet-500' },
  { icon: Star, label: 'Score moyen', value: '78.5%', change: '+5.2% vs mois dernier', color: 'from-orange-500 to-red-500' },
];

const recentCandidates = [
  { name: 'Sophie Martin', role: 'Développeur Full-Stack', score: 92, status: 'new' },
  { name: 'Thomas Dubois', role: 'Data Scientist', score: 87, status: 'reviewed' },
  { name: 'Marie Leroy', role: 'UX Designer', score: 84, status: 'shortlisted' },
];

export default function DashboardStats() {
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-lg bg-gradient-to-r ${stat.color} bg-opacity-20`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-sm text-white/60">{stat.label}</p>
              </div>
            </div>
            <p className="text-sm text-green-400">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Candidates */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Candidats récents</h3>
          <div className="space-y-4">
            {recentCandidates.map((candidate, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/5">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-sm font-semibold">
                    {candidate.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="ml-3">
                    <p className="font-medium text-white">{candidate.name}</p>
                    <p className="text-sm text-white/60">{candidate.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-400 mr-1" />
                    <span className="text-sm font-medium text-white">{candidate.score}%</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    candidate.status === 'new' ? 'bg-blue-500/20 text-blue-300' :
                    candidate.status === 'reviewed' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-green-500/20 text-green-300'
                  }`}>
                    {candidate.status === 'new' ? 'Nouveau' : 
                     candidate.status === 'reviewed' ? 'Examiné' : 'Présélectionné'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white/5 backdrop-blur-xl rounded-xl p-6 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Actions rapides</h3>
          <div className="space-y-3">
            <button className="w-full p-4 bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 border border-cyan-500/30 rounded-lg text-left transition-all hover:from-indigo-500/30 hover:to-cyan-500/30">
              <div className="flex items-center">
                <Upload className="h-5 w-5 text-cyan-300 mr-3" />
                <div>
                  <p className="font-medium text-white">Importer des CV</p>
                  <p className="text-sm text-white/60">Analyse automatique par IA</p>
                </div>
              </div>
            </button>

            <button className="w-full p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-emerald-500/30 rounded-lg text-left transition-all hover:from-green-500/30 hover:to-emerald-500/30">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-emerald-300 mr-3" />
                <div>
                  <p className="font-medium text-white">Créer une offre</p>
                  <p className="text-sm text-white/60">Nouveau poste à pourvoir</p>
                </div>
              </div>
            </button>

            <button className="w-full p-4 bg-gradient-to-r from-purple-500/20 to-violet-500/20 border border-violet-500/30 rounded-lg text-left transition-all hover:from-purple-500/30 hover:to-violet-500/30">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 text-violet-300 mr-3" />
                <div>
                  <p className="font-medium text-white">Chat IA</p>
                  <p className="text-sm text-white/60">Assistant recrutement</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}