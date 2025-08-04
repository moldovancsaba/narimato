import { NextRequest, NextResponse } from 'next/server';
import { connectMasterDb, buildOrgMongoUri, createOrgDbConnect } from '@/app/lib/utils/db';
import Organization from '@/app/lib/models/Organization';
import mongoose from 'mongoose';
import { Card } from '@/app/lib/models/Card';
import { Play } from '@/app/lib/models/Play';
import { GlobalRanking } from '@/app/lib/models/GlobalRanking';

/**
 * Initialize organization database with required collections and indexes
 */
async function initializeOrgDatabase(mongooseInstance: typeof mongoose, organizationSlug: string): Promise<void> {
  try {
    // Ensure all models are compiled with the organization-specific connection
    const db = mongooseInstance.connection.db;
    
    // Create collections with proper indexes
    const collections = [
      {
        name: 'cards',
        indexes: [
          { name: 1, unique: true },
          { uuid: 1, unique: true },
          { hashtags: 1 },
          { isActive: 1 },
          { createdAt: -1 }
        ]
      },
      {
        name: 'plays',
        indexes: [
          { playUuid: 1, unique: true },
          { sessionId: 1 },
          { status: 1 },
          { createdAt: -1 },
          { expiresAt: 1 }
        ]
      },
      {
        name: 'globalrankings',
        indexes: [
          { cardId: 1, unique: true },
          { eloRating: -1 },
          { lastUpdated: -1 }
        ]
      }
    ];
    
    for (const collection of collections) {
      console.log(`📊 Creating collection: ${collection.name}`);
      
      // Create collection if it doesn't exist
      const collectionExists = await db.listCollections({ name: collection.name }).hasNext();
      if (!collectionExists) {
        await db.createCollection(collection.name);
      }
      
      // Create indexes
      const coll = db.collection(collection.name);
      for (const index of collection.indexes) {
        await coll.createIndex(index);
      }
    }
    
    console.log(`✅ Database initialization complete for organization: ${organizationSlug}`);
    
  } catch (error) {
    console.error(`❌ Failed to initialize database for organization ${organizationSlug}:`, error);
    throw error;
  }
}

/**
 * POST /api/v1/organization/provision
 * Provision a new organization within the system
 *
 * This endpoint will:
 * - Validate uniqueness of the organization name and slug
 * - Create an entry in the Organization master database
 * - Generate the MongoDB URI for the organization
 * - Initialize the organization's database structure with necessary collections
 *
 * Security Considerations:
 * - Only authenticated administrators should have access to this endpoint
 */

export async function POST(request: NextRequest) {
  try {
    await connectMasterDb();

    const body = await request.json();
    const { name, slug, subdomain, settings } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug are required fields' },
        { status: 400 }
      );
    }

    // Check for existing organization
    const existingOrg = await Organization.findOne({
      $or: [{ name }, { slug }]
    });

    if (existingOrg) {
      return NextResponse.json(
        { success: false, error: 'Organization with this name or slug already exists' },
        { status: 409 }
      );
    }

    const databaseName = `narimato_org_${slug}`;
    const newOrg = new Organization({
      name,
      slug,
      subdomain,
      settings,
      databaseName
    });
    await newOrg.save();

    // Initialize organization-specific database
    const orgConnect = createOrgDbConnect(slug);
    const mongooseInstance = await orgConnect();

    // Initialize collections with schemas and indexes
    await initializeOrgDatabase(mongooseInstance, slug);

    console.log(`✅ Initialized org database for ${name}`, {
      organizationId: newOrg._id,
      slug,
      databaseName
    });

    return NextResponse.json(
      { success: true, message: 'Organization provisioned successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Organization provisioning error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to provision organization', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
