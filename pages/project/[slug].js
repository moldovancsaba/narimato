import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import Card from '../../components/Card';
import CardContainer from '../../components/CardContainer';

/**
 * Project Page Component
 * Implements project view and card management following narimato.md specs:
 * - Uses slug-based URL routing (/project/[slug])
 * - Supports card reordering by project creator
 * - Integrates with the global card system
 * - Uses container-based styling approach
 */
export default function ProjectPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [project, setProject] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) return;

    const fetchProject = async () => {
      try {
        const response = await fetch(`/api/projects/${slug}`);
        if (!response.ok) throw new Error('Failed to fetch project');
        
        const data = await response.json();
        setProject(data);
        setCards(data.cards);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [slug]);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const items = Array.from(cards);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setCards(items);

    try {
      const response = await fetch('/api/projects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: project._id,
          cardOrder: items.map(card => card._id)
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update card order');
      }
    } catch (error) {
      console.error('Error updating card order:', error);
      // Revert the state if the API call fails
      setCards(cards);
    }
  };

  // Loading states with consistent styling
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-2xl">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500 text-xl">Project not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              {project.description}
            </p>
          )}
        </header>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="cards">
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {cards.map((card, index) => (
                  <Draggable
                    key={card._id}
                    draggableId={card._id}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <CardContainer>
                          <Card
                            type={card.type}
                            content={card.content}
                            title={card.title}
                            slug={card.slug}
                            hashtags={card.hashtags}
                            createdAt={new Date(card.createdAt)}
                            updatedAt={new Date(card.updatedAt)}
                            imageAlt={card.imageAlt}
                            translationKey={card.translationKey}
                          />
                        </CardContainer>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </div>
  );
}
