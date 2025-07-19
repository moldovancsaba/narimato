import { Project } from '@/models/Project';
import { Card } from '@/models/Card';
import dbConnect from '@/lib/mongodb';
import { DatabaseError, ProjectValidationError } from '@/lib/errors';
import mongoose, { Document } from 'mongoose';

interface ProjectDocument extends Document {
  _id: mongoose.Types.ObjectId;
  cards: mongoose.Types.ObjectId[];
  slug: string;
  // Add other fields as needed
}

export class ProjectService {
/**
   * Retrieves a project by its identifier (slug or MD5)
   * 
   * @param identifier - The unique identifier for the project (slug or MD5)
   * @param useSlug - If true, uses slug for lookup, otherwise uses MD5
   * @returns The project document if found, null otherwise
   * @throws {ProjectValidationError} If the identifier is invalid
   * @throws {DatabaseError} If there's a database connection or query error
   */
  static async getProject(identifier: string, useSlug: boolean = true): Promise<ProjectDocument | null> {
    console.log(`[Project Service] Attempting to fetch project with ${useSlug ? 'slug' : 'MD5'}: ${identifier}`);

    // Validate identifier format based on type
    if (!identifier || typeof identifier !== 'string') {
      console.error(`[Project Service] Invalid identifier format received: ${identifier}`);
      throw new ProjectValidationError('Invalid project identifier format');
    }

    if (useSlug && !/^[a-z0-9-]+$/.test(identifier)) {
      throw new ProjectValidationError('Invalid project slug format');
    } else if (!useSlug && !/^[a-f0-9]{32}$/i.test(identifier)) {
      throw new ProjectValidationError('Invalid project MD5 format');
    }

  try {
    // Ensure database connection
    const connection = await dbConnect();
    if (!connection) {
      throw new DatabaseError('Failed to establish database connection');
    }

    // Find project with populated cards using the appropriate identifier
    console.log(`[Project Service] Executing database query for ${useSlug ? 'slug' : 'MD5'}: ${identifier}`);
    const project = await Project.findOne(
      useSlug ? { slug: identifier } : { identifierMD5: identifier }
    )
    .populate({
      path: 'cards',
      options: { lean: true }
    })
    .exec();
    
    if (!project) {
      console.warn(`[Project Service] Project not found with ${useSlug ? 'slug' : 'MD5'}: ${identifier}`);
      return null;
    }

if (project) {
      const projectId = project._id || 'unknown';
      const cardCount = project.cards?.length || 0;
      console.log(`[Project Service] Successfully retrieved project: ${projectId} with ${cardCount} cards`);
    }

    return project;

  } catch (error) {
    // Handle specific Mongoose errors
    if (error instanceof Error) {
      if (error.name === 'ValidationError') {
        throw new ProjectValidationError('Invalid project data format', error);
      }
      if (error.name === 'MongoServerError') {
        throw new DatabaseError('Database query failed', error);
      }
    }

    // Log and rethrow as DatabaseError for unknown errors
    console.error('Error fetching project:', error);
    throw new DatabaseError('Failed to fetch project data', error);
  }
}

  /**
   * Updates a project's details
   * 
   * @param slug - The project's slug
   * @param updateData - The data to update
   * @returns The updated project
   * @throws {ProjectValidationError} If the update data is invalid
   * @throws {DatabaseError} If there's a database error
   */
  static async updateProject(slug: string, updateData: Partial<typeof Project.prototype>) {
    console.log(`[Project Service] Attempting to update project with slug: ${slug}`);
    
    try {
    await dbConnect();
    
    const project = await Project.findOneAndUpdate(
      { slug },
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('cards');
    
    if (!project) {
      throw new ProjectValidationError('Project not found');
    }
    
    return project;
  } catch (error) {
    console.error('[Project Service] Error updating project:', error);
    throw new DatabaseError('Failed to update project', error);
  }
}

  /**
   * Adds a card to a project
   * 
   * @param projectSlug - The project's slug
   * @param cardId - The ID of the card to add
   * @returns The updated project
   */
  static async addCardToProject(projectSlug: string, cardId: string) {
    console.log(`[Project Service] Adding card ${cardId} to project ${projectSlug}`);
    
    try {
    await dbConnect();
    
    // Verify card exists and isn't deleted
    const card = await Card.findOne({ _id: cardId, isDeleted: false });
    if (!card) {
      throw new ProjectValidationError('Card not found or is deleted');
    }
    
    const project = await Project.findOneAndUpdate(
      { slug: projectSlug },
      { $addToSet: { cards: cardId } },  // Using addToSet to prevent duplicates
      { new: true, runValidators: true }
    ).populate('cards');
    
    if (!project) {
      throw new ProjectValidationError('Project not found');
    }
    
    return project;
  } catch (error) {
    console.error('[Project Service] Error adding card to project:', error);
    throw new DatabaseError('Failed to add card to project', error);
  }
}

  /**
   * Removes a card from a project
   * 
   * @param projectSlug - The project's slug
   * @param cardId - The ID of the card to remove
   * @returns The updated project
   */
  static async removeCardFromProject(projectSlug: string, cardId: string) {
    console.log(`[Project Service] Removing card ${cardId} from project ${projectSlug}`);
    
    try {
    await dbConnect();
    
    const project = await Project.findOneAndUpdate(
      { slug: projectSlug },
      { $pull: { cards: cardId } },
      { new: true, runValidators: true }
    ).populate('cards');
    
    if (!project) {
      throw new ProjectValidationError('Project not found');
    }
    
    return project;
  } catch (error) {
    console.error('[Project Service] Error removing card from project:', error);
    throw new DatabaseError('Failed to remove card from project', error);
  }
}

  /**
   * Deletes a project and removes it from all associated cards
   * 
   * @param slug - The project's slug
   * @returns True if successful
   */
  static async deleteProject(slug: string): Promise<boolean> {
    console.log(`[Project Service] Deleting project with slug: ${slug}`);
    
    const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    await dbConnect();
    
    // Find the project first to get its ID and cards
    const project = await Project.findOne({ slug }).session(session);
    if (!project) {
      throw new ProjectValidationError('Project not found');
    }
    
    // Remove project references from all associated cards
    await Card.updateMany(
      { 'projectRankings.projectId': project._id.toString() },
      { $pull: { projectRankings: { projectId: project._id.toString() } } },
      { session }
    );
    
    // Delete the project
    await Project.findByIdAndDelete(project._id).session(session);
    
    await session.commitTransaction();
    return true;
  } catch (error) {
    await session.abortTransaction();
    console.error('[Project Service] Error deleting project:', error);
    throw new DatabaseError('Failed to delete project', error);
  } finally {
    session.endSession();
  }
}
}
