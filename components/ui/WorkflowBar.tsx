'use client';

import { Check, Circle, Clock, Send, FileText, CheckCircle2 } from 'lucide-react';

export type WorkflowStep = {
    id: string;
    label: string;
    status: 'completed' | 'current' | 'upcoming';
    date?: string;
};

interface WorkflowBarProps {
    steps: WorkflowStep[];
    className?: string;
}

export function WorkflowBar({ steps, className = '' }: WorkflowBarProps) {
    return (
        <div className={`w-full py-4 ${className}`}>
            <div className="relative flex items-center justify-between w-full">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 -z-10" />

                {steps.map((step, index) => {
                    const isCompleted = step.status === 'completed';
                    const isCurrent = step.status === 'current';

                    return (
                        <div key={step.id} className="flex flex-col items-center bg-white dark:bg-gray-800 px-2">
                            <div
                                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors duration-300 ${isCompleted
                                        ? 'bg-green-500 border-green-500 text-white'
                                        : isCurrent
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30'
                                            : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                                    }`}
                            >
                                {isCompleted ? (
                                    <Check className="w-5 h-5" />
                                ) : isCurrent ? (
                                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                                ) : (
                                    <Circle className="w-5 h-5" />
                                )}
                            </div>
                            <div className="mt-2 text-center">
                                <p
                                    className={`text-xs font-semibold ${isCompleted
                                            ? 'text-green-600 dark:text-green-400'
                                            : isCurrent
                                                ? 'text-blue-600 dark:text-blue-400'
                                                : 'text-gray-500 dark:text-gray-400'
                                        }`}
                                >
                                    {step.label}
                                </p>
                                {step.date && (
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                                        {step.date}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
