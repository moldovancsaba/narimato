import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { connectMasterDb } from '@/app/lib/utils/db';
import Organization from '@/app/lib/models/Organization';

export async function GET(request: NextRequest) {
  try {
    console.log('Debug: Testing organization context...');
    
    // Test master database connection
    await connectMasterDb();
    console.log('Debug: Master DB connected');
    
    // Test organization lookup
    const orgs = await Organization.find({});
    console.log('Debug: Found organizations:', orgs.map(o => ({ slug: o.slug, name: o.name, isActive: o.isActive })));
    
    // Test organization context
    const orgContext = await getOrganizationContext(request);
    console.log('Debug: Organization context:', orgContext);
    
    return NextResponse.json({
      success: true,
      data: {
        url: request.url,
        organizations: orgs.map(o => ({ slug: o.slug, name: o.name, isActive: o.isActive })),
        orgContext: orgContext,
        message: 'Debug info retrieved'
      }
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
