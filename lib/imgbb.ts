/**
 * ImgBB Upload Utility
 * Handles image uploads to ImgBB service with type safety and error handling
 */

interface ImgBBResponse {
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
    delete_url: string;
  };
  success: boolean;
  status: number;
}

export class ImgBBUploader {
  private apiKey: string;
  private endpoint = 'https://api.imgbb.com/1/upload';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('ImgBB API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Validates file before upload
   * - Checks file type (JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF)
   * - Ensures file size is under 32MB
   */
  private validateFile(file: File): void {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/tiff',
      'image/webp',
      'image/heic',
      'image/avif',
      'application/pdf'
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Supported types: JPG, PNG, GIF, TIF, WEBP, HEIC, AVIF, PDF');
    }

    // 32MB in bytes
    const maxSize = 32 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('File size must be under 32MB');
    }
  }

  /**
   * Uploads a file to ImgBB
   * Returns the URL of the uploaded image
   */
  async upload(file: File): Promise<{ url: string; deleteUrl: string }> {
    try {
      this.validateFile(file);

      const formData = new FormData();
      formData.append('image', file);
      formData.append('key', this.apiKey);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ImgBB API error: ${response.statusText}`);
      }

      const data = await response.json() as ImgBBResponse;

      if (!data.success) {
        throw new Error('Image upload failed');
      }

      return {
        url: data.data.url,
        deleteUrl: data.data.delete_url,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Image upload failed: ${error.message}`);
      }
      throw new Error('Image upload failed: Unknown error');
    }
  }

  /**
   * Creates a preview URL for a local file
   * Useful for showing image preview before upload
   */
  static createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  /**
   * Revokes a preview URL when it's no longer needed
   * Important to prevent memory leaks
   */
  static revokePreviewUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}
