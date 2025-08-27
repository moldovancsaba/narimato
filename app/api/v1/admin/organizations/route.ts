import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

/**
 * Admin API for Organization Management - FIXED VERSION
 * 
 * This endpoint creates organizations with a fresh mongoose connection
 * to avoid namespace caching issues
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
  
  console.log('✅ Fresh connection created');
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
    
    // Optional subdomain
    subdomain: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 63,
      sparse: true // allows multiple null values
    },
    
    // Optional description
    description: {
      type: String,
      maxlength: 1000
    },
    
    // Theme and branding configuration
    theme: {
      primaryColor: {
        type: String,
        default: '#667eea'
      },
      secondaryColor: {
        type: String,
        default: '#764ba2'
      },
      accentColor: {
        type: String,
        default: '#f093fb'
      },
      backgroundColor: {
        type: String,
        default: '#0a0a0a'
      },
      textColor: {
        type: String,
        default: '#ffffff'
      },
      fontFamily: {
        type: String,
        default: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
      },
      fontSize: {
        type: String,
        default: '16px'
      },
      borderRadius: {
        type: String,
        default: '8px'
      },
      spacing: {
        type: String,
        default: '1rem'
      },
      customCSS: {
        type: String,
        maxlength: 10000,
        default: ''
      },
      backgroundCSS: {
        type: String,
        maxlength: 15000,
        default: ''
      },
      googleFontURL: {
        type: String,
        maxlength: 1000,
        default: ''
      },
      emojiList: {
        type: [String],
        default: []
      },
      iconList: {
        type: [String],
        default: []
      }
    },
    
    // Status
    isActive: { 
      type: Boolean, 
      default: true 
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
 * POST /api/v1/admin/organizations
 * Create a new organization with validation
 */
export async function POST(request: NextRequest) {
  let connection: mongoose.Connection | null = null;
  
  try {
    console.log('🔄 Starting organization creation...');
    
    const body = await request.json();
    console.log('📝 Body:', body);
    
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug required' },
        { status: 400 }
      );
    }

    console.log('🔌 Creating fresh database connection...');
    connection = await createFreshConnection();
    
    console.log('📋 Creating organization model...');
    const OrganizationModel = createOrganizationModel(connection);

    const uuid = uuidv4();
    const databaseName = uuid.replace(/-/g, '_'); // PURE UUID WITH UNDERSCORES
    
    console.log('💾 Creating organization document...');
    const newOrg = await OrganizationModel.create({
      uuid: uuid,  // Primary identifier
      displayName: body.name.trim(),  // User-friendly name
      slug: body.slug.toLowerCase().trim(),  // URL-friendly slug
      databaseName: databaseName,  // Technical database name
      description: body.description || '',  // Optional description
      isActive: true
    });
    
    console.log('🎉 Organization created successfully with UUID:', uuid);

    return NextResponse.json({
      success: true,
      message: 'Organization created successfully',
      organization: {
        _id: newOrg._id,  // Frontend expects _id field
        uuid: newOrg.uuid,  // Primary identifier for API responses
        name: newOrg.displayName,  // Frontend expects 'name' field
        slug: newOrg.slug,
        databaseName: newOrg.databaseName,  // Expose for organization editor
        description: newOrg.description,
        isActive: newOrg.isActive,
        createdAt: newOrg.createdAt,
        updatedAt: newOrg.updatedAt
      }
    });
  } catch (error) {
    console.error('❌ Error creating organization:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create organization',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  } finally {
    // Clean up connection
    if (connection) {
      await connection.close();
      console.log('🔌 Connection closed');
    }
  }
}

/**
 * GET /api/v1/admin/organizations
 * List all organizations
 */
