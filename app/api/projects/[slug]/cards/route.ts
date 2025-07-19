import { NextResponse } from 'next/server'
import { Card, ICard } from '@/models/Card'
import { Project, IProject } from '@/models/Project'
import { Types } from 'mongoose'
import dbConnect from '@/lib/mongodb'

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    await dbConnect()

    // Find the project
    const project = await Project.findOne({ slug: params.slug })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get all cards for this project
    const cards = await Card.find({
      _id: { $in: project.cards }
    })

    // Map cards to match project order
    let orderedCards = project.cards.map((cardId: Types.ObjectId) => 
      cards.find(card => card._id.toString() === cardId.toString())
    ).filter(Boolean) as ICard[]

    // Apply sorting based on project settings
    if (project.settings?.cardOrder === 'alphabetical') {
      orderedCards = orderedCards.sort((a: ICard, b: ICard) => 
        a.title.localeCompare(b.title)
      )
    } else if (project.settings?.cardOrder === 'popularity') {
      orderedCards = orderedCards.sort((a: ICard, b: ICard) => 
        (b.globalScore || 0) - (a.globalScore || 0)
      )
    }
    // For 'manual' order, cards are already in the correct order

    return NextResponse.json(orderedCards)
  } catch (error) {
    console.error('Error fetching project cards:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project cards' },
      { status: 500 }
    )
  }
}
