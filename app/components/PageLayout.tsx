'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  className?: string;
  fullscreen?: boolean; // New prop for full-screen layouts
  showHeader?: boolean; // Whether to show the header
}

const PageLayout = React.memo(function PageLayout({ 
  children, 
  title, 
  className = '', 
  fullscreen = false,
  showHeader = true
}: PageLayoutProps) {
  
  // Full-screen layout for admin/editor pages
  if (fullscreen) {
    return (
      <div className={`page-fullscreen ${className}`}>
        {showHeader && (
          <div className="page-fullscreen-header">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold gradient-title">{title}</h1>
              <div className="text-sm text-muted opacity-75">
                Full Screen Mode
              </div>
            </div>
          </div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="page-fullscreen-content"
        >
          {children}
        </motion.div>
      </div>
    );
  }
  
  // Standard grid layout for regular pages
  return (
    <div className={`page-grid-container ${className}`}>
      {showHeader && (
        <div className="page-title-grid">
          <h1 className="text-3xl font-bold text-center">{title}</h1>
        </div>
      )}
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

