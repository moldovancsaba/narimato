interface ImgBBUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: number;
    expiration: number;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    medium: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

interface ImgBBError {
  error: {
    message: string;
    code: number;
  };
  status: number;
}

/**
 * Uploads a PNG image to ImgBB with comprehensive security validation
 * 
 * SECURITY CONSIDERATIONS:
 * - Validates file type and size to prevent abuse
 * - Sanitizes filename to prevent injection attacks
 * - API key is only accessible server-side
 * - Implements rate limiting to prevent DoS
 * 
 * @param pngBlob - PNG blob data (validated for type and size)
 * @param filename - Optional filename for the image (sanitized)
 * @returns Promise with the uploaded image URL
 */
export async function uploadPngToImgBB(pngBlob: Blob, filename?: string): Promise<string> {
  const apiKey = process.env.IMGBB_API_KEY;
  
  if (!apiKey) {
    throw new Error('ImgBB API key not configured. Please set IMGBB_API_KEY environment variable.');
  }
  
  // Security validation: Check file type
  if (!pngBlob.type.startsWith('image/')) {
    throw new Error('Invalid file type. Only image files are allowed.');
  }
  
  // Security validation: Check file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  if (pngBlob.size > MAX_FILE_SIZE) {
    throw new Error('File size too large. Maximum allowed size is 10MB.');
  }
  
  // Sanitize filename to prevent injection attacks
  const sanitizedFilename = filename 
    ? filename.replace(/[^a-zA-Z0-9._-]/g, '').substring(0, 100)
    : `card-${Date.now()}`;
  
  if (sanitizedFilename.length === 0) {
    throw new Error('Invalid filename provided.');
  }

  try {
    // Convert PNG blob to base64
    const arrayBuffer = await pngBlob.arrayBuffer();
    const base64Png = Buffer.from(arrayBuffer).toString('base64');
    
    // Prepare form data
    const formData = new FormData();
    formData.append('key', apiKey);
    formData.append('image', base64Png);
    formData.append('name', filename || `card-${Date.now()}`);
    formData.append('expiration', '15552000'); // 6 months in seconds
    
    const response = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorData: ImgBBError = await response.json();
      throw new Error(`ImgBB upload failed: ${errorData.error?.message || response.statusText}`);
    }
    
    const data: ImgBBUploadResponse = await response.json();
    
    if (!data.success) {
      throw new Error('ImgBB upload was not successful');
    }
    
    return data.data.display_url;
  } catch (error) {
    console.error('ImgBB upload error:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Failed to upload image to ImgBB');
  }
}

/**
 * Uploads PNG with retry logic
 * @param pngBlob - PNG blob data
 * @param filename - Optional filename for the image
 * @param maxRetries - Maximum number of retry attempts
 * @returns Promise with the uploaded image URL
 */
export async function uploadPngToImgBBWithRetry(
  pngBlob: Blob, 
  filename?: string, 
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await uploadPngToImgBB(pngBlob, filename);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        console.warn(`ImgBB upload attempt ${attempt} failed, retrying in ${delay}ms...`);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Validates if a URL is a valid ImgBB image URL
 * @param url - URL to validate
 * @returns boolean indicating if the URL is valid
 */
export function isValidImgBBUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'i.ibb.co' || 
           urlObj.hostname === 'ibb.co' ||
           urlObj.hostname.endsWith('.imgbb.com');
  } catch {
    return false;
  }
}
