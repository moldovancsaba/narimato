import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProjectSchema, type ProjectInput, generateProjectSlug } from '@/lib/validations/project';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CardSelector } from './CardSelector';

/**
 * Props for the ProjectForm component
 */
interface ProjectFormProps {
  /** Initial project data for edit mode, undefined for create mode */
  initialData?: Partial<ProjectInput> & { _id?: string };
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
  // Track component states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardActionInProgress, setCardActionInProgress] = useState<number | null>(null);

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
  const name = watch('name');

  // Update slug only when name changes
  useEffect(() => {
    if (name && !watch('slug')) {
      const slug = generateProjectSlug(name);
      setValue('slug', slug);
    }
  }, [name, setValue, watch]);

  /**
   * Handles form submission with proper error handling and loading states.
   * Prevents multiple submissions and provides error feedback to the user.
   */
  const handleCardAction = async (action: 'add' | 'remove', index?: number) => {
    if (action === 'add') {
      setIsAddingCard(true);
    } else if (index !== undefined) {
      setCardActionInProgress(index);
    }

    try {
      // Ensure cards is always an array, even if undefined
      const cards = watch('cards') || [];
      if (action === 'add') {
        // Generate a temporary card ID - in a real app, this would be handled by the backend
        const newCardId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setValue('cards', [...cards, newCardId]);
      } else if (index !== undefined) {
        setValue('cards', cards.filter((_, i) => i !== index));
      }
      // Simulate a delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setIsAddingCard(false);
      setCardActionInProgress(null);
    }
  };

  const validateSlug = async (slug: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/validate-slug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          collection: 'projects',
          currentId: initialData?._id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to validate slug');
      }

      const { isUnique } = await response.json();
      return isUnique;
    } catch (error) {
      console.error('Error validating slug:', error);
      return false;
    }
  };

  const handleFormSubmit = async (data: ProjectInput) => {
    console.log('Form submitted with data:', data);
    setIsSubmitting(true);
    setSubmitError('');

    // Validate slug uniqueness
    const isUnique = await validateSlug(data.slug);
    if (!isUnique) {
      setSubmitError('This URL slug is already in use. Please choose a different one.');
      setIsSubmitting(false);
      return;
    }
    try {
      await onSubmit(data);
      setSubmitSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
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
      {submitSuccess && !submitError && !isSubmitting && (
        <div className="p-4 rounded-md bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 flex items-center justify-between">
          <div className="flex items-center">
            <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Project saved successfully!
          </div>
        </div>
      )}
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
        <label htmlFor="slug" className="block text-sm font-medium text-gray-700">
          URL Slug
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="text"
            id="slug"
            {...register('slug')}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="project-url-slug"
          />
        </div>
        {errors.slug && (
          <p className="mt-1 text-sm text-red-600">{errors.slug.message}</p>
        )}
        <p className="mt-1 text-xs text-gray-500">
          The URL-friendly identifier for your project. Only lowercase letters, numbers, and hyphens are allowed.
        </p>
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

      {/* Card Management Section */}
      <div className="mt-6 space-y-4">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
          Cards
        </h3>
        <CardSelector
          projectSlug={watch('slug')}
          onCardAdded={() => {
            // The project data will be updated through the onSubmit callback
            setSubmitSuccess(true);
            setTimeout(() => setSubmitSuccess(false), 3000);
          }}
          onError={(error) => {
            setSubmitError(error.message);
            setTimeout(() => setSubmitError(''), 3000);
          }}
        />

        <div className="mt-4 bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {(watch('cards') || []).map((card, index) => (
              <li 
                key={index} 
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Card ID: {card}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCardAction('remove', index)}
                  disabled={cardActionInProgress === index}
                  className="ml-4 flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 relative"
                >
                  {cardActionInProgress === index ? (
                    <LoadingSpinner size="sm" className="absolute inset-0 m-auto" />
                  ) : (
                    <>
                      <span className="sr-only">Remove card</span>
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {(watch('cards') || []).length === 0 && (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No cards added yet
            </div>
          )}
        </div>
        <button 
          type="button" 
          onClick={() => handleCardAction('add')}
          disabled={isAddingCard}
          className="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed relative"
        >
          {isAddingCard ? (
            <LoadingSpinner size="sm" className="absolute inset-0 m-auto" />
          ) : (
            <>
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New Card
            </>
          )}
        </button>
      </div>

      <div className="flex justify-end space-x-3 mt-6">
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
