'use client';

import { useState } from 'react';
import { Switch } from '@headlessui/react';
import { ClipboardDocumentIcon, ShareIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import type { ProjectInput } from '@/lib/validations/project';

interface ProjectSettingsProps {
  project: ProjectInput;
  onVisibilityChange: (isPublic: boolean) => Promise<void>;
  onShareProject: () => Promise<void>;
  onExportData: () => Promise<void>;
}

export const ProjectSettings = ({
  project,
  onVisibilityChange,
  onShareProject,
  onExportData,
}: ProjectSettingsProps) => {
  const [isPublic, setIsPublic] = useState(project.settings?.visibility === 'public');
  const [copySuccess, setCopySuccess] = useState(false);

  const handleVisibilityToggle = async () => {
    try {
      await onVisibilityChange(!isPublic);
      setIsPublic(!isPublic);
    } catch (error) {
      console.error('Error updating visibility:', error);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Error copying link:', error);
    }
  };

  return (
    <div className="space-y-6 bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="space-y-6">
          {/* Visibility Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">Project Visibility</h3>
              <p className="mt-1 text-sm text-gray-500">
                {isPublic ? 'Anyone with the link can view this project' : 'Only you can see this project'}
              </p>
            </div>
            <Switch
              checked={isPublic}
              onChange={handleVisibilityToggle}
              className={`${
                isPublic ? 'bg-indigo-600' : 'bg-gray-200'
              } relative inline-flex h-6 w-11 items-center rounded-full`}
            >
              <span className="sr-only">Toggle project visibility</span>
              <span
                className={`${
                  isPublic ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition`}
              />
            </Switch>
          </div>

          {/* Share Project */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Share Project</h3>
            <div className="mt-2 flex items-center space-x-4">
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ClipboardDocumentIcon className="mr-2 h-5 w-5" />
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                type="button"
                onClick={onShareProject}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ShareIcon className="mr-2 h-5 w-5" />
                Share
              </button>
            </div>
          </div>

          {/* Export Data */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Export Project Data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Download all project data including cards and settings
            </p>
            <div className="mt-2">
              <button
                type="button"
                onClick={onExportData}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowDownTrayIcon className="mr-2 h-5 w-5" />
                Export Project
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
