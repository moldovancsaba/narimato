import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';

export async function PATCH(request: NextRequest) {
  try {
    const uuid = request.nextUrl.pathname.split('/').pop();
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }
    const body = await request.json();

    await dbConnect();

    const card = await Card.findOne({ uuid });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    const updatedCard = await Card.findOneAndUpdate(
      { uuid },
      { 
        ...body,
        updatedAt: new Date()
      },
      { new: true }
    );

    return NextResponse.json({ success: true, card: updatedCard });
  } catch (error) {
    console.error('Failed to update card:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update card' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const uuid = request.nextUrl.pathname.split('/').pop();
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }

    await dbConnect();

    const card = await Card.findOne({ uuid });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    await Card.findOneAndDelete({ uuid });

    return NextResponse.json({ 
      success: true, 
      message: 'Card deleted successfully',
      deletedCardId: uuid
    });
  } catch (error) {
    console.error('Failed to delete card:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete card' },
      { status: 500 }
    );
  }
}
