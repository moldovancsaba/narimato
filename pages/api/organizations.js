const { connectMaster, getMasterOrganizationModel } = require('../../lib/db');
const { v4: uuidv4 } = require('uuid');
const { blockVercelMutation } = require('../../lib/intelligence/vercelGuard');

export default async function handler(req, res) {
  await connectMaster();

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    case 'PUT':
      return handlePut(req, res);
    case 'DELETE':
      return handleDelete(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res) {
  try {
    const Organization = getMasterOrganizationModel();
    const organizations = await Organization.find({ isActive: true })
      .select('uuid name slug description databaseName createdAt')
      .sort({ createdAt: -1 });
    
    res.json({ organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req, res) {
  if (blockVercelMutation(req, res)) return;
  try {
    const Organization = getMasterOrganizationModel();
    const { name, slug, description } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug required' });
    }

    // Check if slug exists
    const existing = await Organization.findOne({ slug, isActive: true });
    if (existing) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const orgUuid = uuidv4();
    const organization = new Organization({
      uuid: orgUuid,
      name,
      slug: slug.toLowerCase(),
      description: description || '',
      databaseName: orgUuid,
      isActive: true,
    });

    await organization.save();

    res.status(201).json({ organization });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// FUNCTIONAL: Updates existing organization with new data
// STRATEGIC: Allows organizations to modify their profile information
async function handlePut(req, res) {
  if (blockVercelMutation(req, res)) return;
  try {
    const Organization = getMasterOrganizationModel();
    const { uuid, name, slug, description } = req.body;
    
    if (!uuid) {
      return res.status(400).json({ error: 'Organization UUID required' });
    }
    
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug required' });
    }

    // Find the organization to update
    const organization = await Organization.findOne({ uuid, isActive: true });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if slug exists on other organizations
    const existingSlug = await Organization.findOne({ 
      slug: slug.toLowerCase(), 
      uuid: { $ne: uuid },
      isActive: true 
    });
    if (existingSlug) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    // Update organization
    organization.name = name;
    organization.slug = slug.toLowerCase();
    organization.description = description || '';
    organization.updatedAt = new Date();
    
    await organization.save();

    res.json({ organization });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// FUNCTIONAL: Soft deletes organization by setting isActive to false
// STRATEGIC: Preserves data integrity while hiding organization from users
async function handleDelete(req, res) {
  if (blockVercelMutation(req, res)) return;
  try {
    const Organization = getMasterOrganizationModel();
    const { uuid } = req.body;
    
    if (!uuid) {
      return res.status(400).json({ error: 'Organization UUID required' });
    }

    // Find and soft delete the organization
    const organization = await Organization.findOne({ uuid, isActive: true });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Soft delete - set isActive to false instead of hard delete
    organization.isActive = false;
    organization.updatedAt = new Date();
    
    await organization.save();

    res.json({ message: 'Organization deleted successfully', uuid });
  } catch (error) {
    console.error('Delete organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
