'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Menu, X, ChevronDown } from 'lucide-react';

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              CoreMatch
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <div className="relative group">
              <button className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-200">
                Solutions
                <ChevronDown className="ml-1 h-4 w-4" />
              </button>
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-2">
                  <Link
                    href="/products/cv-screening"
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-gray-900">CV Screening</div>
                    <div className="text-gray-500 text-xs">Analyse automatique de CV</div>
                  </Link>
                  <Link
                    href="/products/deb-assistant"
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-gray-900">DEB Assistant</div>
                    <div className="text-gray-500 text-xs">Traitement factures intracommunautaires</div>
                  </Link>
                </div>
              </div>
            </div>

            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">
              Tarifs
            </Link>

            <Link href="#" className="text-gray-600 hover:text-gray-900 transition-colors duration-200">
              Support
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900 hover:bg-gray-50">
                Se connecter
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-gray-900 text-white hover:bg-gray-800">
                Essai gratuit
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-gray-600 hover:text-gray-900 transition-colors duration-200"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="space-y-2">
              <Link
                href="/products/cv-screening"
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                CV Screening
              </Link>
              <Link
                href="/products/deb-assistant"
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                DEB Assistant
              </Link>
              <Link
                href="/pricing"
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Tarifs
              </Link>
              <Link
                href="/login"
                className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                className="block px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                Essai gratuit
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}