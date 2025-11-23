

import React from 'react';
import CoreMatchShell from '@/components/Shell/CoreMatchShell';

export default function OrganizationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CoreMatchShell>
      {children}
    </CoreMatchShell>
  );
}