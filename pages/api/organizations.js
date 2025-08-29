const { connectDB } = require('../../lib/db');
const Organization = require('../../lib/models/Organization');
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
  await connectDB();

  switch (req.method) {
    case 'GET':
      return handleGet(req, res);
    case 'POST':
      return handlePost(req, res);
    default:
      return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGet(req, res) {
  try {
    const organizations = await Organization.find({ isActive: true })
      .select('uuid name slug description createdAt')
      .sort({ createdAt: -1 });
    
    res.json({ organizations });
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req, res) {
  try {
    const { name, slug, description } = req.body;
    
    if (!name || !slug) {
      return res.status(400).json({ error: 'name and slug required' });
    }

    // Check if slug exists
    const existing = await Organization.findOne({ slug, isActive: true });
    if (existing) {
      return res.status(400).json({ error: 'Slug already exists' });
    }

    const organization = new Organization({
      uuid: uuidv4(),
      name,
      slug: slug.toLowerCase(),
      description: description || '',
      isActive: true
    });

    await organization.save();

    res.status(201).json({ organization });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
