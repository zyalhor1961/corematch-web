import React from 'react';

interface PageContainerProps {
    title: string;
    children: React.ReactNode;
    actions?: React.ReactNode;
    subtitle?: string;
}

const PageContainer = ({ title, children, actions, subtitle }: PageContainerProps) => {
    return (
        <div className="space-y-6 md:space-y-8">
            {/* HEADER: Responsive - stacks on mobile */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 pb-4 md:pb-6 border-b border-white/5">
                <div className="min-w-0">
                    <h1 className="text-2xl md:text-3xl font-light tracking-tight text-white truncate">
                        {title}
                    </h1>
                    <p className="text-xs md:text-sm text-slate-400 mt-1 font-light">
                        {subtitle || 'Gestion et pilotage centralisé'}
                    </p>
                </div>

                {/* THE BUTTONS: Wrap on mobile */}
                {actions && (
                    <div className="flex flex-wrap gap-2 sm:gap-3 shrink-0 [&_button]:shadow-[0_0_20px_rgba(45,212,191,0.2)] [&_button]:transition-all [&_button]:duration-300 hover:[&_button]:shadow-[0_0_30px_rgba(45,212,191,0.4)] hover:[&_button]:scale-105">
                        {actions}
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <main className="w-full max-w-full overflow-x-hidden">
                <div className="space-y-4 md:space-y-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default PageContainer;
