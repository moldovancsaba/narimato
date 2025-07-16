'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProjectForm } from '@/components/Project/ProjectForm';
import type { ProjectInput } from '@/lib/validations/project';

/**
 * CreateProjectPage - Handles the creation of new projects
 * 
 * This page component provides a form interface for creating new projects.
 * It handles:
 * - Form submission and data validation via ProjectForm component
 * - API integration for project creation
 * - User feedback (loading states and error messages)
 * - Automatic redirection to the new project page on success
 */
/**
 * CreateProjectPage - Handles the creation of new projects
 * 
 * This page component provides a form interface for creating new projects.
 * It requires authentication and handles:
 * - Form submission and data validation via ProjectForm component
 * - API integration for project creation
 * - User feedback (loading states and error messages)
 * - Automatic redirection to the new project page on success
 */
export default function CreateProjectPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [error, setError] = useState<string | null>(null);

  /**
   * Handles the project creation process
   * @param data - Validated project data from the form
   */
const handleCreateProject = async (data: ProjectInput) => {
    if (!session?.user?.id) {
      throw new Error('You must be logged in to create a project');
    }

    // Set createdBy to the current user's ID
    const projectData = {
      ...data,
      createdBy: session.user.id
    };
    try {
      // Attempt to create the project via API
      console.log('Sending project data:', projectData);
      
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        // Parse error message from API if available
        const errorData = await response.json().catch(() => ({}));
        console.error('Project creation failed:', errorData);
        throw new Error(errorData.message || errorData.error || 'Failed to create project');
      }

      const result = await response.json();
      console.log('Project creation response:', result);
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to create project');
      }
      
      // Redirect to the newly created project's page
      router.push(`/project/${result.data.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    }
  };

  // Handle unauthenticated state
  if (status === 'loading') {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-600">
            You must be logged in to create a project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Create New Project
        </h1>

        {error && (
          <div className="rounded-md bg-red-50 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <ProjectForm
          initialData={{ createdBy: session.user.id }}
          onSubmit={handleCreateProject}
        />
      </div>
    </div>
  );
}
