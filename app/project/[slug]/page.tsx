import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import { Project } from '@/models/Project';
import { Card } from '@/models/Card';
import LoadingState from './components/LoadingState';
import { revalidatePath } from 'next/cache';
import ProjectWithRealtime from './components/ProjectWithRealtime';

interface MongoDoc {
  _id: { toString(): string };
  name: string;
  description?: string;
  slug: string;
  settings: {
    visibility: 'public' | 'private';
  };
  createdAt: Date;
  updatedAt: Date;
  cards: Array<{
    _id: { toString(): string };
    title: string;
    content: string;
    type: 'text' | 'image';
    order: number;
  }>;
}

/**
 * Fetches a project and its cards from the database
 * Transforms MongoDB document into a client-safe format
 */
async function getProject(slug: string) {
  try {
    await dbConnect();
    const project = await Project.findOne({ slug }).populate('cards').lean() as MongoDoc | null;
    
    if (!project) {
      return null;
    }

    return {
      id: project._id.toString(),
      title: project.name, // Map from name to title
      description: project.description,
      slug: project.slug,
      isPublic: project.settings.visibility === 'public',
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      cards: project.cards.map((card) => ({
        id: card._id.toString(),
        title: card.title,
        content: card.content,
        type: card.type,
        order: card.order,
      })),
    };
  } catch (error) {
    console.error('Error fetching project:', error);
    return null;
  }
}

/**
 * Project page component
 * Server component that manages project data and card reordering
 */
export default async function ProjectPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

async function ProjectContent({ params }: { params: { slug: string } }) {
  const project = await getProject(params.slug);

  if (!project) {
    notFound();
  }

  /**
   * Server action to reorder cards in a project
   * Updates card order in database and revalidates the page
   */
  async function reorderCards(cardIds: string[]) {
    'use server';
    
    try {
      await dbConnect();
      const projectDoc = await Project.findOne({ slug: params.slug });
      
      if (!projectDoc) {
        throw new Error('Project not found');
      }

      projectDoc.cards = cardIds;
      await projectDoc.save();
      
      revalidatePath(`/project/${params.slug}`);
      return { success: true };
    } catch (error) {
      console.error('Error reordering cards:', error);
      return { success: false, error: 'Failed to reorder cards' };
    }
  }

  return (
    <ProjectWithRealtime
      initialProject={project}
      slug={params.slug}
      reorderCards={reorderCards}
    />
  );
}

