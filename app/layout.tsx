import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./components/ThemeProvider";
import { ErrorBoundary } from "./components/error-boundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CoreMatch - Automatisation Intelligente",
  description: "Optimisez vos processus de recrutement et de gestion documentaire avec l'IA",
  keywords: "recrutement, CV screening, DEB, automatisation, IA, intelligence artificielle",
  authors: [{ name: "CoreMatch" }],
  openGraph: {
    title: "CoreMatch - Automatisation Intelligente",
    description: "Optimisez vos processus de recrutement et de gestion documentaire avec l'IA",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen w-screen overflow-hidden bg-[#020617] text-slate-200`}
      >
        {/* Background Gradient Layer - Subtle depth without blocking content */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          aria-hidden="true"
        >
          {/* Primary gradient - top glow */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#00B4D8]/5 via-transparent to-transparent" />
          {/* Secondary gradient - bottom fade */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#020617] via-transparent to-transparent opacity-50" />
        </div>

        {/* Main Application Layer */}
        <ThemeProvider>
          <ErrorBoundary>
            <div className="relative z-10 h-screen w-screen flex overflow-hidden">
              {children}
            </div>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
