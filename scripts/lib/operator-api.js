const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  connectMaster,
  getMasterOrganizationModel,
  getMasterTopicSpecModel,
  getMasterPipelineJobModel,
  getMasterDeckIntelligenceConfigModel,
} = require('../../lib/db');
const { withOrganization } = require('../../lib/tenantContext');
const { enqueueJob, listRecentJobs } = require('../../lib/intelligence/jobQueue');
const {
  handleJob,
  runTopicChat,
  approvePendingCards,
  rejectPendingCards,
  setCardFeedback,
  setDeckAutoApprove,
} = require('../../lib/intelligence/jobHandlers');
const { getDirtyState } = require('../../lib/intelligence/dirtyQueue');
const { getProjectedDecks } = require('../../lib/intelligence/projectionReader');
const { checkOllamaReachable, getOllamaStatus } = require('../../lib/intelligence/ollama');
const { JOB_TYPES, TOPIC_STATUS, PORTS, CARD_APPROVAL } = require('../../lib/intelligence/constants');
const { refreshOrgProjection } = require('../../lib/intelligence/projectionBuilder');
const { getLocalAiLinks, flattenLocalAiLinks } = require('../../lib/intelligence/localAiLinks');

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function getStatusPayload() {
  await connectMaster();
  const GlobalSetting = require('../../lib/db').getMasterGlobalSettingModel();
  const dirty = await getDirtyState();
  const ollamaStatus = await getOllamaStatus();
  const syncHb = await GlobalSetting.findOne({ key: 'local_ai_worker_heartbeat:sync' });
  const snapHb = await GlobalSetting.findOne({ key: 'local_ai_worker_heartbeat:snapshot-worker' });
  const guardianHb = await GlobalSetting.findOne({ key: 'local_ai_worker_heartbeat:guardian' });
  const links = getLocalAiLinks(PORTS);
  return {
    ports: PORTS,
    links: { ...links, flattened: flattenLocalAiLinks(links) },
    operatorUi: 'react-gds',
    operatorBundle: fs.existsSync(path.join(__dirname, '../local-operator/bundle.js')),
    ollama: ollamaStatus.reachable,
    brain: {
      ready: ollamaStatus.reachable && ollamaStatus.modelReady,
      model: ollamaStatus.model,
      modelReady: ollamaStatus.modelReady,
    },
    dirty,
    workers: {
      sync: syncHb?.value || null,
      snapshotWorker: snapHb?.value || null,
      guardian: guardianHb?.value || null,
    },
  };
}

