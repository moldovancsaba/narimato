const { connectMaster } = require('../../lib/db');
const { withOrganization } = require('../../lib/tenantContext');
const Card = require('../../lib/models/Card');
const { v4: uuidv4 } = require('uuid');

export default async function handler(req, res) {
  const organizationId = req.query.organizationId || req.body?.organizationId;
  if (!organizationId) {
    return res.status(400).json({ error: 'organizationId required' });
  }

  try {
    await connectMaster();
    return await withOrganization(organizationId, async () => {
      switch (req.method) {
        case 'GET':
          return handleGet(req, res);
        case 'POST':
          return handlePost(req, res);
        default:
          return res.status(405).json({ error: 'Method not allowed' });
      }
    });
  } catch (error) {
    console.error('Cards API error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({ error: error.message || 'Internal server error' });
  }
}

async function handleGet(req, res) {
  try {
    const { organizationId, parentTag } = req.query;

    const query = { organizationId, isActive: true };
    if (parentTag) {
      query.$and = [
        { name: { $ne: parentTag } },
        {
          $or: [{ parentTag: parentTag }, { hashtags: parentTag }],
        },
      ];
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
    const { organizationId, title, description, imageUrl, hashtags, isPlayable, isOnboarding } =
      req.body;
    let { name, parentTag } = req.body;

    if (!organizationId || !title) {
      return res.status(400).json({ error: 'organizationId and title required' });
    }

    if (!name) {
      name = `${title.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    }
    if (name.startsWith('#')) {
      name = name.substring(1);
    }
    name = `#${name}`;

    if (parentTag?.trim()) {
      const cleanParentTag = parentTag.trim();

      if (cleanParentTag === name) {
        return res.status(400).json({
          error: `Card cannot be its own parent. "${name}" cannot have parentTag "${cleanParentTag}"`,
        });
      }

      const allCards = await Card.find({
        organizationId,
        isActive: true,
      });

      const visited = new Set();
      let currentParentTag = cleanParentTag;

      while (currentParentTag && !visited.has(currentParentTag)) {
        visited.add(currentParentTag);

        if (currentParentTag === name) {
          return res.status(400).json({
            error: `Circular reference detected. Setting parentTag to "${cleanParentTag}" would create a loop: ${Array.from(visited).join(' → ')} → ${name}`,
          });
        }

        const parentCard = allCards.find(
          (c) => c.name === currentParentTag || c.name === `#${currentParentTag}`
        );
        currentParentTag = parentCard?.parentTag;
      }
    }

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
      globalScore: 1500,
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
