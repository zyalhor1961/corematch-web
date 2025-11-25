"use client";

import React, { useState } from 'react';
import Sidebar from './Sidebar';
import CommandBar from '../Layout/CommandBar';
import AgentDrawer from '../Layout/AgentDrawer';
import { Sparkles, Menu, X } from 'lucide-react';

const CoreMatchShell = ({ children }: { children: React.ReactNode }) => {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden font-sans bg-[#020617]">

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE TOP BAR (visible only on mobile)
          ═══════════════════════════════════════════════════════════════════ */}
      <header className="md:hidden flex-shrink-0 h-16 flex items-center justify-between px-4 border-b border-white/5 bg-[#0F172A]/80 backdrop-blur-xl z-30">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-[#00B4D8] to-[#2979FF] rounded-lg flex items-center justify-center">
            <span className="font-bold text-white text-sm">C</span>
          </div>
          <span className="font-bold text-white text-base">CoreMatch</span>
        </div>

        {/* Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-300"
          aria-label="Ouvrir le menu"
        >
          <Menu size={24} />
        </button>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE SIDEBAR OVERLAY (Slide-over)
          ═══════════════════════════════════════════════════════════════════ */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-over Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#020617] border-r border-white/5 z-50 md:hidden transform transition-transform duration-300 ease-out ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          aria-label="Fermer le menu"
        >
          <X size={20} />
        </button>

        {/* Glow effect */}
        <div
          className="absolute -top-20 -left-20 w-64 h-64 bg-[#00B4D8]/10 blur-[100px] rounded-full pointer-events-none"
          aria-hidden="true"
        />

        <Sidebar onClose={() => setMobileMenuOpen(false)} />
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP SIDEBAR (hidden on mobile)
          ═══════════════════════════════════════════════════════════════════ */}
      <aside className="hidden md:block w-64 flex-shrink-0 h-full border-r border-white/5 bg-[#020617]/50 relative overflow-hidden">
        {/* Subtle top-left glow */}
        <div
          className="absolute -top-20 -left-20 w-64 h-64 bg-[#00B4D8]/8 blur-[100px] rounded-full pointer-events-none"
          aria-hidden="true"
        />
        <Sidebar />
      </aside>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">

        {/* Subtle background gradient for depth */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#00B4D8]/5 to-transparent pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Top Bar - Desktop Only (CommandBar) */}
        <header className="hidden md:block flex-shrink-0 z-20 relative">
          <CommandBar onOpenCmd={() => console.log('Cmd+K')} />
        </header>

        {/* SCROLLABLE CONTENT ZONE */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative z-10">
          {/* Responsive padding: p-4 mobile, p-6 desktop */}
          <div className="p-4 md:p-6">
            <div className="w-full max-w-7xl mx-auto pb-24 md:pb-20">
              {children}
            </div>
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          AI DRAWER (Overlay)
          ═══════════════════════════════════════════════════════════════════ */}
      <AgentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      {/* Floating Action Button - AI Assistant */}
      <button
        onClick={() => setDrawerOpen(!isDrawerOpen)}
        className="fixed bottom-6 right-4 md:right-6 h-12 w-12 bg-[#00B4D8] rounded-full shadow-[0_0_20px_rgba(0,180,216,0.4)] hover:shadow-[0_0_30px_rgba(0,180,216,0.6)] hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center text-[#020617]"
        aria-label="Ouvrir l'assistant IA"
      >
        <Sparkles size={20} />
      </button>
    </div>
  );
};

export default CoreMatchShell;
