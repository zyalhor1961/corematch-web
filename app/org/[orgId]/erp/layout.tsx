import { ReactNode } from 'react';

export default function ERPLayout({ children }: { children: ReactNode }) {
  return (
    // ERP pages flow naturally - no additional wrapper needed
    // The CoreMatchShell already provides the proper structure
    <div className="w-full">
      {children}
    </div>
  );
}
