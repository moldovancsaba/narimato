const { connectDB } = require('../../lib/db');
const Card = require('../../lib/models/Card');
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
    const { organizationId, parentTag } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
    }

    const query = { organizationId, isActive: true };
    if (parentTag) {
      query.parentTag = parentTag;
    }

    const cards = await Card.find(query).sort({ globalScore: -1 });
    
    res.json({ cards });
  } catch (error) {
    console.error('Get cards error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handlePost(req, res) {
  try {
    const { organizationId, title, description, imageUrl, parentTag, hashtags } = req.body;
    
    if (!organizationId || !title) {
      return res.status(400).json({ error: 'organizationId and title required' });
    }

    // Generate hashtag name if not provided
    let name = req.body.name;
    if (!name) {
      name = `#${title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    }
    if (!name.startsWith('#')) {
      name = `#${name}`;
    }

    const card = new Card({
      uuid: uuidv4(),
      organizationId,
      name,
      title,
      description: description || '',
      imageUrl: imageUrl || '',
      hashtags: hashtags || [name],
      parentTag: parentTag || null,
      isActive: true,
      globalScore: 1500 // Starting ELO rating
    });

    await card.save();

    res.status(201).json({ card });
  } catch (error) {
    console.error('Create card error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Card with this name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
