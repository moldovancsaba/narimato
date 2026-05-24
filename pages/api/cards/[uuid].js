const { connectMaster } = require('../../../lib/db');
const { withOrganization } = require('../../../lib/tenantContext');
const Card = require('../../../lib/models/Card');
const { blockVercelMutation } = require('../../../lib/intelligence/vercelGuard');
const { markOrgDirty } = require('../../../lib/intelligence/dirtyQueue');

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uuid, organizationId } = req.query;

  if (!uuid) {
    return res.status(400).json({ error: 'Card UUID is required' });
  }
  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId required' });
  }

  try {
    await connectMaster();
    return await withOrganization(organizationId, async () => {
      if (req.method === 'GET') {
        const card = await Card.findOne({ uuid, organizationId });
        if (!card) {
          return res.status(404).json({ error: 'Card not found' });
        }
        return res.status(200).json(card);
      }

      if (req.method === 'PUT') {
        if (blockVercelMutation(req, res)) return;
        let { title, description, imageUrl, parentTag, name, isPlayable } = req.body;

        if (!title?.trim()) {
          return res.status(400).json({ error: 'Title is required' });
        }

        const card = await Card.findOne({ uuid, organizationId });
        if (!card) {
          return res.status(404).json({ error: 'Card not found' });
        }

        if (parentTag?.trim()) {
          const cleanParentTag = parentTag.trim();

          if (cleanParentTag === card.name) {
            return res.status(400).json({
              error: `Card cannot be its own parent. "${card.name}" cannot have parentTag "${cleanParentTag}"`,
            });
          }

          const allCards = await Card.find({
            organizationId: card.organizationId,
            isActive: true,
          });

          const visited = new Set();
          let currentParentTag = cleanParentTag;

          while (currentParentTag && !visited.has(currentParentTag)) {
            visited.add(currentParentTag);

            if (currentParentTag === card.name) {
              return res.status(400).json({
                error: `Circular reference detected. Setting parentTag to "${cleanParentTag}" would create a loop: ${Array.from(visited).join(' → ')} → ${card.name}`,
              });
            }

            const parentCard = allCards.find((c) => c.name === currentParentTag);
            currentParentTag = parentCard?.parentTag;
          }
        }

        if (name) {
          if (name.startsWith('#')) {
            name = name.substring(1);
          }
          name = `#${name}`;
          card.name = name;
        }

        if (parentTag?.trim()) {
          parentTag = parentTag.trim();
          if (!parentTag.startsWith('#')) {
            parentTag = `#${parentTag}`;
          }
          card.parentTag = parentTag;
        } else {
          card.parentTag = null;
        }

        card.title = title.trim();
        card.description = description?.trim() || '';
        card.imageUrl = imageUrl?.trim() || '';

        if (typeof isPlayable === 'boolean') {
          card.isPlayable = isPlayable;
        }

        await card.save();
        await markOrgDirty(organizationId, card.parentTag || card.name);
        return res.status(200).json(card);
      }

      if (req.method === 'DELETE') {
        if (blockVercelMutation(req, res)) return;
        const card = await Card.findOne({ uuid, organizationId });
        if (!card) {
          return res.status(404).json({ error: 'Card not found' });
        }

        await Card.deleteOne({ uuid });
        await markOrgDirty(organizationId);
        return res.status(200).json({ message: 'Card deleted successfully' });
      }
    });
  } catch (error) {
    console.error('Card operation error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Internal server error' });
  }
}
