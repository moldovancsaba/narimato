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
      const { title, description, imageUrl, parentTag } = req.body;
      
      if (!title?.trim()) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const card = await Card.findOne({ uuid });
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      // Update card fields
      card.title = title.trim();
      card.description = description?.trim() || '';
      card.imageUrl = imageUrl?.trim() || '';
      card.parentTag = parentTag?.trim() || null;
      
      // Update the name field (hashtag)
      card.name = parentTag?.trim() ? `${parentTag.trim()}/${title.trim()}` : title.trim();
      
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
