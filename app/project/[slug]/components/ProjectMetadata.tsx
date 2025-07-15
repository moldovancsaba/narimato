'use client';

interface ProjectMetadataProps {
  project: {
    createdAt: string;
    updatedAt: string;
    isPublic: boolean;
    cards: Array<{ type: 'text' | 'image' }>;
  };
}

/**
 * Displays project metadata information
 * Shows creation date, last update time, visibility status and card stats
 */
export default function ProjectMetadata({ project }: ProjectMetadataProps) {
  const cardCount = project.cards.length;
  const textCards = project.cards.filter(card => card.type === 'text').length;
  const imageCards = project.cards.filter(card => card.type === 'image').length;

  return (
    <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Created</span>
          <p className="font-medium">
            {new Date(project.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Last Updated</span>
          <p className="font-medium">
            {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
          <div className="flex items-center mt-1">
            <div className={`w-2 h-2 rounded-full ${project.isPublic ? 'bg-green-500' : 'bg-yellow-500'} mr-2`} />
            <p className="font-medium">
              {project.isPublic ? 'Public' : 'Private'}
            </p>
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">Cards</span>
          <p className="font-medium">
            {cardCount} total ({textCards} text, {imageCards} image)
          </p>
        </div>
      </div>
    </div>
  );
}
