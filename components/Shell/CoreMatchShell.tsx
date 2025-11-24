"use client";

import React, { useState, ReactNode } from 'react';
import Sidebar from './Sidebar';
import CommandBar from '../Layout/CommandBar';
import AgentDrawer from '../Layout/AgentDrawer';
import { Sparkles } from 'lucide-react';

interface CoreMatchShellProps {
    children: ReactNode;
}

const CoreMatchShell = ({ children }: CoreMatchShellProps) => {
    const [isAgentOpen, setIsAgentOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="min-h-screen bg-deep-void font-sans text-slate-200 selection:bg-neon-teal/30">
            {/* Background Ambient Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-teal/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-agent-purple/5 rounded-full blur-[120px]" />
            </div>

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
            <CommandBar onMenuClick={() => setIsSidebarOpen(true)} />
            <AgentDrawer isOpen={isAgentOpen} onClose={() => setIsAgentOpen(false)} />

            {/* Main Content Area */}
            <main className="pl-0 md:pl-64 pt-16 min-h-screen relative z-10 transition-all duration-300">
                <div className="p-4 md:p-8 h-[calc(100vh-4rem)]">
                    {children}
                </div>
            </main>

            {/* Floating Action Button (FAB) for Agent */}
            <button
                onClick={() => setIsAgentOpen(true)}
                className="fixed bottom-8 right-8 z-50 p-4 bg-gradient-to-r from-neon-teal to-agent-purple text-white rounded-full shadow-[0_0_20px_rgba(0,180,216,0.4)] hover:shadow-[0_0_30px_rgba(0,180,216,0.6)] hover:scale-105 transition-all duration-300 group"
            >
                <Sparkles className="w-6 h-6 animate-pulse" />
                <span className="absolute right-full mr-4 top-1/2 -translate-y-1/2 bg-navy-glass/90 backdrop-blur px-3 py-1 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-white/10">
                    Ask DAF
                </span>
            </button>
        </div>
    );
};

export default CoreMatchShell;
