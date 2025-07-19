import { ReactNode } from 'react';

export default function CardsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cards-layout">
      {children}
    </div>
  );
}
