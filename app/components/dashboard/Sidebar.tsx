"use client";
import React, { useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Home,
  Users,
  FileText,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const menuItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard', active: true },
  { icon: FileText, label: 'Offres d\'emploi', href: '/dashboard/jobs' },
  { icon: Users, label: 'Candidats', href: '/dashboard/candidates' },
  { icon: MessageSquare, label: 'Chat IA', href: '/dashboard/chat' },
  { icon: BarChart3, label: 'Analytics', href: '/dashboard/analytics' },
  { icon: Settings, label: 'Paramètres', href: '/dashboard/settings' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`fixed top-0 left-0 h-screen bg-white dark:bg-white/5 backdrop-blur-xl border-r border-gray-200 dark:border-white/10 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <div className="bg-gradient-to-br from-indigo-500 to-cyan-500 w-8 h-8 rounded-lg flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            {!collapsed && (
              <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white">CoreMatch</span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Menu */}
      <nav className="p-4">
        <ul className="space-y-2">
          {menuItems.map((item, index) => (
            <li key={index}>
              <Link
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg transition-colors ${
                  item.active
                    ? 'bg-gradient-to-r from-indigo-500/20 to-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30'
                    : 'text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {!collapsed && (
                  <span className="ml-3 font-medium">{item.label}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="absolute bottom-4 left-4 right-4">
        <div className={`p-3 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 ${collapsed ? 'text-center' : ''}`}>
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-sm font-semibold text-white">
              SM
            </div>
            {!collapsed && (
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Sophie Martin</p>
                <p className="text-xs text-gray-600 dark:text-white/60">TechCorp</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button className="mt-3 w-full flex items-center justify-center px-3 py-2 text-sm text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg transition-colors">
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}