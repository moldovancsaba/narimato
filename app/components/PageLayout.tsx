'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  className?: string;
}

const PageLayout = React.memo(function PageLayout({ children, title, className }: PageLayoutProps) {
  return (
    <div className={`page-grid-container ${className || ''}`}>
      <div className="page-title-grid">
        <h1 className="text-3xl font-bold text-center">{title}</h1>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-main-grid"
      >
        {children}
      </motion.div>
    </div>
  );
});

export default PageLayout;

