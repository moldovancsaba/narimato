import { ReactNode } from 'react';

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="projects-layout">
      {children}
    </div>
  );
}
