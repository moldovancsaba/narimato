import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb, checkOrgDbHealth } from '@/app/lib/utils/db';
import Organization from '@/app/lib/models/Organization';

/**
 * Admin API for Organization Management
 * 
 * SECURITY WARNING: This endpoint provides administrative access to all organizations.
 * It should be protected with proper authentication and authorization.
 * 
 * GET: List all organizations with status information
 * POST: Create new organization (alternative to provision endpoint)
 * PUT: Update organization settings
 * DELETE: Deactivate organization
 */

/**
 * GET /api/v1/admin/organizations
 * List all organizations with health status
 */
export async function GET(request: NextRequest) {
  try {
    await connectMasterDb();
    
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    // Build query
    const query = includeInactive ? {} : { isActive: true };
    
    const organizations = await Organization.find(query)
      .sort({ createdAt: -1 })
      .select('name slug subdomain databaseName isActive createdAt settings');
    
    // Check database health for each organization
    const organizationsWithStatus = await Promise.all(
      organizations.map(async (org) => {
        const health = await checkOrgDbHealth(org.slug);
        return {
          ...org.toObject(),
          databaseHealth: health,
          lastChecked: new Date().toISOString()
        };
      })
    );
    
    return NextResponse.json({
      success: true,
      organizations: organizationsWithStatus,
      total: organizationsWithStatus.length
    });
    
  } catch (error) {
    console.error('Admin organizations list error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list organizations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/admin/organizations
 * Update organization settings or status
 */
export async function PUT(request: NextRequest) {
  try {
    await connectMasterDb();
    
    const body = await request.json();
    const { organizationId, updates } = body;
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }
    
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      if (key in organization.schema.paths) {
        (organization as any)[key] = updates[key];
      }
    });
    
    await organization.save();
    
    return NextResponse.json({
      success: true,
      message: 'Organization updated successfully',
      organization: organization.toObject()
    });
    
  } catch (error) {
    console.error('Admin organization update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update organization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/admin/organizations
 * Deactivate an organization (soft delete)
 */
export async function DELETE(request: NextRequest) {
  try {
    await connectMasterDb();
    
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('id');
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }
    
    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Soft delete - deactivate organization
    organization.isActive = false;
    await organization.save();
    
    return NextResponse.json({
      success: true,
      message: 'Organization deactivated successfully',
      organizationId
    });
    
  } catch (error) {
    console.error('Admin organization delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to deactivate organization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
