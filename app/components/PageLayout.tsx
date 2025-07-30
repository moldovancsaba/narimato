'use client';

import { motion } from 'framer-motion';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
}

export default function PageLayout({ children, title }: PageLayoutProps) {
  return (
    <div className="page-container">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-content"
      >
        <h1 className="text-3xl font-bold mb-8 text-center">{title}</h1>
        <div className="content-card-lg">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

