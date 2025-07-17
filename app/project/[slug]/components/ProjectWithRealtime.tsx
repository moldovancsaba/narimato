'use client';

import { useEffect, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import ProjectHeader from './ProjectHeader';
import ProjectMetadata from './ProjectMetadata';
import CardList from './CardList';
import CardManager from './CardManager';
import ErrorState from './ErrorState';
import { ErrorBoundary } from 'react-error-boundary';
import { useRouter } from 'next/navigation';

interface Project {
  id: string;
  title: string;
  description?: string;
  slug: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  cards: Array<{
    id: string;
    title: string;
    content: string;
    type: 'text' | 'image';
    order: number;
  }>;
}

interface ProjectWithRealtimeProps {
  initialProject: Project;
  slug: string;
  reorderCards: (cardIds: string[]) => Promise<{ success: boolean; error?: string }>;
}

export default function ProjectWithRealtime({
  initialProject,
  slug,
  reorderCards,
}: ProjectWithRealtimeProps) {
  const [project, setProject] = useState(initialProject);
  const { socket, connectionState, activeUsers } = useWebSocket();
  const router = useRouter();

  const handleProjectUpdate = () => {
    // Refresh the page data
    router.refresh();
  };

  useEffect(() => {
    if (!socket) return;

    // Subscribe to project updates
    socket.emit('subscribe:project', slug);

    // Handle project updates
    socket.on('project:update', (updatedProject: Project) => {
      setProject(updatedProject);
    });

    // Handle card updates
  socket.on('card:update', (updatedCard: Project['cards'][0]) => {
      setProject((prev: Project) => ({
        ...prev,
        cards: prev.cards.map((card) =>
          card.id === updatedCard.id ? updatedCard : card
        ),
      }));
    });

    // Cleanup
    return () => {
      socket.emit('unsubscribe:project', slug);
      socket.off('project:update');
      socket.off('card:update');
    };
  }, [socket, slug]);

  return (
    <ErrorBoundary fallbackRender={({ error, resetErrorBoundary }) => 
      <ErrorState error={error} reset={resetErrorBoundary} />
    }>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="flex items-center space-x-2">
            <span className={`inline-block w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span className="text-gray-600">
              {connectionState === 'connected' ? 'Connected' :
               connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-gray-600">Active Users:</span>
            <span className="font-medium">{activeUsers}</span>
          </div>
        </div>
        <ProjectHeader project={project} onUpdate={handleProjectUpdate} />
        <ProjectMetadata project={project} />
        <CardManager 
          projectSlug={slug}
          onCardAdded={handleProjectUpdate}
        />
        <CardList 
          project={project} 
          reorderCards={reorderCards}
        />
      </div>
    </ErrorBoundary>
  );
}
