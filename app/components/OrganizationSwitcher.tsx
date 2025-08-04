'use client';

import React, { useState } from 'react';
import { useOrganization } from './OrganizationProvider';

export default function OrganizationSwitcher() {
  const { currentOrganization, organizations, switchToOrganization, isLoading } = useOrganization();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!currentOrganization) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1 text-sm text-gray-400">
        No organization selected
      </div>
    );
  }

  const activeOrganizations = organizations.filter(org => org.isActive);

  const handleSwitchOrganization = async (organizationUUID: string) => {
    await switchToOrganization(organizationUUID);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
      >
        <span className="font-medium text-white">{currentOrganization.OrganizationName}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
          <div className="py-1">
            {activeOrganizations.map((org) => (
              <button
                key={org.OrganizationUUID}
                onClick={() => handleSwitchOrganization(org.OrganizationUUID)}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 transition-colors ${
                  currentOrganization.OrganizationUUID === org.OrganizationUUID
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-300'
                }`}
              >
                <div className="font-medium">{org.OrganizationName}</div>
                <div className="text-xs text-gray-400">{org.OrganizationSlug}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
