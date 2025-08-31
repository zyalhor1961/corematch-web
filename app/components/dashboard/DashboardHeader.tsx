"use client";
import React from 'react';
import { Bell, Search, Plus } from 'lucide-react';

export default function DashboardHeader() {
  return (
    <header className="sticky top-0 z-40 bg-white/5 backdrop-blur-xl border-b border-white/10">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-white/60 text-sm">Bienvenue dans votre espace CoreMatch</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            {/* Actions */}
            <button className="p-2 hover:bg-white/5 rounded-lg transition-colors relative">
              <Bell className="h-5 w-5 text-white/70" />
              <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></div>
            </button>

            <button className="flex items-center px-4 py-2 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-lg text-white font-medium hover:from-indigo-400 hover:to-cyan-400 transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle offre
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}