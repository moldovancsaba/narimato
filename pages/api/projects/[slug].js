import { Project } from '../../../utils/db';

export default async function handler(req, res) {
  const { slug } = req.query;

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const project = await Project.findOne({ slug }).populate('cards');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If cardOrder exists, sort cards according to it
    if (project.cardOrder && project.cardOrder.length > 0) {
      const orderedCards = project.cardOrder.map(cardId => 
        project.cards.find(card => card._id.toString() === cardId.toString())
      ).filter(Boolean); // Remove any null values

      // Add any cards that might not be in the order array at the end
      const unorderedCards = project.cards.filter(card => 
        !project.cardOrder.includes(card._id)
      );

      project.cards = [...orderedCards, ...unorderedCards];
    }

    res.status(200).json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
}
