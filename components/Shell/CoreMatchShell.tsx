"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './Sidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import CommandBar from '../Layout/CommandBar';
import AgentDrawer from '../Layout/AgentDrawer';
import { Sparkles, Menu, X } from 'lucide-react';

// Inner component that uses the sidebar context
function ShellContent({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const { isCollapsed, isMobileOpen, openMobile, closeMobile } = useSidebar();

  return (
    <div className="flex h-screen w-full overflow-hidden font-sans bg-[#020617]">

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE SIDEBAR OVERLAY (Fixed, slides from left)
          ═══════════════════════════════════════════════════════════════════ */}

      {/* Backdrop */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Slide-over Sidebar */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-[#020617] border-r border-white/5 z-50 md:hidden"
          >
            {/* Close Button */}
            <button
              onClick={closeMobile}
              className="absolute top-5 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white z-10"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>

            {/* Glow effect */}
            <div
              className="absolute -top-20 -left-20 w-64 h-64 bg-[#00B4D8]/10 blur-[100px] rounded-full pointer-events-none"
              aria-hidden="true"
            />

            {/* Sidebar content - always expanded on mobile */}
            <Sidebar forceExpanded />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP SIDEBAR (Flex child with animated width)
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.aside
        initial={false}
        animate={{ width: isCollapsed ? 80 : 256 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="hidden md:flex flex-col flex-shrink-0 h-full border-r border-white/5 bg-[#020617]/50 relative overflow-hidden"
      >
        {/* Subtle top-left glow */}
        <div
          className="absolute -top-20 -left-20 w-64 h-64 bg-[#00B4D8]/8 blur-[100px] rounded-full pointer-events-none"
          aria-hidden="true"
        />
        <Sidebar />
      </motion.aside>

      {/* ═══════════════════════════════════════════════════════════════════
          MAIN CONTENT AREA (Flex child that fills remaining space)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">

        {/* Subtle background gradient for depth */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#00B4D8]/5 to-transparent pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* ═══════════════════════════════════════════════════════════════
            MOBILE TOP BAR (visible only on mobile)
            ═══════════════════════════════════════════════════════════════ */}
        <header className="md:hidden flex-shrink-0 h-16 flex items-center justify-between px-4 border-b border-white/5 bg-[#0F172A]/80 backdrop-blur-xl z-30 relative">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-[#00B4D8] to-[#2979FF] rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-sm">C</span>
            </div>
            <span className="font-bold text-white text-base">CoreMatch</span>
          </div>

          {/* Hamburger Button */}
          <button
            onClick={openMobile}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-300"
            aria-label="Ouvrir le menu"
          >
            <Menu size={24} />
          </button>
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            DESKTOP TOP BAR (CommandBar)
            ═══════════════════════════════════════════════════════════════ */}
        <header className="hidden md:block flex-shrink-0 z-20 relative">
          <CommandBar onOpenCmd={() => console.log('Cmd+K')} />
        </header>

        {/* ═══════════════════════════════════════════════════════════════
            SCROLLABLE CONTENT ZONE
            ═══════════════════════════════════════════════════════════════ */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth relative z-10 min-w-0">
          {/* Responsive padding: p-4 mobile, p-6 desktop */}
          <div className="p-4 md:p-6 min-w-0">
            <div className="w-full max-w-7xl mx-auto pb-24 md:pb-20 min-w-0">
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
}

// Main shell component wrapped with provider
const CoreMatchShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <ShellContent>{children}</ShellContent>
    </SidebarProvider>
  );
};

export default CoreMatchShell;
