const { connectDB } = require('../../../lib/db');
const Card = require('../../../lib/models/Card');

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();
    const { uuid } = req.query;

    if (!uuid) {
      return res.status(400).json({ error: 'Card UUID is required' });
    }

    if (req.method === 'GET') {
      const card = await Card.findOne({ uuid });
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      return res.status(200).json(card);
    }

    if (req.method === 'PUT') {
      let { title, description, imageUrl, parentTag, name } = req.body;
      
      if (!title?.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const card = await Card.findOne({ uuid });
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      
      // FUNCTIONAL: Prevent circular references in card hierarchy
      // STRATEGIC: Ensures SwipeMore engine never encounters infinite loops
      if (parentTag?.trim()) {
        const cleanParentTag = parentTag.trim();
        
        // Prevent card from being its own parent
        if (cleanParentTag === card.name) {
          return res.status(400).json({ 
            error: `Card cannot be its own parent. "${card.name}" cannot have parentTag "${cleanParentTag}"` 
          });
        }
        
        // Prevent circular reference chains
        const allCards = await Card.find({ 
          organizationId: card.organizationId, 
          isActive: true 
        });
        
        // Check for circular reference by walking up the hierarchy
        const visited = new Set();
        let currentParentTag = cleanParentTag;
        
        while (currentParentTag && !visited.has(currentParentTag)) {
          visited.add(currentParentTag);
          
          // If we find our own card name in the parent chain, it's circular
          if (currentParentTag === card.name) {
            return res.status(400).json({
              error: `Circular reference detected. Setting parentTag to "${cleanParentTag}" would create a loop: ${Array.from(visited).join(' → ')} → ${card.name}`
            });
          }
          
          // Find the parent card and continue up the chain
          const parentCard = allCards.find(c => c.name === currentParentTag);
          currentParentTag = parentCard?.parentTag;
        }
      }

      // HASHTAG MANAGEMENT: Ensure name always starts with # if provided
      if (name) {
        // Remove # if user added it, we'll add it properly
        if (name.startsWith('#')) {
          name = name.substring(1);
        }
        // Now add # prefix properly
        name = `#${name}`;
        card.name = name;
      }
      
      // HASHTAG MANAGEMENT: Ensure parentTag starts with # if provided
      if (parentTag?.trim()) {
        parentTag = parentTag.trim();
        if (!parentTag.startsWith('#')) {
          parentTag = `#${parentTag}`;
        }
        card.parentTag = parentTag;
      } else {
        card.parentTag = null;
      }
      
      // Update other card fields
      card.title = title.trim();
      card.description = description?.trim() || '';
      card.imageUrl = imageUrl?.trim() || '';
      
      await card.save();
      return res.status(200).json(card);
    }

    if (req.method === 'DELETE') {
      const card = await Card.findOne({ uuid });
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      await Card.deleteOne({ uuid });
      return res.status(200).json({ message: 'Card deleted successfully' });
    }

  } catch (error) {
    console.error('Card operation error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
