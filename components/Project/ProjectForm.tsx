import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProjectSchema, type ProjectInput, generateProjectSlug } from '@/lib/validations/project';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

/**
 * Props for the ProjectForm component
 */
interface ProjectFormProps {
  /** Initial project data for edit mode, undefined for create mode */
  initialData?: Partial<ProjectInput>;
  /** Callback function to handle form submission */
  onSubmit: (data: ProjectInput) => Promise<void>;
  /** Optional callback function for handling cancellation */
  onCancel?: () => void;
}

/**
 * ProjectForm Component
 * 
 * A reusable form component for creating and editing projects. Handles form state,
 * validation, error handling, and automatic slug generation based on project name.
 * Supports both creation and edit modes with proper loading states and error feedback.
 *
 * Features:
 * - Zod schema validation
 * - Automatic slug generation from project name
 * - Field error messages
 * - Loading state during submission
 * - Submission error handling
 * - Dark mode support
 */
export const ProjectForm = ({ initialData, onSubmit, onCancel }: ProjectFormProps) => {
  // Track form submission state and errors
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Initialize form with react-hook-form and zod validation
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ProjectInput>({
    resolver: zodResolver(ProjectSchema),
    defaultValues: {
      name: '',
      description: '',
      slug: '',
      settings: {
        visibility: 'public',  // Projects are public by default per spec
        allowComments: true,
        cardOrder: 'manual',
        isFeatured: false
      },
      cards: [],
      collaborators: [],
      tags: [],
      viewCount: 0,
      activity: [],
      ...initialData
    }
  });

  // Auto-generate URL-friendly slug whenever the project name changes
  // This ensures the project has a valid URL path that matches its name
  const name = watch('name');

  // Update slug only when name changes
  useEffect(() => {
    if (name) {
      const slug = generateProjectSlug(name);
      setValue('slug', slug);
    }
  }, [name, setValue]);

  /**
   * Handles form submission with proper error handling and loading states.
   * Prevents multiple submissions and provides error feedback to the user.
   */
  const handleFormSubmit = async (data: ProjectInput) => {
    console.log('Form submitted with data:', data);
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting project:', error);
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : 'Failed to submit project. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {submitError && (
        <div className="p-4 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300">
          {submitError}
        </div>
      )}
      {isSubmitting && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg flex items-center space-x-4">
            <LoadingSpinner size="md" />
            <p className="text-gray-700 dark:text-gray-300">Saving project...</p>
          </div>
        </div>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Project Name
        </label>
        <input
          type="text"
          id="name"
          {...register('name')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          rows={3}
          {...register('description')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="visibility" className="block text-sm font-medium text-gray-700">
          Visibility
        </label>
        <select
          id="visibility"
          {...register('settings.visibility')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="allowComments"
          {...register('settings.allowComments')}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="allowComments" className="ml-2 block text-sm text-gray-700">
          Allow Comments
        </label>
      </div>

      <div>
        <label htmlFor="cardOrder" className="block text-sm font-medium text-gray-700">
          Card Order
        </label>
        <select
          id="cardOrder"
          {...register('settings.cardOrder')}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="manual">Manual</option>
          <option value="date">By Date</option>
          <option value="popularity">By Popularity</option>
        </select>
      </div>

      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          {isSubmitting ? 'Saving...' : initialData ? 'Update Project' : 'Create Project'}
        </button>
      </div>
    </form>
  );
};
