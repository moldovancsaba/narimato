import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // For now, return mock ranking data
    const cards = [
      { uuid: '1', name: 'Top Card', content: 'Best performing card', score: 100 },
      { uuid: '2', name: 'Second Card', content: 'Second best card', score: 85 },
      { uuid: '3', name: 'Third Card', content: 'Third place card', score: 70 },
    ];
    
    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Ranking retrieval error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
