import { getProjectUrl } from '@/app/middleware'
import { Card, ICard } from '@/models/Card'
import { Project } from '@/models/Project'
import dbConnect from '@/lib/mongodb'
import { notFound } from 'next/navigation'

interface CardInput {
  type: 'text' | 'image'
  title: string
  content: string
  slug: string
  imageAlt?: string
  description?: string
  hashtags?: string[]
  globalScore?: number
  createdAt?: string | Date
  updatedAt?: string | Date
  likes?: number
  dislikes?: number
}

export default async function ProjectDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  try {
    await dbConnect()

    // Fetch project details
    const project = await Project.findOne({ slug: params.slug })
    if (!project) {
      notFound()
    }

    // Fetch cards for the project
    const cards = await Card.find({ _id: { $in: project.cards || [] } }).lean() as ICard[]
    const cardInputs: CardInput[] = cards.map(card => ({
      type: card.type,
      title: card.title,
      content: card.content,
      slug: card.slug,
      imageAlt: card.imageAlt,
      description: card.description,
      hashtags: card.hashtags,
      globalScore: card.globalScore,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      likes: card.likes,
      dislikes: card.dislikes,
    }))

    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-3xl font-bold mb-6">{project.title}</h1>
        {project.description && (
          <p className="text-gray-600 mb-8">{project.description}</p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cardInputs.map(card => (
            <div key={card.slug} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <h2 className="text-xl font-semibold mb-2">{card.title}</h2>
              {card.description && (
                <p className="text-gray-600 mb-4">{card.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mb-4">
                {card.hashtags?.map(tag => (
                  <span key={tag} className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error fetching project details:', error)
    throw error
  }
}
