
import React, { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface PageContainerProps {
    title: string;
    actions?: ReactNode;
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
}

const PageContainer = ({ title, actions, children, breadcrumbs }: PageContainerProps) => {
    return (
        <div className="flex flex-col h-full">
            {/* Breadcrumbs */}
            {breadcrumbs && breadcrumbs.length > 0 && (
                <nav className="flex items-center space-x-1 text-sm text-slate-400 mb-2">
                    {breadcrumbs.map((item, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && <ChevronRight className="w-4 h-4 text-slate-600" />}
                            {item.href ? (
                                <Link
                                    href={item.href}
                                    className="hover:text-white transition-colors"
                                >
                                    {item.label}
                                </Link>
                            ) : (
                                <span className="text-slate-200 font-medium">{item.label}</span>
                            )}
                        </React.Fragment>
                    ))}
                </nav>
            )}

            {/* Page Header */}
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
                {actions && (
                    <div className="flex items-center space-x-3">
                        {actions}
                    </div>
                )}
            </div>

            {/* Glass Card Container */}
            <div className="flex-1 bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-xl p-4 md:p-6 overflow-auto shadow-xl relative">
                {/* Decorative corner gradients */}
                <div className="absolute top-0 left-0 w-32 h-32 bg-neon-teal/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-agent-purple/5 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

                <div className="relative z-10">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default PageContainer;
