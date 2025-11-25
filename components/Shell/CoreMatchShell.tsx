"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import CommandBar from '../Layout/CommandBar';
import AgentDrawer from '../Layout/AgentDrawer';
import { Sparkles } from 'lucide-react';

const CoreMatchShell = ({ children }: { children: React.ReactNode }) => {
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  return (
    // MAIN CONTAINER: Flex row, full height, hidden overflow to prevent double scrollbars
    <div className="flex h-screen w-full overflow-hidden font-sans relative z-10">
      
      {/* LEFT: Fixed Sidebar */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>

      {/* RIGHT: Main Content Area (Flex Column) */}
      <div className="flex-1 flex flex-col min-w-0 h-full bg-transparent">
        
        {/* Top Bar (Fixed at top of content area) */}
        <div className="flex-shrink-0 z-20">
            <CommandBar onOpenCmd={() => console.log('Cmd+K')} />
        </div>

        {/* SCROLLABLE CONTENT ZONE */}
        {/* This div takes all remaining height and scrolls internally */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 scroll-smooth">
           <div className="max-w-7xl mx-auto pb-20">
              {children}
           </div>
        </main>
      </div>

      {/* AI DRAWER (Overlay) */}
      <AgentDrawer 
        isOpen={isDrawerOpen} 
        onClose={() => setDrawerOpen(false)} 
      />
      
      {/* Floating Action Button */}
      <button 
        onClick={() => setDrawerOpen(!isDrawerOpen)}
        className="fixed bottom-6 right-6 h-12 w-12 bg-[#00E5FF] rounded-full shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:scale-110 transition-transform z-50 flex items-center justify-center text-[#0B1120]"
      >
        <Sparkles size={20} />
      </button>
    </div>
  );
};

export default CoreMatchShell;
