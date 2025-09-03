const { connectDB } = require('../../../lib/db');
const Play = require('../../../lib/models/Play');

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectDB();

    const { organizationId } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: 'organizationId required' });
    }

    // Delete all play sessions for this organization
    const result = await Play.deleteMany({ organizationId });
    
    console.log(`🧹 Cleaned up ${result.deletedCount} play sessions for org ${organizationId}`);

    res.json({ 
      success: true, 
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} play sessions`
    });

  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
