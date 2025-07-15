'use client';

import { useRouter } from 'next/navigation';

interface CardFiltersProps {
  searchQuery?: string;
  typeFilter?: 'image' | 'text';
  hashtagFilter?: string[];
}

export function CardFilters({
  searchQuery,
  typeFilter,
  hashtagFilter,
}: CardFiltersProps) {
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    const type = formData.get('type') as string;
    const hashtags = formData.get('hashtags') as string;

    const params = new URLSearchParams();
    if (q) params.append('q', q);
    if (type) params.append('type', type);
    if (hashtags) params.append('hashtags', hashtags);

    router.push(`/cards?${params.toString()}`);
  };

  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-4">Filters</h2>
      <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
        <div>
          <label className="block font-medium mb-1">Search</label>
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            className="w-full px-3 py-2 border rounded"
            placeholder="Search cards..."
          />
        </div>
        <div>
          <label className="block font-medium mb-1">Type</label>
          <select
            name="type"
            defaultValue={typeFilter}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="">All Types</option>
            <option value="image">Image Cards</option>
            <option value="text">Text Cards</option>
          </select>
        </div>
        <div>
          <label className="block font-medium mb-1">Hashtags</label>
          <input
            type="text"
            name="hashtags"
            defaultValue={hashtagFilter?.join(',')}
            className="w-full px-3 py-2 border rounded"
            placeholder="nature,art,photography"
          />
        </div>
        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </section>
  );
}
