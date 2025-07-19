'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ICard } from '@/models/Card'

interface CardFormProps {
  onSubmit: (data: Partial<ICard>) => void
  defaultValues?: Partial<ICard>
}

export default function CardForm({ onSubmit, defaultValues }: CardFormProps) {
  const [type, setType] = useState<'text' | 'image'>(defaultValues?.type || 'text')
  const { register, handleSubmit, formState: { errors } } = useForm<Partial<ICard>>({
    defaultValues
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white p-6 rounded-lg shadow">
      <div>
        <label className="block text-sm font-medium text-gray-700">Type</label>
        <div className="mt-2 space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="text"
              checked={type === 'text'}
              onChange={(e) => setType(e.target.value as 'text')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2">Text</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              value="image"
              checked={type === 'image'}
              onChange={(e) => setType(e.target.value as 'image')}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="ml-2">Image</span>
          </label>
        </div>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          type="text"
          id="title"
          {...register('title', { required: 'Title is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.title && (
          <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Content
        </label>
        <textarea
          id="content"
          rows={4}
          {...register('content', { required: 'Content is required' })}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
        />
        {errors.content && (
          <p className="mt-1 text-sm text-red-600">{errors.content.message}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Submit
      </button>
    </form>
  )
}
