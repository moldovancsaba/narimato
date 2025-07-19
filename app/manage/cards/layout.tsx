import { ReactNode } from 'react';

export default async function ManageCardsLayout({ children }: { children: ReactNode }) {
  // Placeholder auth state - all users have access
  const isAuthenticated = true;

  return (
    <div className="manage-cards-layout">
      {children}
    </div>
  );
}
