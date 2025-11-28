'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit,
  Globe,
  MapPinCheckInside,
  Filter,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================
// TYPES & DATA
// ============================================================

interface HunterStep {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
}

const HUNTER_STEPS: HunterStep[] = [
  {
    id: 'init',
    icon: BrainCircuit,
    label: 'Initialisation du Cerveau Stratégique',
    description: 'Analyse de la demande et définition du ciblage.',
  },
  {
    id: 'scan',
    icon: Globe,
    label: 'Scan du Web en Temps Réel',
    description: 'Exploration large pour identifier des candidats.',
  },
  {
    id: 'geo',
    icon: MapPinCheckInside,
    label: 'Vérification Territoriale',
    description: 'Validation de la localisation précise.',
  },
  {
    id: 'qualify',
    icon: Filter,
    label: 'Qualification IA Avancée',
    description: 'Séparation des prospects et des concurrents.',
  },
];

const STEP_DURATION = 7000; // 7 seconds per step

// ============================================================
// PULSING ICON COMPONENT
// ============================================================

function PulsingIcon({ icon: Icon, className }: { icon: React.ElementType; className?: string }) {
  return (
    <div className="relative">
      {/* Outer pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-cyan-500/30"
        animate={{
          scale: [1, 1.8, 1.8],
          opacity: [0.6, 0, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
      {/* Inner pulse ring */}
      <motion.div
        className="absolute inset-0 rounded-full bg-cyan-400/40"
        animate={{
          scale: [1, 1.4, 1.4],
          opacity: [0.8, 0, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
          delay: 0.2,
        }}
      />
      {/* Icon container */}
      <motion.div
        className={cn(
          "relative z-10 w-10 h-10 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/30",
          className
        )}
        animate={{
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <Icon size={20} className="text-white" />
      </motion.div>
    </div>
  );
}

// ============================================================
// STEP ITEM COMPONENT
// ============================================================

interface StepItemProps {
  step: HunterStep;
  status: 'completed' | 'active' | 'pending';
  isLast: boolean;
}

function StepItem({ step, status, isLast }: StepItemProps) {
  const Icon = step.icon;

  return (
    <div className="relative flex gap-4">
      {/* Vertical line connector */}
      {!isLast && (
        <div className="absolute left-5 top-12 w-0.5 h-[calc(100%-12px)] -translate-x-1/2">
          <motion.div
            className={cn(
              "w-full h-full",
              status === 'completed' ? 'bg-emerald-500/50' : 'bg-slate-700/50'
            )}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{ transformOrigin: 'top' }}
          />
        </div>
      )}

      {/* Icon */}
      <div className="relative z-10 flex-shrink-0">
        <AnimatePresence mode="wait">
          {status === 'completed' && (
            <motion.div
              key="completed"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center"
            >
              <CheckCircle2 size={20} className="text-emerald-400" />
            </motion.div>
          )}
          {status === 'active' && (
            <motion.div
              key="active"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <PulsingIcon icon={Icon} />
            </motion.div>
          )}
          {status === 'pending' && (
            <motion.div
              key="pending"
              className="w-10 h-10 rounded-full bg-slate-800/50 border border-slate-700 flex items-center justify-center"
            >
              <Icon size={18} className="text-slate-600" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="flex-1 pb-8">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3
            className={cn(
              "font-medium text-sm transition-colors",
              status === 'completed' && 'text-slate-500',
              status === 'active' && 'text-white',
              status === 'pending' && 'text-slate-600'
            )}
          >
            {step.label}
          </h3>

          <AnimatePresence>
            {status === 'active' && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-slate-400 mt-1"
              >
                {step.description}
              </motion.p>
            )}
          </AnimatePresence>

          {status === 'completed' && (
            <p className="text-xs text-emerald-500/70 mt-0.5">Terminé</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

interface HunterProgressProps {
  className?: string;
}

export function HunterProgress({ className }: HunterProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= HUNTER_STEPS.length - 1) {
          return prev; // Stay on last step
        }
        return prev + 1;
      });
    }, STEP_DURATION);

    return () => clearInterval(interval);
  }, []);

  const getStepStatus = (index: number): 'completed' | 'active' | 'pending' => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'active';
    return 'pending';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={cn(
        "relative p-6 rounded-2xl",
        "bg-gradient-to-br from-slate-900/90 to-slate-950/90",
        "border border-white/5 backdrop-blur-xl",
        "shadow-2xl shadow-cyan-500/5",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative">
          <div className="absolute inset-0 bg-cyan-500/20 rounded-lg blur-md" />
          <div className="relative p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Loader2 size={18} className="text-cyan-400 animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Chasse en cours...</h2>
          <p className="text-xs text-slate-500">
            Étape {currentStep + 1} sur {HUNTER_STEPS.length}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-teal-400"
            initial={{ width: '0%' }}
            animate={{
              width: `${((currentStep + 1) / HUNTER_STEPS.length) * 100}%`
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-0">
        {HUNTER_STEPS.map((step, index) => (
          <StepItem
            key={step.id}
            step={step}
            status={getStepStatus(index)}
            isLast={index === HUNTER_STEPS.length - 1}
          />
        ))}
      </div>

      {/* Bottom glow effect */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-cyan-500/10 blur-2xl rounded-full" />
    </motion.div>
  );
}

export default HunterProgress;
