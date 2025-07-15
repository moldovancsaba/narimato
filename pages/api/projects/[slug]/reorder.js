import { Project } from '../../../../utils/db';

/**
 * API Route: /api/projects/[slug]/reorder
 * Updates the card order within a project
 */
export default async function handler(req, res) {
  const { slug } = req.query;
  const { cardOrder } = req.body;

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!Array.isArray(cardOrder)) {
    return res.status(400).json({ error: 'cardOrder must be an array' });
  }

  try {
    const project = await Project.findOne({ slug });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.cardOrder = cardOrder;
    await project.save();

    res.status(200).json({ message: 'Card order updated successfully' });
  } catch (error) {
    console.error('Error updating card order:', error);
    res.status(500).json({ error: 'Failed to update card order' });
  }
}
