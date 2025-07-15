import { Suspense } from 'react';
import { Project } from '@/models/Project';
import { Activity } from '@/models/Activity';
import ProjectsMenu from '@/components/Projects/ProjectsMenu';
import dbConnect from '@/lib/mongodb';

// Loading component for Suspense fallback
function LoadingState() {
  return (
    <div className="animate-pulse p-6">
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-8">
          <div className="h-10 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
        <div className="col-span-4 space-y-6">
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}

async function getProjects() {
  await dbConnect();
  
  const projects = await Project.find()
    .sort({ updatedAt: -1 })
    .lean();

  const activities = await Activity.find()
    .sort({ timestamp: -1 })
    .limit(10)
    .lean();

  return {
    projects: projects.map(project => ({
      id: project._id?.toString() || '',
      title: project.title,
      description: project.description,
      slug: project.slug,
      tags: project.tags || [],
      isPublic: project.isPublic,
      isFeatured: project.settings?.isFeatured || false,
      viewCount: project.viewCount || 0,
      lastViewedAt: project.lastViewedAt?.toISOString(),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    })),
    activities: activities.map(activity => ({
      type: activity.type,
      projectId: activity.projectId.toString(),
      projectTitle: activity.projectTitle,
      timestamp: activity.timestamp.toISOString(),
      userId: activity.userId.toString(),
      userName: activity.userName,
      details: activity.details,
    })),
  };
}

export default async function ProjectsPage() {
  const { projects, activities } = await getProjects();

  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectsMenu projects={projects} activities={activities} />
    </Suspense>
  );
}
