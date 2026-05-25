const { connectMaster } = require('../../../lib/db');
const {
  listSources,
  createSource,
  deleteSource,
} = require('../../../lib/intelligence/sourceService');

/**
 * Corpus ingestion — webapp may write Source documents (not Card intelligence).
 * GET list, POST create (+ optional INGEST_SOURCE job).
 */
export default async function handler(req, res) {
  try {
    await connectMaster();

    if (req.method === 'GET') {
      const organizationId = req.query.organizationId;
      if (!organizationId) {
        return res.status(400).json({ error: 'organizationId required' });
      }
      const sources = await listSources(organizationId);
      return res.status(200).json({ sources });
    }

    if (req.method === 'DELETE') {
      const organizationId = req.query.organizationId || req.body?.organizationId;
      const sourceUuid = req.query.uuid || req.body?.uuid;
      if (!organizationId || !sourceUuid) {
        return res.status(400).json({ error: 'organizationId and uuid required' });
      }
      await deleteSource(organizationId, sourceUuid);
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const source = await createSource({
        organizationId: body.organizationId,
        title: body.title,
        kind: body.kind,
        content: body.content,
        url: body.url,
        metadata: body.metadata,
        enqueueIngest: body.enqueueIngest !== false,
      });
      return res.status(201).json({ source });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Intelligence sources API:', err);
    const status = err.statusCode || err.issues ? 400 : 500;
    return res.status(status).json({
      error: err.message || 'Request failed',
      issues: err.issues,
    });
  }
}
