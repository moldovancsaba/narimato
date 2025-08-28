import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    // For now, return mock card data
    const card = {
      uuid,
      name: 'Sample Card',
      content: 'Sample content'
    };
    return NextResponse.json({ card });
  } catch (error) {
    console.error('Failed to fetch card:', error);
    return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    const body = await request.json();
    
    // For now, just return the updated card data
    const card = {
      uuid,
      name: body.name,
      content: body.content
    };
    
    return NextResponse.json({ card });
  } catch (error) {
    console.error('Failed to update card:', error);
    return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  try {
    const { uuid } = await params;
    // For now, just return success
    return NextResponse.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Failed to delete card:', error);
    return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
  }
}
