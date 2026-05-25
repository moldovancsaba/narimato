const { PORTS } = require('../../../lib/intelligence/constants');

/**
 * Proxy-friendly status for /local-ai (dev). Fetches local status-server when reachable.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const statusUrl = `http://127.0.0.1:${PORTS.STATUS}/api/status`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(statusUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) {
      return res.status(200).json({
        reachable: false,
        ports: PORTS,
        error: `status-server HTTP ${response.status}`,
      });
    }
    const payload = await response.json();
    return res.status(200).json({ reachable: true, ports: PORTS, ...payload });
  } catch (err) {
    return res.status(200).json({
      reachable: false,
      ports: PORTS,
      error: err.message || 'Local intelligence offline',
      operatorUrl: `http://127.0.0.1:${PORTS.STATUS}`,
    });
  }
}
