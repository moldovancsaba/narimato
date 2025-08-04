import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb } from '../../../lib/utils/db';
import { SystemVersion } from '../../../lib/models/SystemVersion';
import packageJson from '../../../../package.json';

const version = packageJson.version;

/**
 * System Version API Endpoint
 * 
 * This endpoint manages system version tracking and provides version information
 * for the NARIMATO application. It automatically initializes version records
 * when the application starts and provides current version data.
 */

// GET /api/system/version - Get current system version
export async function GET(request: NextRequest) {
  try {
    await connectMasterDb();

    const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    const currentVersion = await SystemVersion.getCurrentVersion(environment);

    if (!currentVersion) {
      // Initialize version record if none exists
      const initialVersion = await SystemVersion.recordVersionDeployment({
        applicationVersion: version,
        databaseVersion: version,
        environment,
        releaseNotes: 'System initialization - version tracking started',
        hasBreakingChanges: false,
        metadata: {
          nodeVersion: process.version,
          nextVersion: '15.4.4',
          mongooseVersion: '8.1.0',
          deploymentId: `narimato-init-${Date.now()}`
        }
      });

      return NextResponse.json({
        success: true,
        data: {
          version: initialVersion,
          initialized: true,
          message: 'Version tracking initialized'
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        version: currentVersion,
        initialized: false,
        message: 'Current version retrieved'
      }
    });

  } catch (error) {
    console.error('System version API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve system version',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}

// POST /api/system/version - Record new version deployment
export async function POST(request: NextRequest) {
  try {
    await connectMasterDb();

    const body = await request.json();
    
    // Validate required fields
    const { applicationVersion, databaseVersion, environment = 'development' } = body;
    
    if (!applicationVersion || !databaseVersion) {
      return NextResponse.json({
        success: false,
        error: 'applicationVersion and databaseVersion are required'
      }, { status: 400 });
    }

    // Validate version format (semantic versioning)
    const versionRegex = /^\d+\.\d+\.\d+$/;
    if (!versionRegex.test(applicationVersion) || !versionRegex.test(databaseVersion)) {
      return NextResponse.json({
        success: false,
        error: 'Version must follow semantic versioning format (MAJOR.MINOR.PATCH)'
      }, { status: 400 });
    }

    // Record the new version
    const versionRecord = await SystemVersion.recordVersionDeployment({
      applicationVersion,
      databaseVersion,
      environment,
      releaseNotes: body.releaseNotes || `Version ${applicationVersion} deployment`,
      hasBreakingChanges: body.hasBreakingChanges || false,
      previousVersion: body.previousVersion,
      metadata: {
        nodeVersion: process.version,
        nextVersion: '15.4.4',
        mongooseVersion: '8.1.0',
        deploymentId: body.deploymentId || `narimato-${applicationVersion}-${Date.now()}`,
        ...body.metadata
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        version: versionRecord,
        message: `Version ${applicationVersion} recorded successfully`
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Version deployment recording error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to record version deployment',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}

// PUT /api/system/version/migration - Update migration status
export async function PUT(request: NextRequest) {
  try {
    await connectMasterDb();

    const body = await request.json();
    const { applicationVersion, environment = 'development', status } = body;

    if (!applicationVersion || !status) {
      return NextResponse.json({
        success: false,
        error: 'applicationVersion and status are required'
      }, { status: 400 });
    }

    const validStatuses = ['pending', 'in-progress', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({
        success: false,
        error: `Status must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 });
    }

    const updatedVersion = await SystemVersion.updateMigrationStatus(
      applicationVersion,
      environment,
      status
    );

    if (!updatedVersion) {
      return NextResponse.json({
        success: false,
        error: 'Version record not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        version: updatedVersion,
        message: `Migration status updated to ${status}`
      }
    });

  } catch (error) {
    console.error('Migration status update error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to update migration status',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    }, { status: 500 });
  }
}
