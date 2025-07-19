import crypto from 'crypto';

/**
 * Generates an MD5 hash of the given content
 * @param content The content to hash
 * @returns MD5 hash of the content
 */
export function generateMD5(content: string): string {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('hex');
}
