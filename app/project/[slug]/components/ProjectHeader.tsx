'use client';

interface ProjectHeaderProps {
  project: {
    title: string;
    description?: string;
  };
}

/**
 * Displays project title and description
 * Client component for interactive header section
 */
export default function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold mb-2">{project.title}</h1>
      {project.description && (
        <p className="text-gray-600 dark:text-gray-300">{project.description}</p>
      )}
    </div>
  );
}
