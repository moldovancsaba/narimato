import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

/**
 * Default Organization API
 * 
 * This endpoint ensures there's always a default organization available
 * for the main page to redirect to, avoiding listing errors.
 */

// Create a completely new connection instance
async function createFreshConnection() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not found');
  
  // Create a new connection instance
  const connection = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    maxPoolSize: 5,
  });
  
  console.log('✅ Fresh connection created for default org');
  return connection;
}

// Define schema within the connection - UUID-first architecture
function createOrganizationModel(connection: mongoose.Connection) {
  const organizationSchema = new mongoose.Schema({
    // Primary identifier - immutable UUID
    uuid: { 
      type: String, 
      required: true, 
      unique: true,
      index: true
    },
    
    // Display properties - can be changed
    displayName: { 
      type: String, 
      required: true,
      trim: true,
      maxlength: 255
    },
    
    // URL-friendly version of display name - can be regenerated
    slug: { 
      type: String, 
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 255,
      index: true
    },
    
    // Technical properties
    databaseName: { 
      type: String, 
      required: true,
      unique: true
    },
    
    // Optional description
    description: {
      type: String,
      maxlength: 1000
    },
    
    // Status
    isActive: { 
      type: Boolean, 
      default: true 
    },
    
    // Default flag
    isDefault: {
      type: Boolean,
      default: false
    },
    
    // Timestamps
    createdAt: { 
      type: Date, 
      default: Date.now 
    },
    updatedAt: { 
      type: Date, 
      default: Date.now 
    }
  });
  
  // Add pre-save middleware to update updatedAt
  organizationSchema.pre('save', function() {
    this.updatedAt = new Date();
  });
  
  return connection.model('Organization', organizationSchema);
}

/**
 * GET /api/v1/organizations/default
 * Get or create the default organization
 */
export async function GET(request: NextRequest) {
  let connection: mongoose.Connection | null = null;
  
  try {
    console.log('🏠 Getting or creating default organization...');
    connection = await createFreshConnection();
    
    const OrganizationModel = createOrganizationModel(connection);
    
    // First, try to find an existing default organization
    let defaultOrg = await OrganizationModel.findOne({ 
      slug: 'default-org',
      isActive: true 
    });
    
    if (!defaultOrg) {
      console.log('🆕 No default organization found, creating one...');
      
      const uuid = uuidv4();
      const databaseName = `narimato_org_${uuid.replace(/-/g, '_')}`;
      
      defaultOrg = await OrganizationModel.create({
        uuid: uuid,
        displayName: 'Default Organization',
        slug: 'default-org',
        databaseName: databaseName,
        description: 'This is the default organization for Narimato.',
        isActive: true,
        isDefault: true
      });
      
      console.log('🎉 Default organization created with UUID:', uuid);
    }
    
    return NextResponse.json({
      success: true,
      organization: {
        uuid: defaultOrg.uuid,
        displayName: defaultOrg.displayName,
        slug: defaultOrg.slug,
        description: defaultOrg.description,
        isActive: defaultOrg.isActive,
        isDefault: defaultOrg.isDefault || false,
        createdAt: defaultOrg.createdAt,
        updatedAt: defaultOrg.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Error getting/creating default organization:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get default organization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.close();
      console.log('🔌 Connection closed');
    }
  }
}
