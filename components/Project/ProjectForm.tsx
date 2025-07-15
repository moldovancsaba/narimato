import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProjectSchema, type ProjectInput, generateProjectSlug } from '@/lib/validations/project';

interface ProjectFormProps {
  initialData?: ProjectInput;
  onSubmit: (data: ProjectInput) => Promise<void>;
  onCancel?: () => void;
}

export const ProjectForm = ({ initialData, onSubmit, onCancel }: ProjectFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ProjectInput>({
    resolver: zodResolver(ProjectSchema),
    defaultValues: initialData || {
      name: '',
      description: '',
      settings: {
        visibility: 'private',
        allowComments: true,
        cardOrder: 'manual'
      },
      cards: [],
      collaborators: []
    }
  });

  // Auto-generate slug from name
  const name = watch('name');
  if (name) {
    const slug = generateProjectSlug(name);
    setValue('slug', slug);
  }

  const handleFormSubmit = async (data: ProjectInput) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch (error) {
      console.error('Error submitting project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
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
          <option value="private">Private</option>
          <option value="public">Public</option>
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
