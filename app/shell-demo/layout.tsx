

import React from 'react';
import AppShell from '@/components/Layout/AppShell';

export default function ShellDemoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AppShell>
            {children}
        </AppShell>
    );
}
