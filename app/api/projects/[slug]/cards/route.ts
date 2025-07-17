import { NextRequest, NextResponse } from 'next/server';
import { ProjectService } from '@/lib/services/projectService';

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { cardId } = await request.json();
    
    if (!cardId) {
      return NextResponse.json(
        { message: 'Card ID is required' },
        { status: 400 }
      );
    }
    
    const project = await ProjectService.addCardToProject(params.slug, cardId);
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error in POST /api/projects/[slug]/cards:', error);
    return NextResponse.json(
      { message: 'Failed to add card to project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { cardId } = await request.json();
    
    if (!cardId) {
      return NextResponse.json(
        { message: 'Card ID is required' },
        { status: 400 }
      );
    }
    
    const project = await ProjectService.removeCardFromProject(params.slug, cardId);
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error in DELETE /api/projects/[slug]/cards:', error);
    return NextResponse.json(
      { message: 'Failed to remove card from project' },
      { status: 500 }
    );
  }
}
