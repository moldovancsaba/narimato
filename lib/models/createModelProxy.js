const { getTenantModels } = require('../tenantContext');
const mongoose = require('mongoose');

/**
 * Mongoose model proxy: uses tenant models when inside withOrganization(), else legacy default connection.
 */
function createModelProxy(name, registerOnConnection, getLegacyModel) {
  function resolveModel() {
    const tenant = getTenantModels();
    if (tenant && tenant[name]) {
      return tenant[name];
    }
    return getLegacyModel();
  }

  const proxyTarget = function ModelProxy(...args) {
    const Model = resolveModel();
    return new Model(...args);
  };

  return new Proxy(proxyTarget, {
    get(_target, prop) {
      if (prop === 'then') return undefined;
      const model = resolveModel();
      const value = model[prop];
      if (typeof value === 'function') {
        return value.bind(model);
      }
      return value;
    },
    construct(_target, args) {
      const Model = resolveModel();
      return new Model(...args);
    },
  });
}

function legacyModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

module.exports = {
  createModelProxy,
  legacyModel,
};
