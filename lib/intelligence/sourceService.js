const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { connectMaster, getMasterSourceModel, getMasterTopicSpecModel } = require('../db');
const { TOPIC_STATUS } = require('./constants');
const { enqueueJob } = require('./jobQueue');
const { JOB_TYPES } = require('./constants');

const createSourceSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(200),
  kind: z.enum(['text', 'markdown', 'url']).default('text'),
  content: z.string().max(50000).optional(),
  url: z.string().url().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
  enqueueIngest: z.boolean().optional(),
});

async function listSources(organizationId, limit = 50) {
  await connectMaster();
  const Source = getMasterSourceModel();
  return Source.find({ organizationId }).sort({ createdAt: -1 }).limit(limit);
}

async function createSource(input) {
  const data = createSourceSchema.parse(input);
  await connectMaster();
  const Source = getMasterSourceModel();
  const doc = await Source.create({
    uuid: uuidv4(),
    organizationId: data.organizationId,
    title: data.title,
    kind: data.kind,
    content: data.content || '',
    url: data.url || null,
    metadata: data.metadata || {},
    status: 'pending',
  });
  if (data.enqueueIngest !== false) {
    await enqueueJob({
      organizationId: data.organizationId,
      type: JOB_TYPES.INGEST_SOURCE,
      payload: { sourceUuid: doc.uuid },
    });
  }
  return doc;
}

async function deleteSource(organizationId, sourceUuid) {
  await connectMaster();
  const Source = getMasterSourceModel();
  const doc = await Source.findOne({ uuid: sourceUuid, organizationId });
  if (!doc) {
    const err = new Error('Source not found');
    err.statusCode = 404;
    throw err;
  }
  await Source.deleteOne({ uuid: sourceUuid });
  return { ok: true };
}

async function ingestSource(organizationId, sourceUuid) {
  await connectMaster();
  const Source = getMasterSourceModel();
  const TopicSpec = getMasterTopicSpecModel();
  const source = await Source.findOne({ uuid: sourceUuid, organizationId });
  if (!source) throw new Error('Source not found');

  try {
    const summary =
      source.kind === 'url' && source.url
        ? `Corpus URL: ${source.url}\n${source.content || ''}`.trim()
        : (source.content || source.title).slice(0, 4000);

    let topicSpec = source.topicSpecId
      ? await TopicSpec.findOne({ uuid: source.topicSpecId })
      : null;

    if (!topicSpec) {
      topicSpec = await TopicSpec.create({
        uuid: uuidv4(),
        organizationId,
        status: TOPIC_STATUS.DRAFT,
        title: source.title,
        approvedSummary: summary.slice(0, 2000),
        conversation: [
          {
            role: 'system',
            content: `Corpus ingested from source ${source.uuid} (${source.kind})`,
          },
        ],
        deckRootTag: source.metadata?.deckRootTag || null,
      });
      source.topicSpecId = topicSpec.uuid;
    } else {
      topicSpec.approvedSummary = summary.slice(0, 2000);
      await topicSpec.save();
    }

    source.status = 'ingested';
    source.ingestedAt = new Date();
    source.error = null;
    await source.save();

    return { source, topicSpecId: topicSpec.uuid };
  } catch (err) {
    source.status = 'failed';
    source.error = String(err.message);
    await source.save();
    throw err;
  }
}

module.exports = {
  createSourceSchema,
  listSources,
  createSource,
  deleteSource,
  ingestSource,
};
