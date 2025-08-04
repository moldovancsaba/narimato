import mongoose, { Schema } from 'mongoose';

/**
 * Organization Model - Master Database
 * Manages metadata and database configurations for each organization.
 */

const OrganizationSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 255
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 255
  },
  databaseName: {
    type: String,
    required: true,
    unique: true
  },
  subdomain: {
    type: String,
    unique: true,
    sparse: true
  },
  settings: {
    type: Map,
    of: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export interface IOrganization {
  name: string;
  slug: string;
  databaseName: string;
  subdomain?: string;
  settings?: Map<string, string>;
  isActive?: boolean;
  createdAt?: Date;
}

const Organization = (mongoose.models.Organization || mongoose.model<IOrganization>('Organization', OrganizationSchema));

export default Organization;

