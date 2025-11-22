import { ReactNode } from 'react';

export default function ERPLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50/50">
      {children}
    </div>
  );
}
