import { Project, Card } from '../../utils/db';
import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  const session = await getSession({ req });
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  switch (req.method) {
    case 'POST':
      try {
        const { name, description } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Project name is required' });
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        
        const project = new Project({
          name,
          description,
          slug,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        await project.save();
        
        res.status(201).json(project);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create project' });
      }
      break;

    case 'PUT':
      try {
        const { projectId, name, description, cardOrder } = req.body;
        
        if (!projectId) {
          return res.status(400).json({ error: 'Project ID is required' });
        }

        const update = {};
        if (name) update.name = name;
        if (description) update.description = description;
        if (cardOrder) update.cardOrder = cardOrder;
        update.updatedAt = new Date().toISOString();

        const project = await Project.findByIdAndUpdate(
          projectId,
          update,
          { new: true }
        );

        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        res.status(200).json(project);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update project' });
      }
      break;

    case 'DELETE':
      try {
        const { projectId } = req.query;
        
        if (!projectId) {
          return res.status(400).json({ error: 'Project ID is required' });
        }

        const project = await Project.findByIdAndDelete(projectId);
        
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }

        res.status(200).json({ message: 'Project deleted successfully' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete project' });
      }
      break;

    default:
      res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
      res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}
