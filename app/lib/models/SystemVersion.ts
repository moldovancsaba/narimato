import mongoose from 'mongoose';

/**
 * SystemVersion Schema - Tracks application and database versions
 * 
 * This model maintains version consistency across the entire system,
 * ensuring that the application version, database schema version,
 * and deployment version are synchronized and trackable.
 */
const SystemVersionSchema = new mongoose.Schema({
  // Application version following semantic versioning (MAJOR.MINOR.PATCH)
  applicationVersion: { 
    type: String, 
    required: true,
    match: /^\d+\.\d+\.\d+$/,
    index: true
  },
  
  // Database schema version for migration tracking
  databaseVersion: { 
    type: String, 
    required: true,
    match: /^\d+\.\d+\.\d+$/,
    index: true
  },
  
  // Deployment environment (development, staging, production)
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    required: true,
    index: true
  },
  
  // Version deployment timestamp in ISO 8601 format with milliseconds
  deployedAt: { 
    type: Date, 
    default: Date.now,
    required: true,
    index: true
  },
  
  // Version release notes reference
  releaseNotes: {
    type: String,
    required: false
  },
  
  // Migration status for database schema changes
  migrationStatus: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'failed'],
    default: 'completed',
    index: true
  },
  
  // Breaking changes indicator
  hasBreakingChanges: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Previous version reference for migration tracking
  previousVersion: {
    type: String,
    required: false,
    match: /^\d+\.\d+\.\d+$/
  },
  
  // System metadata
  metadata: {
    nodeVersion: String,
    nextVersion: String,
    mongooseVersion: String,
    deploymentId: String
  }
});

// Interface for TypeScript support
export interface ISystemVersion extends mongoose.Document {
  applicationVersion: string;
  databaseVersion: string;
  environment: 'development' | 'staging' | 'production';
  deployedAt: Date;
  releaseNotes?: string;
  migrationStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
  hasBreakingChanges: boolean;
  previousVersion?: string;
  metadata?: {
    nodeVersion?: string;
    nextVersion?: string;
    mongooseVersion?: string;
    deploymentId?: string;
  };
}

// Static method interfaces
export interface ISystemVersionModel extends mongoose.Model<ISystemVersion> {
  getCurrentVersion(environment?: string): Promise<ISystemVersion | null>;
  recordVersionDeployment(versionData: {
    applicationVersion: string;
    databaseVersion: string;
    environment: string;
    releaseNotes?: string;
    hasBreakingChanges?: boolean;
    previousVersion?: string;
    metadata?: any;
  }): Promise<ISystemVersion>;
  updateMigrationStatus(
    applicationVersion: string, 
    environment: string, 
    status: 'pending' | 'in-progress' | 'completed' | 'failed'
  ): Promise<ISystemVersion | null>;
}

// Compound index for efficient version queries
SystemVersionSchema.index({ 
  applicationVersion: 1, 
  environment: 1, 
  deployedAt: -1 
});

// Static method to get current system version
SystemVersionSchema.statics.getCurrentVersion = async function(environment: string = 'production') {
  return await this.findOne({ environment })
    .sort({ deployedAt: -1 })
    .limit(1);
};

// Static method to record new version deployment
SystemVersionSchema.statics.recordVersionDeployment = async function(versionData: {
  applicationVersion: string;
  databaseVersion: string;
  environment: string;
  releaseNotes?: string;
  hasBreakingChanges?: boolean;
  previousVersion?: string;
  metadata?: any;
}) {
  // Get the previous version for reference
  const previousRecord = await (this as any).getCurrentVersion(versionData.environment);
  
  const newVersion = new this({
    ...versionData,
    deployedAt: new Date(),
    previousVersion: previousRecord?.applicationVersion || undefined,
    migrationStatus: versionData.hasBreakingChanges ? 'pending' : 'completed'
  });
  
  return await newVersion.save();
};

// Static method to update migration status
SystemVersionSchema.statics.updateMigrationStatus = async function(
  applicationVersion: string, 
  environment: string, 
  status: 'pending' | 'in-progress' | 'completed' | 'failed'
) {
  return await this.findOneAndUpdate(
    { applicationVersion, environment },
    { 
      migrationStatus: status,
      ...(status === 'completed' && { migrationCompletedAt: new Date() })
    },
    { new: true }
  );
};

// Transform timestamps to ISO8601 in JSON output
SystemVersionSchema.set('toJSON', {
  transform: function(doc, ret: { deployedAt?: Date | string; migrationCompletedAt?: Date | string }) {
    if (ret.deployedAt instanceof Date) {
      ret.deployedAt = ret.deployedAt.toISOString();
    }
    if (ret.migrationCompletedAt instanceof Date) {
      ret.migrationCompletedAt = ret.migrationCompletedAt.toISOString();
    }
    return ret;
  }
});

export const SystemVersion = (mongoose.models.SystemVersion as ISystemVersionModel) || 
  mongoose.model<ISystemVersion, ISystemVersionModel>('SystemVersion', SystemVersionSchema);
