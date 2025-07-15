import { z } from 'zod';
import { Card } from '@/models/Card';
import { CardContainer } from '@/components/ui/CardContainer';
import { Card as CardComponent } from '@/components/ui/Card';
import { ImgBBUploader } from '@/lib/imgbb';

/**
 * Card Editor Page Component
 * Handles both creation and editing of cards
 * Supports image upload via ImgBB and text card translation
 */

// Card validation schema using Zod
const cardSchema = z.object({
  type: z.enum(['image', 'text']),
  content: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  hashtags: z.array(z.string()),
  imageAlt: z.string().optional(),
  translations: z.array(z.object({
    languageCode: z.string(),
    content: z.string(),
    title: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
});

// Component for handling image uploads to ImgBB
async function uploadImage(file: File): Promise<string> {
  const uploader = new ImgBBUploader(process.env.IMGBB_API_KEY!);
  const result = await uploader.upload(file);
  return result.url;
}

export default function CardEditorPage() {
  return (
    <main className="min-h-screen flex flex-col items-center p-4">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Create New Card</h1>
        
        {/* Card Type Selection */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Card Type</h2>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-blue-500 text-white rounded">
              Image Card
            </button>
            <button className="px-4 py-2 bg-gray-500 text-white rounded">
              Text Card
            </button>
          </div>
        </section>

        {/* Card Form */}
        <form className="space-y-6">
          {/* Basic Info */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Card title"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Slug</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="unique-card-identifier"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded"
                  rows={3}
                  placeholder="Card description"
                />
              </div>
            </div>
          </section>

          {/* Content Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Card Content</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">
                  Image URL or Text Content
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded"
                  rows={4}
                  placeholder="Enter image URL or text content"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Alternative Text (for images)
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Describe the image for accessibility"
                />
              </div>
            </div>
          </section>

          {/* Hashtags Section */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Hashtags</h2>
            <div>
              <label className="block font-medium mb-1">
                Add hashtags (comma separated)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border rounded"
                placeholder="nature, photography, art"
              />
            </div>
          </section>

          {/* Translations Section (for text cards) */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Translations</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-1">Language Code</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border rounded"
                  placeholder="en, es, fr, etc."
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Translated Content
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded"
                  rows={4}
                  placeholder="Enter translated content"
                />
              </div>
              <button
                type="button"
                className="px-4 py-2 bg-green-500 text-white rounded"
              >
                Add Translation
              </button>
            </div>
          </section>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              Create Card
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
