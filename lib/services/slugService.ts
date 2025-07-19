import { Project } from '@/models/Project';
import { Card } from '@/models/Card';
import dbConnect from '@/lib/mongodb';
import { DatabaseError, ValidationError } from '@/lib/errors';
import crypto from 'crypto';

export class SlugService {
  /**
   * Generates an MD5 hash from a string
   * This is used internally for unique identification while maintaining human-readable slugs
   * 
   * @param content - The string to hash
   * @returns MD5 hash of the input string
   */
  private static generateMD5(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Generates a URL-friendly slug from a string
   * 
   * @param text - The text to convert into a slug
   * @returns A URL-friendly slug
   */
  private static generateSlug(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Updates a project's slug while maintaining its MD5 identifier
   * 
   * @param currentSlug - The current slug of the project
   * @param newSlug - The new desired slug
   * @returns The updated project
   * @throws {ValidationError} If the new slug is invalid or already exists
   * @throws {DatabaseError} If there's a database error
   */
  static async updateProjectSlug(currentSlug: string, newSlug: string) {
    console.log(`[Slug Service] Updating project slug from ${currentSlug} to ${newSlug}`);
    
    if (!newSlug || !/^[a-z0-9-]+$/.test(newSlug)) {
      throw new ValidationError('Invalid slug format. Use only lowercase letters, numbers, and hyphens.');
    }

    try {
      await dbConnect();
      
      // Check if the new slug is already in use
      const existingProject = await Project.findOne({ slug: newSlug });
      if (existingProject) {
        throw new ValidationError('This slug is already in use');
      }

      // Update the project's slug
      const updatedProject = await Project.findOneAndUpdate(
        { slug: currentSlug },
        { $set: { slug: newSlug } },
        { new: true, runValidators: true }
      );

      if (!updatedProject) {
        throw new ValidationError('Project not found');
      }

      return updatedProject;
    } catch (error) {
      console.error('[Slug Service] Error updating project slug:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update project slug', error);
    }
  }

  /**
   * Updates a card's slug while maintaining its MD5 content identifier
   * 
   * @param currentSlug - The current slug of the card
   * @param newSlug - The new desired slug
   * @returns The updated card
   * @throws {ValidationError} If the new slug is invalid or already exists
   * @throws {DatabaseError} If there's a database error
   */
  static async updateCardSlug(currentSlug: string, newSlug: string) {
    console.log(`[Slug Service] Updating card slug from ${currentSlug} to ${newSlug}`);
    
    if (!newSlug || !/^[a-z0-9-]+$/.test(newSlug)) {
      throw new ValidationError('Invalid slug format. Use only lowercase letters, numbers, and hyphens.');
    }

    try {
      await dbConnect();
      
      // Check if the new slug is already in use
      const existingCard = await Card.findOne({ slug: newSlug });
      if (existingCard) {
        throw new ValidationError('This slug is already in use');
      }

      // Update the card's slug
      const updatedCard = await Card.findOneAndUpdate(
        { slug: currentSlug },
        { $set: { slug: newSlug } },
        { new: true, runValidators: true }
      );

      if (!updatedCard) {
        throw new ValidationError('Card not found');
      }

      return updatedCard;
    } catch (error) {
      console.error('[Slug Service] Error updating card slug:', error);
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new DatabaseError('Failed to update card slug', error);
    }
  }

  /**
   * Ensures both slug and MD5 hash are set for a project
   * This is used when creating or updating projects
   * 
   * @param name - The project name
   * @param customSlug - Optional custom slug
   * @returns Object containing generated slug and MD5
   */
  static async ensureProjectIdentifiers(name: string, customSlug?: string) {
    const slug = customSlug || this.generateSlug(name);
    const identifierMD5 = this.generateMD5(name + Date.now().toString());

    // Verify slug uniqueness
    const existingProject = await Project.findOne({ slug });
    if (existingProject) {
      throw new ValidationError('This slug is already in use');
    }

    return { slug, identifierMD5 };
  }

  /**
   * Ensures both slug and MD5 hash are set for a card
   * This is used when creating or updating cards
   * 
   * @param title - The card title
   * @param content - The card content
   * @param customSlug - Optional custom slug
   * @returns Object containing generated slug and MD5
   */
  static async ensureCardIdentifiers(title: string, content: string, customSlug?: string) {
    const slug = customSlug || this.generateSlug(title);
    const contentMD5 = this.generateMD5(content);

    // Verify slug uniqueness
    const existingCard = await Card.findOne({ slug });
    if (existingCard) {
      throw new ValidationError('This slug is already in use');
    }

    return { slug, contentMD5 };
  }
}
