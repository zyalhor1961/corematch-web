import React from 'react';
import { CheckCircle2, Circle, AlertTriangle, Loader2, Ban } from 'lucide-react';

export type AgentStep = {
    title: string;
    detail: string;
    status: 'pending' | 'processing' | 'done' | 'error' | 'warning';
};

const StatusIcon = ({ status }: { status: AgentStep['status'] }) => {
    switch (status) {
        case 'done': return <CheckCircle2 className="text-emerald-400" size={16} />;
        case 'warning': return <AlertTriangle className="text-amber-400" size={16} />;
        case 'error': return <Ban className="text-rose-400" size={16} />;
        case 'processing': return <Loader2 className="text-blue-400 animate-spin" size={16} />;
        default: return <Circle className="text-slate-600" size={16} />;
    }
};

export const AgentTimeline = ({ steps }: { steps: AgentStep[] }) => {
    if (!steps || steps.length === 0) return <div className="text-slate-500 text-xs italic">Waiting for agent...</div>;

    return (
        <div className="space-y-0 mt-2">
            {steps.map((step, i) => (
                <div key={i} className="relative pl-6 pb-6 last:pb-0">
                    {i !== steps.length - 1 && <div className="absolute left-[7px] top-5 bottom-0 w-[1px] bg-white/10" />}
                    <div className="absolute left-0 top-0.5 bg-[#0F172A] z-10"><StatusIcon status={step.status} /></div>
                    <div>
                        <div className={`text-xs font-bold uppercase tracking-wider ${step.status === 'done' ? 'text-slate-200' : 'text-blue-300'}`}>{step.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{step.detail}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};
