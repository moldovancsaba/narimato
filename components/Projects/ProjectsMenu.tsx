'use client';

import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ArrowsUpDownIcon, StarIcon, TagIcon, BookmarkIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
import { motion, AnimatePresence } from 'framer-motion';

interface Project {
  id: string;
  title: string; // maps to name in the database
  description?: string;
  slug: string;
  tags: Array<{ name: string; color: string }>;
  isPublic: boolean;
  isFeatured: boolean;
  viewCount: number;
  lastViewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ProjectActivity {
  type: 'created' | 'updated' | 'deleted' | 'card_added' | 'card_removed' | 'collaborator_added' | 'collaborator_removed' | 'comment_added';
  projectId: string;
  projectTitle: string;
  timestamp: string;
  userId: string;
  userName: string;
  details?: Record<string, any>;
}

interface ProjectsMenuProps {
  projects: Project[];
  activities: ProjectActivity[];
}

export default function ProjectsMenu({ projects, activities }: ProjectsMenuProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<'name' | 'recent' | 'popular'>('recent');
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);

  // Get unique tags from all projects
  const allTags = Array.from(new Set(projects.flatMap(p => p.tags.map(t => t.name))));

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      if (showFeaturedOnly && !project.isFeatured) return false;
      if (searchQuery && !project.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (selectedTags.length > 0 && !project.tags.some(tag => selectedTags.includes(tag.name))) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.title.localeCompare(b.title);
        case 'popular':
          return b.viewCount - a.viewCount;
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

  // Get recently viewed projects
  const recentlyViewed = [...projects]
    .filter(p => p.lastViewedAt)
    .sort((a, b) => new Date(b.lastViewedAt!).getTime() - new Date(a.lastViewedAt!).getTime())
    .slice(0, 5);

  return (
    <div className="grid grid-cols-12 gap-6 p-6">
      {/* Main Project List */}
      <div className="col-span-8 space-y-6">
        {/* Search and Filters */}
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as 'name' | 'recent' | 'popular')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="name">Name</option>
          </select>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-6">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTags(prev => 
                prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
              )}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedTags.includes(tag)
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              <TagIcon className="inline-block w-4 h-4 mr-1" />
              {tag}
            </button>
          ))}
        </div>

        {/* Featured Toggle */}
        <button
          onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
          className={`flex items-center px-4 py-2 rounded-lg mb-6 ${
            showFeaturedOnly
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          {showFeaturedOnly ? <StarIconSolid className="w-5 h-5 mr-2" /> : <StarIcon className="w-5 h-5 mr-2" />}
          {showFeaturedOnly ? 'Showing Featured Only' : 'Show Featured Only'}
        </button>

        {/* Projects Grid */}
        <div className="grid grid-cols-2 gap-6">
          <AnimatePresence>
            {filteredProjects.map(project => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    <a href={`/project/${project.slug}`} className="hover:text-blue-600">
                      {project.title}
                    </a>
                  </h3>
                  {project.isFeatured && (
                    <StarIconSolid className="w-5 h-5 text-yellow-400" />
                  )}
                </div>
                {project.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {project.tags.map(tag => (
                    <span
                      key={tag.name}
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                  <span>{project.viewCount} views</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Sidebar */}
      <div className="col-span-4 space-y-6">
        {/* Recently Viewed */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recently Viewed</h3>
          <div className="space-y-3">
            {recentlyViewed.map(project => (
              <a
                key={project.id}
                href={`/project/${project.slug}`}
                className="flex items-center space-x-3 group"
              >
                <BookmarkIcon className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                    {project.title}
                  </h4>
                  <p className="text-xs text-gray-500">
                    Last viewed {new Date(project.lastViewedAt!).toLocaleDateString()}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {activity.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-900">{activity.userName}</span>
                    {' '}
                    {activity.type.replace('_', ' ')}{' '}
                    <a href={`/project/${activity.projectId}`} className="text-blue-600 hover:underline">
                      {activity.projectTitle}
                    </a>
                  </p>
                  <span className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
