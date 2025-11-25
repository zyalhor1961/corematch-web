"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import CommandBar from '../Layout/CommandBar';
import AgentDrawer from '../Layout/AgentDrawer';
import { Sparkles } from 'lucide-react';

const CoreMatchShell = ({ children }: { children: React.ReactNode }) => {
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (
    // MAIN CONTAINER: Full viewport, flex row, no scroll on body
    <div className="flex h-screen w-full overflow-hidden font-sans bg-[#020617]">

      {/* LEFT: Fixed Sidebar - Stays in place */}
      <aside className="w-64 flex-shrink-0 h-full border-r border-white/5 bg-[#020617]/50 relative overflow-hidden">
        {/* Subtle top-left glow */}
        <div
          className="absolute -top-20 -left-20 w-64 h-64 bg-[#00B4D8]/8 blur-[100px] rounded-full pointer-events-none"
          aria-hidden="true"
        />
        <Sidebar />
      </aside>

      {/* RIGHT: Main Content Area (Flex Column) */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">

        {/* Subtle background gradient for depth */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#00B4D8]/5 to-transparent pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Top Bar (Fixed at top of content area) */}
        <header className="flex-shrink-0 z-20 relative">
          <CommandBar onOpenCmd={() => console.log('Cmd+K')} />
        </header>

        {/* SCROLLABLE CONTENT ZONE */}
        {/* This div takes all remaining height and scrolls internally */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative z-10">
          <div className="p-6">
            <div className="max-w-7xl mx-auto pb-20">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* AI DRAWER (Overlay) */}
      <AgentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Floating Action Button - AI Assistant */}
      <button
        onClick={() => setDrawerOpen(!isDrawerOpen)}
        className="fixed bottom-6 right-6 h-12 w-12 bg-[#00B4D8] rounded-full shadow-[0_0_20px_rgba(0,180,216,0.4)] hover:shadow-[0_0_30px_rgba(0,180,216,0.6)] hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center text-[#020617]"
        aria-label="Ouvrir l'assistant IA"
      >
        <Sparkles size={20} />
      </button>
    </div>
  );
};

export default CoreMatchShell;
