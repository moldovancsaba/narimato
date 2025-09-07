// FUNCTIONAL: Middleware to negotiate API version from headers and expose it to handlers
// STRATEGIC: Establishes a safe, incremental path to multi-version APIs without breaking existing routes

// Parse requested API version from headers. Priority:
// 1) Accept: application/vnd.narimato.vX+json
// 2) X-API-Version: X (integer)
// 3) Default: 1
export function parseApiVersion(req) {
  try {
    const accept = (req.headers['accept'] || '').toString();
    const match = accept.match(/application\/vnd\.narimato\.v(\d+)\+json/i);
    if (match && match[1]) {
      const ver = Number.parseInt(match[1], 10);
      if (Number.isInteger(ver) && ver > 0) return ver;
    }
    const headerVer = (req.headers['x-api-version'] || '').toString().trim();
    const hv = Number.parseInt(headerVer, 10);
    if (Number.isInteger(hv) && hv > 0) return hv;
    return 1;
  } catch {
    return 1;
  }
}

// Attach version on the request, set response headers,
// then call the provided handler unchanged.
export function withApiVersion(handler, options = {}) {
  // options: { defaultVersion?: number, deprecations?: { [version:number]: boolean } }
  const defaultVersion = options.defaultVersion || 1;
  const deprecations = options.deprecations || {};

  return async function versionedHandler(req, res) {
    const version = parseApiVersion(req) || defaultVersion;

    // Expose normalized version on request for downstream handlers
    req.apiVersion = version;

    // Response headers for transparency
    try { res.setHeader('X-API-Selected-Version', `v${version}`); } catch (e) {}
    if (deprecations[version]) {
      // Soft signal for clients using deprecated versions (no behavior change)
      try { res.setHeader('X-API-Deprecated', 'true'); } catch (e) {}
    }

    return handler(req, res);
  };
}

// OPTIONAL: Helper to select a handler map by version.
// If a mapping is provided, pick the best available version, falling back to v1.
export function resolveVersioned(handlersByVersion, version) {
  // handlersByVersion: { 1: fn, 2: fn, ... }
  if (handlersByVersion[version]) return handlersByVersion[version];
  return handlersByVersion[1];
}
