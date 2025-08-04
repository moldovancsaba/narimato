import mongoose, { createConnection } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

(async function createDefaultOrganization() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  const connection = createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    maxPoolSize: 5,
  });

  const organizationSchema = new mongoose.Schema({
    uuid: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true, trim: true, maxlength: 255 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 255, index: true },
    databaseName: { type: String, required: true, unique: true },
    description: { type: String, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  });

  const Organization = connection.model('Organization', organizationSchema);

  try {
    const uuid = uuidv4();
    const defaultOrg = new Organization({
      uuid: uuid,
      displayName: 'Default Organization',
      slug: 'default-org',
      databaseName: `narimato_org_${uuid.replace(/-/g, '_')}`,
      description: 'This is the default organization.',
      isActive: true,
    });

    await defaultOrg.save();
    console.log('Default organization created successfully');
  } catch (error) {
    console.error('Failed to create default organization:', error);
  } finally {
    await connection.close();
  }
})();

