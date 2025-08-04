import { NextResponse } from 'next/server';
import { connectMasterDb } from '@/app/lib/utils/db';

export async function GET() {
  try {
    console.log('=== Database Connection Test ===');
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('MONGODB_URI value:', process.env.MONGODB_URI ? 'Set (length: ' + process.env.MONGODB_URI.length + ')' : 'Not set');
    
    await connectMasterDb();
    
    return NextResponse.json({
      success: true,
      message: 'Master database connection successful',
      envVarExists: !!process.env.MONGODB_URI
    });
  } catch (error) {
    console.error('Database connection error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      envVarExists: !!process.env.MONGODB_URI
    }, { status: 500 });
  }
}
