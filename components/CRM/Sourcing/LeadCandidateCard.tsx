'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Sparkles, Check, Loader2, Globe, Zap } from 'lucide-react';

export interface LeadCandidateProps {
  companyName: string;
  website: string;
  summary: string;
  matchScore: number; // 0 to 100
  location?: string;
  sector?: string;
  onEnrich: () => Promise<void>;
}

type ButtonState = 'idle' | 'loading' | 'success';

export function LeadCandidateCard({
  companyName,
  website,
  summary,
  matchScore,
  location,
  sector,
  onEnrich,
}: LeadCandidateProps) {
  const [buttonState, setButtonState] = useState<ButtonState>('idle');
  const [isHovered, setIsHovered] = useState(false);

  // Score color logic
  const getScoreStyle = () => {
    if (matchScore >= 80) {
      return {
        textColor: 'text-emerald-400',
        glowColor: 'bg-emerald-400',
        bgColor: 'bg-emerald-400/10',
        borderColor: 'border-emerald-400/20',
      };
    }
    if (matchScore >= 50) {
      return {
        textColor: 'text-amber-400',
        glowColor: 'bg-amber-400',
        bgColor: 'bg-amber-400/10',
        borderColor: 'border-amber-400/20',
      };
    }
    return {
      textColor: 'text-slate-400',
      glowColor: 'bg-slate-400',
      bgColor: 'bg-slate-400/10',
      borderColor: 'border-slate-400/20',
    };
  };

  const scoreStyle = getScoreStyle();

  const handleEnrich = async () => {
    if (buttonState !== 'idle') return;

    setButtonState('loading');
    try {
      await onEnrich();
      setButtonState('success');
    } catch {
      setButtonState('idle');
    }
  };

  // Extract domain from website for display
  const displayDomain = website
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="group relative"
    >
      {/* Glow effect layer */}
      <motion.div
        className="absolute -inset-px rounded-xl bg-gradient-to-r from-[#00B4D8]/0 via-[#00B4D8]/20 to-[#00B4D8]/0 opacity-0 blur-xl transition-opacity duration-500"
        animate={{ opacity: isHovered ? 0.6 : 0 }}
      />

      {/* Main card */}
      <motion.div
        animate={{
          scale: isHovered ? 1.02 : 1,
          borderColor: isHovered ? 'rgba(0, 180, 216, 0.3)' : 'rgba(255, 255, 255, 0.05)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className="relative flex items-center gap-4 rounded-xl border bg-[#0F172A]/40 p-4 backdrop-blur-md"
        style={{
          boxShadow: isHovered
            ? '0 0 30px rgba(0, 180, 216, 0.15), 0 4px 20px rgba(0, 0, 0, 0.3)'
            : '0 4px 20px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Left: Company Logo Placeholder */}
        <div className="relative flex-shrink-0">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#00B4D8]/20 to-[#7C3AED]/20 ring-1 ring-white/10">
            <Building2 className="h-7 w-7 text-white/60" />
          </div>
          {/* Live indicator dot */}
          <motion.div
            className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-emerald-400"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
          </motion.div>
        </div>

        {/* Middle: Company Info */}
        <div className="min-w-0 flex-1">
          {/* Company Name */}
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">
              {companyName}
            </h3>
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 text-slate-500 transition-colors hover:text-[#00B4D8]"
              onClick={(e) => e.stopPropagation()}
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Summary */}
          <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">
            {summary}
          </p>

          {/* Tags */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {location && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-400 ring-1 ring-white/10">
                <MapPin className="h-3 w-3" />
                {location}
              </span>
            )}
            {sector && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-xs text-[#A78BFA] ring-1 ring-[#7C3AED]/20">
                <Sparkles className="h-3 w-3" />
                {sector}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-xs text-slate-500 ring-1 ring-white/5">
              {displayDomain}
            </span>
          </div>
        </div>

        {/* Right: Match Score + Action Button */}
        <div className="flex flex-shrink-0 items-center gap-4">
          {/* Match Score */}
          <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${scoreStyle.bgColor} ${scoreStyle.borderColor}`}>
            {/* Glowing dot for high scores */}
            {matchScore >= 80 && (
              <motion.div
                className={`h-2 w-2 rounded-full ${scoreStyle.glowColor}`}
                animate={{
                  boxShadow: [
                    '0 0 4px rgba(52, 211, 153, 0.5)',
                    '0 0 12px rgba(52, 211, 153, 0.8)',
                    '0 0 4px rgba(52, 211, 153, 0.5)',
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            <span className={`text-lg font-bold tabular-nums ${scoreStyle.textColor}`}>
              {matchScore}%
            </span>
          </div>

          {/* Action Button */}
          <motion.button
            onClick={handleEnrich}
            disabled={buttonState !== 'idle'}
            whileHover={buttonState === 'idle' ? { scale: 1.05 } : undefined}
            whileTap={buttonState === 'idle' ? { scale: 0.98 } : undefined}
            className={`
              relative flex min-w-[160px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium
              transition-all duration-300 disabled:cursor-not-allowed
              ${buttonState === 'success'
                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                : buttonState === 'loading'
                ? 'bg-white/5 text-slate-400'
                : 'bg-gradient-to-r from-[#00B4D8] to-[#7C3AED] text-white shadow-lg shadow-[#00B4D8]/20 hover:shadow-[#00B4D8]/40'
              }
            `}
          >
            {buttonState === 'idle' && (
              <>
                <Zap className="h-4 w-4" />
                <span>Enrichir & Ajouter</span>
              </>
            )}
            {buttonState === 'loading' && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Analyse en cours...</span>
              </>
            )}
            {buttonState === 'success' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="flex items-center gap-2"
              >
                <Check className="h-4 w-4" />
                <span>Ajouté</span>
              </motion.div>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default LeadCandidateCard;
