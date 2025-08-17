import { NextRequest, NextResponse } from 'next/server';
import { getConnectionStats, checkOrgDbHealth, cleanupStaleConnections } from '@/app/lib/utils/db';

/**
 * Database Health Monitoring API Endpoint
 * 
 * FUNCTIONAL PURPOSE:
 * - Provides real-time database connection health status
 * - Monitors connection pool statistics and performance
 * - Enables proactive monitoring of mongoose timeout issues
 * 
 * STRATEGIC PURPOSE:
 * - Early detection of connection problems before they affect users
 * - Performance monitoring for database operations
 * - Automated health checks for production monitoring systems
 * 
 * Endpoints:
 * GET /api/health/db - Get connection health status
 * POST /api/health/db - Perform cleanup and health check
 */

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Get current connection statistics
    const connectionStats = getConnectionStats();
    
    // Test health of key connections
    const healthChecks = await Promise.allSettled([
      checkOrgDbHealth('master'),
      checkOrgDbHealth('default')
    ]);
    
    const masterHealthy = healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : false;
    const defaultHealthy = healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : false;
    
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Determine overall health status
    const overallHealth = masterHealthy && defaultHealthy ? 'healthy' : 'degraded';
    
    const healthReport = {
      status: overallHealth,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      database: {
        master: {
          healthy: masterHealthy,
          status: masterHealthy ? 'connected' : 'disconnected'
        },
        default: {
          healthy: defaultHealthy,
          status: defaultHealthy ? 'connected' : 'disconnected'
        }
      },
      connections: connectionStats,
      system: {
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          external: Math.round(process.memoryUsage().external / 1024 / 1024)
        }
      }
    };

    // Set appropriate HTTP status based on health
    const httpStatus = overallHealth === 'healthy' ? 200 : 503;
    
    return NextResponse.json(healthReport, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Database health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Health check failed',
        details: (error as Error).message
      }
    }, { 
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Parse request body for specific actions
    const body = await request.json().catch(() => ({}));
    const { action } = body;
    
    let result: any = {
      timestamp: new Date().toISOString(),
      actions: []
    };
    
    // Perform cleanup if requested
    if (action === 'cleanup' || action === 'all') {
      console.log('🧹 Performing database connection cleanup...');
      await cleanupStaleConnections();
      result.actions.push('cleanup_completed');
    }
    
    // Get fresh connection statistics after any cleanup
    const connectionStats = getConnectionStats();
    
    // Perform comprehensive health checks
    const healthChecks = await Promise.allSettled([
      checkOrgDbHealth('master'),
      checkOrgDbHealth('default')
    ]);
    
    const masterHealthy = healthChecks[0].status === 'fulfilled' ? healthChecks[0].value : false;
    const defaultHealthy = healthChecks[1].status === 'fulfilled' ? healthChecks[1].value : false;
    
    const responseTime = Date.now() - startTime;
    const overallHealth = masterHealthy && defaultHealthy ? 'healthy' : 'degraded';
    
    result = {
      ...result,
      status: overallHealth,
      responseTime: `${responseTime}ms`,
      database: {
        master: {
          healthy: masterHealthy,
          status: masterHealthy ? 'connected' : 'disconnected'
        },
        default: {
          healthy: defaultHealthy,
          status: defaultHealthy ? 'connected' : 'disconnected'
        }
      },
      connections: connectionStats
    };
    
    const httpStatus = overallHealth === 'healthy' ? 200 : 503;
    
    return NextResponse.json(result, { 
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Database health check POST failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: {
        message: 'Health check operation failed',
        details: (error as Error).message
      }
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
