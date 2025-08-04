import { NextResponse } from 'next/server';
import { getOrganizationContext } from '@/app/lib/middleware/organization';
import { createOrgDbConnect } from '@/app/lib/utils/db';
import { FontPreset } from '@/app/lib/models/FontPreset';
import { BackgroundPreset } from '@/app/lib/models/BackgroundPreset';

/**
 * Migration endpoint to fix isSystem flags for font and background presets
 * This ensures that user-created presets can be deleted while system presets are protected
 */
export async function POST(request: Request) {
  try {
    // Get organization context
    const orgContext = await getOrganizationContext(request);
    const organizationId = orgContext?.organizationId || 'default';

    const connectDb = createOrgDbConnect(organizationId);
    const connection = await connectDb();
    
    // Register connection-specific models
    const FontPresetModel = connection.model('FontPreset', FontPreset.schema);
    const BackgroundPresetModel = connection.model('BackgroundPreset', BackgroundPreset.schema);
    
    // Define system font names that should be protected
    const systemFontNames = [
      'Arial',
      'Courier New', 
      'Georgia',
      'Impact',
      'Times New Roman',
      'Itim'
    ];
    
    // Define system background names that should be protected
    const systemBackgroundNames = [
      'Default Gradient',
      'Sunset',
      'Ocean', 
      'Forest',
      'Solid Purple',
      'Solid Black'
    ];
    
    const migrationResults = [];
    
    // Migrate font presets
    try {
      // Mark all fonts as user-created first (isSystem: false)
      const allFonts = await FontPresetModel.find({});
      
      for (const font of allFonts) {
        let shouldBeSystem = systemFontNames.includes(font.name);
        
        // Only update if the current isSystem flag is incorrect
        if (font.isSystem !== shouldBeSystem) {
          await FontPresetModel.findByIdAndUpdate(font._id, { 
            isSystem: shouldBeSystem,
            updatedAt: new Date()
          });
          
          migrationResults.push(
            `Updated font "${font.name}": isSystem changed to ${shouldBeSystem}`
          );
        } else {
          migrationResults.push(
            `Font "${font.name}": isSystem flag already correct (${shouldBeSystem})`
          );
        }
      }
    } catch (error) {
      migrationResults.push(`Error migrating fonts: ${error}`);
    }
    
    // Migrate background presets
    try {
      const allBackgrounds = await BackgroundPresetModel.find({});
      
      for (const bg of allBackgrounds) {
        let shouldBeSystem = systemBackgroundNames.includes(bg.name);
        
        // Only update if the current isSystem flag is incorrect
        if (bg.isSystem !== shouldBeSystem) {
          await BackgroundPresetModel.findByIdAndUpdate(bg._id, { 
            isSystem: shouldBeSystem,
            updatedAt: new Date()
          });
          
          migrationResults.push(
            `Updated background "${bg.name}": isSystem changed to ${shouldBeSystem}`
          );
        } else {
          migrationResults.push(
            `Background "${bg.name}": isSystem flag already correct (${shouldBeSystem})`
          );
        }
      }
    } catch (error) {
      migrationResults.push(`Error migrating backgrounds: ${error}`);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Preset migration completed successfully',
      results: migrationResults
    });
    
  } catch (error) {
    console.error('Error during preset migration:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to migrate presets',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
