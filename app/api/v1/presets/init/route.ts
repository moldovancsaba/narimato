import { NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { FontPreset } from '@/app/lib/models/FontPreset';
import { BackgroundPreset } from '@/app/lib/models/BackgroundPreset';

// POST - Initialize system presets
export async function POST(request: Request) {
  try {
    // Extract organization context
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

    // Use connection-specific models
    const FontPresetModel = connection.model('FontPreset', FontPreset.schema);
    const BackgroundPresetModel = connection.model('BackgroundPreset', BackgroundPreset.schema);
    
    // Default font presets
    const defaultFontPresets = [
      { name: 'Arial', value: 'Arial, sans-serif', url: '', isSystem: true },
      { name: 'Courier New', value: 'Courier New, monospace', url: '', isSystem: true },
      { name: 'Georgia', value: 'Georgia, serif', url: '', isSystem: true },
      { name: 'Impact', value: 'Impact, sans-serif', url: '', isSystem: true },
      { name: 'Times New Roman', value: 'Times New Roman, serif', url: '', isSystem: true },
      { name: 'Itim', value: 'Itim, cursive', url: 'https://fonts.googleapis.com/css2?family=Itim&display=swap', isSystem: true },
    ];
    
    // Default background presets
    const defaultBackgroundPresets = [
      { name: 'Default Gradient', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', isSystem: true },
      { name: 'Sunset', value: 'linear-gradient(135deg, #ff6b6b 0%, #ffd93d 100%)', isSystem: true },
      { name: 'Ocean', value: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)', isSystem: true },
      { name: 'Forest', value: 'linear-gradient(135deg, #00b894 0%, #00a085 100%)', isSystem: true },
      { name: 'Solid Purple', value: '#6c5ce7', isSystem: true },
      { name: 'Solid Black', value: '#2d3436', isSystem: true },
    ];
    
    // Initialize font presets
    const fontResults = [];
    for (const preset of defaultFontPresets) {
      try {
        const existingFont = await FontPresetModel.findOne({ name: preset.name });
        if (!existingFont) {
          const newFont = new FontPresetModel(preset);
          await newFont.save();
          fontResults.push(`Created font preset: ${preset.name}`);
        } else {
          fontResults.push(`Font preset already exists: ${preset.name}`);
        }
      } catch (error) {
        fontResults.push(`Error creating font preset ${preset.name}: ${error}`);
      }
    }
    
    // Initialize background presets
    const backgroundResults = [];
    for (const preset of defaultBackgroundPresets) {
      try {
        const existingBackground = await BackgroundPresetModel.findOne({ name: preset.name });
        if (!existingBackground) {
          const newBackground = new BackgroundPresetModel(preset);
          await newBackground.save();
          backgroundResults.push(`Created background preset: ${preset.name}`);
        } else {
          backgroundResults.push(`Background preset already exists: ${preset.name}`);
        }
      } catch (error) {
        backgroundResults.push(`Error creating background preset ${preset.name}: ${error}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'System presets initialization completed',
      results: {
        fonts: fontResults,
        backgrounds: backgroundResults
      }
    });
    
  } catch (error) {
    console.error('Error initializing system presets:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize system presets' 
      },
      { status: 500 }
    );
  }
}
