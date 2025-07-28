import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/lib/utils/db';
import { Session } from '@/app/lib/models/Session';
import { Card } from '@/app/lib/models/Card';

export async function GET(request: NextRequest) {
  try {
const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('sessionId');
    const cardId = searchParams.get('cardId');

    if (!sessionId || !cardId) {
      return new NextResponse(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400 }
      );
    }

    await dbConnect();

    // Find session and validate
    const session = await Session.findOne({ sessionId, status: 'active' });
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Session not found or inactive' }),
        { status: 404 }
      );
    }

    // If no ranked cards yet, this is the first card to be ranked
    if (session.personalRanking.length === 0) {
      // For the first card, return it as both A and B to show in UI
      const card = await Card.findOne({ uuid: cardId });
      if (!card) {
        return new NextResponse(
          JSON.stringify({ error: 'Card not found' }),
          { status: 404 }
        );
      }

      return new NextResponse(
        JSON.stringify({
          cardA: {
            uuid: card.uuid,
            type: card.type,
            content: card.content,
            title: card.title
          },
          cardB: {
            uuid: card.uuid,
            type: card.type,
            content: card.content,
            title: card.title
          },
          isFirstRanking: true
        }),
        { status: 200 }
      );
    }

    // For regular comparisons, compare with the lowest ranked card
    const compareCardId = session.personalRanking[session.personalRanking.length - 1];

    // Get both cards and verify they exist
    const [newCard, compareCard] = await Promise.all([
      Card.findOne({ uuid: cardId }),
      Card.findOne({ uuid: compareCardId })
    ]);

    if (!newCard) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Card not found',
          details: { cardId, message: 'The card to be ranked could not be found' }
        }),
        { status: 404 }
      );
    }

    if (!compareCard) {
      return new NextResponse(
        JSON.stringify({ 
          error: 'Comparison card not found',
          details: { 
            compareAgainstId: compareCardId,
            message: 'The card to compare against could not be found'
          }
        }),
        { status: 404 }
      );
    }

    return new NextResponse(
      JSON.stringify({
        cardA: {
          uuid: newCard.uuid,
          type: newCard.type,
          content: newCard.content,
          title: newCard.title
        },
        cardB: {
          uuid: compareCard.uuid,
          type: compareCard.type,
          content: compareCard.content,
          title: compareCard.title
        }
      }),
      { status: 200 }
    );
  } catch (error) {
    console.error('Vote comparison error:', error);
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