export async function GET(request: NextRequest) {
  let connection: mongoose.Connection | null = null;
  
  try {
    console.log('📋 Listing organizations...');
    connection = await createFreshConnection();
    
    const OrganizationModel = createOrganizationModel(connection);
    
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    const query = includeInactive ? {} : { isActive: true };
    const organizations = await OrganizationModel.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    
    return NextResponse.json({
      success: true,
      organizations: organizations.map(org => ({
        _id: org._id,  // Backend compatibility
        OrganizationUUID: org.uuid,  // UUID-first architecture
        OrganizationName: org.displayName,  // UUID-first architecture
        OrganizationSlug: org.slug,  // UUID-first architecture
        OrganizationDescription: org.description,
        databaseName: org.databaseName,  // Include for organization editor
        subdomain: org.subdomain,  // Optional subdomain
        theme: org.theme,  // Include theme data
        isActive: org.isActive,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt
      })),
      total: organizations.length
    });
    
  } catch (error) {
    console.error('❌ Error listing organizations:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list organizations',
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

/**
 * PUT /api/v1/admin/organizations
 * Update organization settings or status
 */
export async function PUT(request: NextRequest) {
  let connection: mongoose.Connection | null = null;
  
  try {
    console.log('🔄 Updating organization...');
    connection = await createFreshConnection();
    
    const OrganizationModel = createOrganizationModel(connection);
    
    const body = await request.json();
    const { organizationUUID, updates } = body;
    
    if (!organizationUUID) {
      return NextResponse.json(
        { success: false, error: 'Organization UUID is required' },
        { status: 400 }
      );
    }
    
    // Find by UUID
    const organization = await OrganizationModel.findOne({ uuid: organizationUUID });
    
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    // Apply updates
    Object.keys(updates).forEach(key => {
      (organization as any)[key] = updates[key];
    });
    
    await organization.save();
    
    return NextResponse.json({
      success: true,
      message: 'Organization updated successfully',
      organization: {
        OrganizationUUID: organization.uuid,
        OrganizationName: organization.displayName,
        OrganizationSlug: organization.slug,
        OrganizationDescription: organization.description,
        databaseName: organization.databaseName,
        subdomain: organization.subdomain,
        theme: organization.theme,
        isActive: organization.isActive,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
      }
    });
    
  } catch (error) {
    console.error('❌ Admin organization update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update organization',
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

/**
 * DELETE /api/v1/admin/organizations
 * Delete or deactivate an organization
 * Use ?permanent=true for hard delete (removes from database)
 * Default behavior is soft delete (deactivate)
 */
export async function DELETE(request: NextRequest) {
  let connection: mongoose.Connection | null = null;
  let orgDbConnection: mongoose.Connection | null = null;
  
  try {
    const { searchParams } = new URL(request.url);
    const organizationUUID = searchParams.get('uuid');
    const isPermanent = searchParams.get('permanent') === 'true';
    
    console.log(`🗑️ ${isPermanent ? 'Permanently deleting' : 'Deactivating'} organization...`);
    
    if (!organizationUUID) {
      return NextResponse.json(
        { success: false, error: 'Organization UUID is required' },
        { status: 400 }
      );
    }
    
    connection = await createFreshConnection();
    const OrganizationModel = createOrganizationModel(connection);
    
    const organization = await OrganizationModel.findOne({ uuid: organizationUUID });
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    
    if (isPermanent) {
      // Hard delete - remove organization and its database
      console.log('💥 Dropping organization database:', organization.databaseName);
      
      try {
        // Connect to the organization's database and drop it
        const orgDbUri = process.env.MONGODB_URI;
        if (orgDbUri) {
          orgDbConnection = mongoose.createConnection(`${orgDbUri}/${organization.databaseName}`);
          await orgDbConnection.dropDatabase();
          console.log('✅ Organization database dropped');
        }
      } catch (dbError) {
        console.warn('⚠️ Could not drop organization database:', dbError);
        // Continue with organization deletion even if DB drop fails
      }
      
      // Remove organization from master database
      await OrganizationModel.deleteOne({ uuid: organizationUUID });
      console.log('✅ Organization permanently deleted');
      
      return NextResponse.json({
        success: true,
        message: 'Organization permanently deleted',
        organizationUUID,
        permanent: true
      });
    } else {
      // Soft delete - deactivate organization
      organization.isActive = false;
      await organization.save();
      
      return NextResponse.json({
        success: true,
        message: 'Organization deactivated successfully',
        organizationUUID,
        permanent: false
      });
    }
    
  } catch (error) {
    console.error('❌ Admin organization delete error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete organization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.close();
      console.log('🔌 Master connection closed');
    }
    if (orgDbConnection) {
      await orgDbConnection.close();
      console.log('🔌 Organization DB connection closed');
    }
  }
}
