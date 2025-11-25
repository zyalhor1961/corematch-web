import React from 'react';

interface PageContainerProps {
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
}

const PageContainer = ({ title, children, actions }: PageContainerProps) => {
    return (
        <div className="space-y-8">
            {/* HEADER: Transparent, Clean, Sharp */}
            <div className="flex justify-between items-end pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-light tracking-tight text-white">
                        {title}
                    </h1>
                    <p className="text-sm text-slate-400 mt-1 font-light">
                        Gestion et pilotage centralisé
                    </p>
                </div>

                {/* THE BUTTONS: Neon Glow Effect */}
                <div className="flex gap-3 [&_button]:shadow-[0_0_20px_rgba(45,212,191,0.2)] [&_button]:transition-all [&_button]:duration-300 hover:[&_button]:shadow-[0_0_30px_rgba(45,212,191,0.4)] hover:[&_button]:scale-105">
                    {actions}
                </div>
            </div>

            {/* CONTENT: No more gray box wrapper. We let the children float. */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {children}
            </div>
        </div>
    );
};

export default PageContainer;
