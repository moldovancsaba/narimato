import { NextRequest, NextResponse } from 'next/server';
import { createOrgAwareRoute } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { Card } from '@/app/lib/models/Card';

export const GET = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const uuid = request.nextUrl.pathname.split('/').pop();
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }

    // Create organization-specific database connection
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    const CardModel = connection.model('Card', Card.schema);

    const card = await CardModel.findOne({ uuid });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, card });
  } catch (error) {
    console.error('Failed to fetch card:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch card' },
      { status: 500 }
    );
  }
});

export const PATCH = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const uuid = request.nextUrl.pathname.split('/').pop();
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }
    const body = await request.json();

    // Create organization-specific database connection
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    const CardModel = connection.model('Card', Card.schema);

    const card = await CardModel.findOne({ uuid });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    const updatedCard = await CardModel.findOneAndUpdate(
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
});

export const DELETE = createOrgAwareRoute(async (request, { organizationUUID }) => {
  try {
    const uuid = request.nextUrl.pathname.split('/').pop();
    if (!uuid) {
      return NextResponse.json(
        { error: 'UUID is required' },
        { status: 400 }
      );
    }

    // Create organization-specific database connection
    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    const CardModel = connection.model('Card', Card.schema);

    const card = await CardModel.findOne({ uuid });

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    await CardModel.findOneAndDelete({ uuid });

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
});
