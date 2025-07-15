import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useSession } from 'next-auth/react';

export default function ProjectPage() {
  const router = useRouter();
  const { slug } = router.query;
  const { data: session } = useSession();
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

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!project) return <div>Project not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        {session && (
          <button
            onClick={() => router.push(`/project/${slug}/edit`)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Edit Project
          </button>
        )}
      </div>

      {project.description && (
        <p className="text-gray-600 mb-8">{project.description}</p>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="cards">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="space-y-4"
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
                      className="bg-white p-4 rounded-lg shadow"
                    >
                      {card.type === 'image' ? (
                        <img
                          src={card.imageUrl}
                          alt={card.content}
                          className="w-full h-48 object-cover rounded"
                        />
                      ) : (
                        <p>{card.content}</p>
                      )}
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
  );
}
