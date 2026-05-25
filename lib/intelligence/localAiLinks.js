const { PORTS, OLLAMA } = require('./constants');

const HOST = '127.0.0.1';
const WEBAPP_DEV =
  process.env.NARIMATO_WEBAPP_URL || process.env.E2E_BASE_URL || 'http://localhost:3000';
const PUBLIC_SITE = process.env.NARIMATO_PUBLIC_URL || 'https://www.narimato.com';

/**
 * Canonical URLs for local intelligence + related webapp surfaces.
 * Used by status API, /local-ai, and operator shell.
 */
function getLocalAiLinks(ports = PORTS) {
  const operatorBase = `http://${HOST}:${ports.STATUS}`;
  return {
    operator: {
      label: 'Operator console (setup & AI)',
      url: `${operatorBase}/`,
      description: 'Organisations, cards, topic chat, jobs, approvals',
    },
    operatorStatus: {
      label: 'Status API (JSON)',
      url: `${operatorBase}/api/status`,
    },
    workers: {
      syncHealth: {
        label: 'Sync worker health',
        url: `http://${HOST}:${ports.SYNC}/health`,
      },
      snapshotHealth: {
        label: 'Snapshot worker health',
        url: `http://${HOST}:${ports.SNAPSHOT}/health`,
      },
    },
    ollama: {
      label: 'Ollama API',
      url: OLLAMA.HOST.replace(/\/$/, ''),
    },
    webapp: {
      localAi: { label: 'Local AI hub (dev)', url: `${WEBAPP_DEV}/local-ai` },
      cards: { label: 'Corpus & cards (dev)', url: `${WEBAPP_DEV}/cards` },
      play: { label: 'Play / surveys (dev)', url: `${WEBAPP_DEV}/play` },
      rankings: { label: 'Rankings (dev)', url: `${WEBAPP_DEV}/rankings` },
      home: { label: 'Webapp home (dev)', url: WEBAPP_DEV },
      localOperator: { label: 'Operator mirror (dev)', url: `${WEBAPP_DEV}/local-operator` },
    },
    public: {
      site: { label: 'Public site', url: PUBLIC_SITE },
    },
    menu: [
      { group: 'Local intelligence', items: ['operator', 'operatorStatus'] },
      {
        group: 'Webapp (npm run dev)',
        items: ['webapp.localAi', 'webapp.cards', 'webapp.play', 'webapp.rankings', 'webapp.home'],
      },
      { group: 'Health checks', items: ['workers.syncHealth', 'workers.snapshotHealth'] },
      { group: 'External', items: ['ollama', 'public.site'] },
    ],
  };
}

/** Flat list for UI rendering */
function flattenLocalAiLinks(links) {
  const rows = [
    links.operator,
    links.webapp.localAi,
    links.webapp.cards,
    links.webapp.play,
    links.webapp.rankings,
    links.webapp.home,
    links.webapp.localOperator,
    links.workers.syncHealth,
    links.workers.snapshotHealth,
    links.ollama,
    links.public.site,
    { label: links.operatorStatus.label, url: links.operatorStatus.url },
  ];
  return rows.filter((r) => r?.url);
}

module.exports = {
  HOST,
  WEBAPP_DEV,
  PUBLIC_SITE,
  getLocalAiLinks,
  flattenLocalAiLinks,
};
