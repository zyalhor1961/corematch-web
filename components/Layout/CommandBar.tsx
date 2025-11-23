'use client';

import React from 'react';
import { Search, Bell, Activity, ChevronRight, Menu } from 'lucide-react';

interface CommandBarProps {
    onMenuClick: () => void;
}

const CommandBar = ({ onMenuClick }: CommandBarProps) => {
    return (
        <header className="h-16 fixed top-0 right-0 left-0 md:left-64 bg-transparent z-30 flex items-center justify-between px-4 md:px-6 pointer-events-none">
            {/* Left Section: Menu & Breadcrumbs */}
            <div className="flex items-center pointer-events-auto">
                {/* Mobile Menu Button */}
                <button
                    onClick={onMenuClick}
                    className="mr-4 p-2 text-slate-400 hover:text-white bg-navy-glass/40 backdrop-blur-md border border-white/10 rounded-lg md:hidden"
                >
                    <Menu className="w-5 h-5" />
                </button>

                {/* Breadcrumbs */}
                <div className="flex items-center text-sm text-slate-400">
                    <span className="hover:text-white cursor-pointer transition-colors hidden sm:inline">Accueil</span>
                    <ChevronRight className="w-4 h-4 mx-2 text-slate-600 hidden sm:inline" />
                    <span className="text-white font-medium">Tableau de bord</span>
                </div>
            </div>

            {/* Center: Command Search (Hidden on Mobile) */}
            <button className="hidden md:flex items-center w-96 px-4 py-2 bg-navy-glass/40 backdrop-blur-md border border-white/10 rounded-lg text-slate-400 hover:bg-navy-glass/60 hover:border-neon-teal/30 transition-all group pointer-events-auto">
                <Search className="w-4 h-4 mr-3 text-slate-500 group-hover:text-neon-teal transition-colors" />
                <span className="text-sm">Tapez une commande ou cherchez...</span>
                <kbd className="ml-auto text-xs font-mono bg-white/5 px-2 py-0.5 rounded text-slate-500 group-hover:text-white transition-colors">⌘K</kbd>
            </button>

            {/* Right Actions */}
            <div className="flex items-center space-x-4 pointer-events-auto">
                <div className="hidden md:flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                    Système Optimal
                </div>
                <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-neon-teal rounded-full shadow-[0_0_10px_rgba(0,180,216,0.5)]" />
                </button>
            </div>
        </header>
    );
};

export default CommandBar;
