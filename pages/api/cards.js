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
    const { organizationId, title, description, imageUrl, hashtags, isPlayable, isOnboarding } = req.body;
    let { name, parentTag } = req.body;
    
    if (!organizationId || !title) {
      return res.status(400).json({ error: 'organizationId and title required' });
    }
    
    // Generate name if not provided
    if (!name) {
      name = `${title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    }
    // Remove # if user added it, we'll add it properly
    if (name.startsWith('#')) {
      name = name.substring(1);
    }
    // Now add # prefix properly
    name = `#${name}`;
    
    // FUNCTIONAL: Prevent circular references in card hierarchy during creation
    // STRATEGIC: Ensures SwipeMore engine never encounters infinite loops
    if (parentTag?.trim()) {
      const cleanParentTag = parentTag.trim();
      
      // Prevent card from being its own parent (name hasn't been created yet, but check anyway)
      if (cleanParentTag === name) {
        return res.status(400).json({ 
          error: `Card cannot be its own parent. "${name}" cannot have parentTag "${cleanParentTag}"` 
        });
      }
      
      // Check for potential circular references with existing cards
      const allCards = await Card.find({ 
        organizationId, 
        isActive: true 
      });
      
      // Check if setting this parentTag would create a circular reference
      // by seeing if any existing card has our name as an ancestor
      const visited = new Set();
      let currentParentTag = cleanParentTag;
      
      while (currentParentTag && !visited.has(currentParentTag)) {
        visited.add(currentParentTag);
        
        // If we find our own card name in the parent chain, it would be circular
        if (currentParentTag === name) {
          return res.status(400).json({
            error: `Circular reference detected. Setting parentTag to "${cleanParentTag}" would create a loop: ${Array.from(visited).join(' → ')} → ${name}`
          });
        }
        
        // Find the parent card and continue up the chain
        const parentCard = allCards.find(c => c.name === currentParentTag || c.name === `#${currentParentTag}`);
        currentParentTag = parentCard?.parentTag;
      }
    }

    // HASHTAG MANAGEMENT: Ensure name always starts with #
    if (!name) {
      name = `${title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    }
    // Remove # if user added it, we'll add it properly
    if (name.startsWith('#')) {
      name = name.substring(1);
    }
    // Now add # prefix properly
    name = `#${name}`;
    
    // HASHTAG MANAGEMENT: Ensure parentTag starts with # if provided
    if (parentTag) {
      if (!parentTag.startsWith('#')) {
        parentTag = `#${parentTag}`;
      }
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
      isPlayable: typeof isPlayable === 'boolean' ? isPlayable : true,
      isOnboarding: typeof isOnboarding === 'boolean' ? isOnboarding : false,
      globalScore: 1500 // Starting ELO rating
    });

    await card.save();

    res.status(201).json({ card });
  } catch (error) {
    console.error('Create card error:', error);
    if (error?.code === 11000) {
      return res.status(400).json({ error: 'Card with this name already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
