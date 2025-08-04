import { NextRequest, NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { BackgroundPreset } from '@/app/lib/models/BackgroundPreset';

// GET - Fetch all background presets
export async function GET(request: Request) {
  try {
    const orgContext = await getOrganizationContext(request);
    if (!orgContext) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    const organizationUUID = orgContext.organizationUUID;

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    const BackgroundPresetModel = connection.model('BackgroundPreset', BackgroundPreset.schema);
    
    const presets = await BackgroundPresetModel.find({}).sort({ isSystem: -1, createdAt: 1 });
    
    return NextResponse.json({
      success: true,
      data: presets
    });
  } catch (error) {
    console.error('Error fetching background presets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch background presets' 
      },
      { status: 500 }
    );
  }
}

// POST - Create a new background preset
export async function POST(request: NextRequest) {
  try {
    const orgContext = await getOrganizationContext(request);
    if (!orgContext) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    const organizationUUID = orgContext.organizationUUID;

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    const BackgroundPresetModel = connection.model('BackgroundPreset', BackgroundPreset.schema);
    
    const body = await request.json();
    const { name, value } = body;
    
    if (!name || !value) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Name and value are required' 
        },
        { status: 400 }
      );
    }
    
    const preset = new BackgroundPresetModel({
      name: name.trim(),
      value: value.trim(),
      isSystem: false
    });
    
    await preset.save();
    
    return NextResponse.json({
      success: true,
      data: preset
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating background preset:', error);
    
    if (error.code === 11000) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'A background preset with this name already exists' 
        },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create background preset' 
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a background preset by name
export async function DELETE(request: NextRequest) {
  try {
    const orgContext = await getOrganizationContext(request);
    if (!orgContext) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    const organizationUUID = orgContext.organizationUUID;

    const connectDb = createOrgDbConnect(organizationUUID);
    const connection = await connectDb();
    const BackgroundPresetModel = connection.model('BackgroundPreset', BackgroundPreset.schema);
    
    const url = new URL(request.url);
    const name = url.searchParams.get('name');
    
    if (!name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Preset name is required' 
        },
        { status: 400 }
      );
    }
    
    const preset = await BackgroundPresetModel.findOneAndDelete({ 
      name,
      isSystem: false // Only allow deletion of custom presets
    });
    
    if (!preset) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Background preset not found or is a system preset' 
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: 'Background preset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting background preset:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete background preset' 
      },
      { status: 500 }
    );
  }
}
