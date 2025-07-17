'use client';

import { useState } from 'react';
import { EditProjectModal } from '@/components/Project/EditProjectModal';
import { Button } from '@/components/ui/button';

interface ProjectHeaderProps {
  project: {
    title: string;
    description?: string;
    slug: string;
  };
  onUpdate?: () => void;
}

/**
 * Displays project title and description
 * Client component for interactive header section
 */
export default function ProjectHeader({ project, onUpdate }: ProjectHeaderProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

const handleSave = async (data: { name: string; description?: string }) => {
    try {
      const response = await fetch(`/api/projects/${project.slug}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      onUpdate?.();
    } catch (error) {
      console.error('Error updating project:', error);
      throw error;
    }
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
          {project.description && (
            <p className="text-gray-600 dark:text-gray-300">{project.description}</p>
          )}
        </div>
        <Button 
          onClick={() => setIsEditModalOpen(true)}
          variant="outline"
          size="sm"
        >
          Edit Project
        </Button>
      </div>

      <EditProjectModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        project={{
          name: project.title,
          description: project.description,
          slug: project.slug,
        }}
        onSave={handleSave}
      />
    </div>
  );
}
