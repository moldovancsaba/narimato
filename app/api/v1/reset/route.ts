import { NextResponse } from 'next/server';
import dbConnect from '../../../lib/utils/db';
import { Card } from '../../../lib/models/Card';
import { Session } from '../../../lib/models/Session';
import { PersonalRanking } from '../../../lib/models/PersonalRanking';

export async function POST() {
  try {
    await dbConnect();
    
    // Delete all documents from all collections
    await Promise.all([
      Card.deleteMany({}),
      Session.deleteMany({}),
      PersonalRanking.deleteMany({})
    ]);

    return NextResponse.json({ message: 'Database reset successful' });
  } catch (error) {
    console.error('Failed to reset database:', error);
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}