async function routeOperatorApi(req, res, pathname) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname === '/api/status' && req.method === 'GET') {
      const payload = await getStatusPayload();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    if (pathname === '/api/organizations' && req.method === 'GET') {
      await connectMaster();
      const Organization = getMasterOrganizationModel();
      const organizations = await Organization.find({ isActive: true }).sort({ createdAt: -1 });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ organizations }));
      return;
    }

    if (pathname === '/api/organizations' && req.method === 'PUT') {
      await connectMaster();
      const Organization = getMasterOrganizationModel();
      const body = await readBody(req);
      const organization = await Organization.findOne({ uuid: body.uuid, isActive: true });
      if (!organization) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Organization not found' }));
        return;
      }
      organization.name = body.name;
      organization.slug = String(body.slug).toLowerCase();
      organization.description = body.description || '';
      await organization.save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ organization }));
      return;
    }

    if (pathname === '/api/organizations' && req.method === 'DELETE') {
      await connectMaster();
      const Organization = getMasterOrganizationModel();
      const body = await readBody(req);
      const organization = await Organization.findOne({ uuid: body.uuid, isActive: true });
      if (!organization) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Organization not found' }));
        return;
      }
      organization.isActive = false;
      await organization.save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathname === '/api/survey-password' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      const { getSurveyPasswordStatus } = require('../../lib/system/surveyAccess');
      const { getSurveyReadiness } = require('../../lib/operator/sampleSurvey');
      const status = await getSurveyPasswordStatus(organizationId);
      const readiness = await getSurveyReadiness(organizationId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...status, ...readiness }));
      return;
    }

    if (pathname === '/api/survey-password' && req.method === 'POST') {
      const body = await readBody(req);
      await connectMaster();
      const { getOrCreateSurveyPassword } = require('../../lib/system/surveyAccess');
      const regenerate = body.regenerate === true;
      const result = await getOrCreateSurveyPassword(body.organizationId, regenerate);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ password: result.password, configured: true }));
      return;
    }

    if (pathname === '/api/survey-bootstrap' && req.method === 'POST') {
      const body = await readBody(req);
      const { bootstrapSampleSurvey } = require('../../lib/operator/sampleSurvey');
      try {
        const result = await bootstrapSampleSurvey(body.organizationId, {
          regeneratePassword: body.regeneratePassword === true,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(err.statusCode || 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Bootstrap failed' }));
      }
      return;
    }

    if (pathname === '/api/organizations' && req.method === 'POST') {
      await connectMaster();
      const Organization = getMasterOrganizationModel();
      const body = await readBody(req);
      const orgUuid = uuidv4();
      const organization = await Organization.create({
        uuid: orgUuid,
        name: body.name,
        slug: String(body.slug).toLowerCase(),
        description: body.description || '',
        databaseName: orgUuid,
        isActive: true,
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ organization }));
      return;
    }

    if (pathname === '/api/cards/pending' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      if (!organizationId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'organizationId required' }));
        return;
      }
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../../lib/tenantContext');
        const { Card } = getTenantModels();
        const cards = await Card.find({
          organizationId,
          approvalStatus: CARD_APPROVAL.PENDING,
          isActive: { $ne: false },
        }).sort({ createdAt: -1 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cards }));
      });
      return;
    }

    if (pathname === '/api/cards' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      if (!organizationId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'organizationId required' }));
        return;
      }
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../../lib/tenantContext');
        const { Card } = getTenantModels();
        const cards = await Card.find({ organizationId }).sort({ createdAt: -1 });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cards }));
      });
      return;
    }

    if (pathname === '/api/cards/reject' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await rejectPendingCards(body.organizationId, body.cardUuids || [], body.deckRootTag);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, ...result }));
      return;
    }

    if (pathname === '/api/feedback/reconcile' && req.method === 'POST') {
      const body = await readBody(req);
      const job = await enqueueJob({
        organizationId: body.organizationId,
        type: JOB_TYPES.RECONCILE_FEEDBACK,
        payload: { archiveDownvoted: body.archiveDownvoted === true },
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ job }));
      return;
    }

    if (pathname === '/api/cards/approve' && req.method === 'POST') {
      const body = await readBody(req);
      await approvePendingCards(body.organizationId, body.cardUuids || [], body.deckRootTag);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathname === '/api/cards/feedback' && req.method === 'POST') {
      const body = await readBody(req);
      await setCardFeedback(body.organizationId, body.cardUuid, body.feedback);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (pathname === '/api/cards' && req.method === 'POST') {
      const body = await readBody(req);
      await withOrganization(body.organizationId, async () => {
        const { getTenantModels } = require('../../lib/tenantContext');
        const { Card } = getTenantModels();
        let name = body.name || body.title;
        if (!name.startsWith('#')) name = `#${name}`;
        const card = await Card.create({
          uuid: uuidv4(),
          organizationId: body.organizationId,
          name,
          title: body.title,
          description: body.description || '',
          imageUrl: body.imageUrl || '',
          hashtags: body.hashtags || [name],
          parentTag: body.parentTag || null,
          isActive: true,
          approvalStatus: CARD_APPROVAL.APPROVED,
          source: 'manual',
          globalScore: 1500,
        });
        const { markOrgDirty } = require('../../lib/intelligence/dirtyQueue');
        await markOrgDirty(body.organizationId, body.parentTag);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ card }));
      });
      return;
    }

    if (pathname === '/api/decks/projection' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      await withOrganization(organizationId, async () => {
        const { getTenantModels } = require('../../lib/tenantContext');
        const models = getTenantModels();
        const result = await getProjectedDecks(organizationId, models, { includeHidden: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
      return;
    }

    if (pathname === '/api/deck-config' && req.method === 'POST') {
      const body = await readBody(req);
      const cfg = await setDeckAutoApprove(body.organizationId, body.deckRootTag, body.autoApprove);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ config: cfg }));
      return;
    }

    if (pathname === '/api/deck-config' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      await connectMaster();
      const DeckConfig = getMasterDeckIntelligenceConfigModel();
      const configs = await DeckConfig.find({ organizationId });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ configs }));
      return;
    }

    if (pathname === '/api/topics' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      await connectMaster();
      const TopicSpec = getMasterTopicSpecModel();
      const topics = await TopicSpec.find(organizationId ? { organizationId } : {})
        .sort({ updatedAt: -1 })
        .limit(50);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ topics }));
      return;
    }

    if (pathname === '/api/topics' && req.method === 'POST') {
      const body = await readBody(req);
      await connectMaster();
      const TopicSpec = getMasterTopicSpecModel();
      const topic = await TopicSpec.create({
        uuid: uuidv4(),
        organizationId: body.organizationId,
        title: body.title || 'New topic',
        status: TOPIC_STATUS.DRAFT,
        conversation: [
          {
            role: 'system',
            content: 'Clarify the Narimato deck topic with the operator.',
          },
        ],
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ topic }));
      return;
    }

    if (pathname === '/api/topics/chat' && req.method === 'POST') {
      const body = await readBody(req);
      const result = await runTopicChat(body.topicSpecId, body.message);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ reply: result.reply, topic: result.topicSpec }));
      return;
    }

    if (pathname === '/api/topics/approve' && req.method === 'POST') {
      const body = await readBody(req);
      await connectMaster();
      const TopicSpec = getMasterTopicSpecModel();
      const topic = await TopicSpec.findOne({ uuid: body.topicSpecId });
      if (!topic) throw new Error('Topic not found');
      topic.status = TOPIC_STATUS.APPROVED;
      topic.approvedSummary = body.approvedSummary || topic.approvedSummary;
      topic.deckRootTag = body.deckRootTag || topic.deckRootTag;
      topic.regenMode = body.regenMode || topic.regenMode;
      topic.targetBranchTag = body.targetBranchTag || topic.targetBranchTag;
      topic.regenerateTag = body.regenerateTag || topic.regenerateTag;
      if (body.cardCount != null) topic.planningConstraints.cardCount = body.cardCount;
      if (body.hierarchyLevels != null) {
        topic.planningConstraints.hierarchyLevels = body.hierarchyLevels;
      }
      await topic.save();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ topic }));
      return;
    }

    if (pathname === '/api/jobs' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const organizationId = url.searchParams.get('organizationId');
      const jobs = await listRecentJobs(organizationId || null, 30);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jobs }));
      return;
    }

    if (pathname === '/api/jobs' && req.method === 'POST') {
      const body = await readBody(req);
      const job = await enqueueJob({
        organizationId: body.organizationId,
        type: body.type,
        payload: body.payload || {},
        priority: body.priority || 0,
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ job }));
      return;
    }

    if (pathname === '/api/jobs/run-sync' && req.method === 'POST') {
      const body = await readBody(req);
      await connectMaster();
      const PipelineJob = getMasterPipelineJobModel();
      const job = await PipelineJob.findOne({ uuid: body.jobUuid });
      if (!job) throw new Error('Job not found');
      job.status = 'running';
      job.startedAt = new Date();
      await job.save();
      try {
        const result = await handleJob(job);
        job.status = 'completed';
        job.result = result;
        job.completedAt = new Date();
        await job.save();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ job, result }));
      } catch (err) {
        job.status = 'failed';
        job.error = err.message;
        job.completedAt = new Date();
        await job.save();
        throw err;
      }
      return;
    }

    if (pathname === '/api/play-feedback/events' && req.method === 'GET') {
      const url = new URL(req.url, 'http://127.0.0.1');
      const orgId = url.searchParams.get('organizationId');
      if (!orgId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'organizationId required' }));
        return;
      }
      const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
      await withOrganization(orgId, async () => {
        const { getTenantModels } = require('../../lib/tenantContext');
        const { PlayFeedbackEvent, PlayFeedbackAggregate } = getTenantModels();
        const deck = url.searchParams.get('deckRootTag');
        const query = { organizationId: orgId };
        if (deck) query.deckRootTag = deck;
        const events = await PlayFeedbackEvent.find(query)
          .sort({ completedAt: -1 })
          .limit(limit);
        const aggregates = await PlayFeedbackAggregate.find(
          deck ? { organizationId: orgId, deckRootTag: deck } : { organizationId: orgId }
        );
        const {
          getMasterIntelligenceMemoryModel,
          getMasterIntelligenceRuleModel,
          getMasterIntelligencePersonaModel,
        } = require('../../lib/db');
        const memories = await getMasterIntelligenceMemoryModel()
          .find({ organizationId: orgId, ...(deck ? { deckRootTag: deck } : {}) })
          .sort({ updatedAt: -1 })
          .limit(20);
        const rules = await getMasterIntelligenceRuleModel()
          .find({ organizationId: orgId, active: true })
          .sort({ priority: -1 })
          .limit(20);
        const persona = await getMasterIntelligencePersonaModel().findOne({
          organizationId: orgId,
          deckRootTag: deck || '',
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            events,
            aggregates,
            memories,
            rules,
            persona,
          })
        );
      });
      return;
    }

    if (pathname === '/api/projection/refresh' && req.method === 'POST') {
      const body = await readBody(req);
      await withOrganization(body.organizationId, async () => {
        const { getTenantModels } = require('../../lib/tenantContext');
        const models = getTenantModels();
        const projection = await refreshOrgProjection(body.organizationId, models);
        const { markOrgDirty, clearOrgDirty } = require('../../lib/intelligence/dirtyQueue');
        await markOrgDirty(body.organizationId);
        await clearOrgDirty(body.organizationId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ projection }));
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
  } catch (err) {
    console.error('Operator API error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = {
  routeOperatorApi,
  getStatusPayload,
};
