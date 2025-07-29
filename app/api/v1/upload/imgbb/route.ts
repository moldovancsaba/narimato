import { NextRequest, NextResponse } from 'next/server';
import { uploadPngToImgBBWithRetry } from '../../../../lib/services/imgbbService';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const filename = formData.get('filename') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Convert file to blob
    const blob = new Blob([await file.arrayBuffer()], { type: file.type });

    // Upload to ImgBB
    const imageUrl = await uploadPngToImgBBWithRetry(blob, filename || undefined);

    return NextResponse.json({ 
      success: true, 
      imageUrl 
    });

  } catch (error) {
    console.error('ImgBB upload error:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Upload failed',
        success: false 
      },
      { status: 500 }
    );
  }
}
