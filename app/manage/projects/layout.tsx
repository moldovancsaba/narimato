import { ReactNode } from 'react';

export default async function ManageProjectsLayout({ children }: { children: ReactNode }) {
  // Placeholder auth state - all users have access
  const isAuthenticated = true;

  return (
    <div className="manage-projects-layout">
      {children}
    </div>
  );
}
