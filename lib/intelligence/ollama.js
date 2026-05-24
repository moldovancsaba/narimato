const { OLLAMA } = require('./constants');

let inferenceChain = Promise.resolve();
let resolvedModelCache = null;

const MODEL_CANDIDATES = [
  process.env.OLLAMA_MODEL,
  'llama3.2:1b',
  'llama3.2',
  'mistral:latest',
  'mcs-llm-core-llama32:latest',
].filter(Boolean);

async function listOllamaModels() {
  const host = OLLAMA.HOST.replace(/\/$/, '');
  const res = await fetch(`${host}/api/tags`, { method: 'GET' });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

async function resolveOllamaModel() {
  if (resolvedModelCache) return resolvedModelCache;
  const installed = await listOllamaModels();
  for (const candidate of MODEL_CANDIDATES) {
    if (installed.includes(candidate)) {
      resolvedModelCache = candidate;
      return candidate;
    }
  }
  if (installed.length) {
    resolvedModelCache = installed[0];
    return resolvedModelCache;
  }
  return OLLAMA.MODEL;
}

async function getOllamaStatus() {
  try {
    const host = OLLAMA.HOST.replace(/\/$/, '');
    const res = await fetch(`${host}/api/tags`, { method: 'GET' });
    if (!res.ok) {
      return { reachable: false, model: OLLAMA.MODEL, modelReady: false, installed: [] };
    }
    const data = await res.json();
    const installed = (data.models || []).map((m) => m.name);
    const model = await resolveOllamaModel();
    const modelReady = installed.includes(model);
    return { reachable: true, model, modelReady, installed };
  } catch {
    return { reachable: false, model: OLLAMA.MODEL, modelReady: false, installed: [] };
  }
}

function queueAiInference(fn) {
  const run = inferenceChain.then(() => fn());
  inferenceChain = run.catch(() => {});
  return run;
}

async function ollamaGenerate(prompt, options = {}) {
  const host = options.host || OLLAMA.HOST;
  const model = options.model || (await resolveOllamaModel());
  const url = `${host.replace(/\/$/, '')}/api/generate`;
  const body = {
    model,
    prompt,
    stream: false,
    format: options.format || 'json',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.response || '';
}

async function ollamaChat(messages, options = {}) {
  const host = options.host || OLLAMA.HOST;
  const model = options.model || (await resolveOllamaModel());
  const url = `${host.replace(/\/$/, '')}/api/chat`;
  const body = {
    model,
    messages,
    stream: false,
    format: options.format,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama chat error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.message?.content || '';
}

async function checkOllamaReachable() {
  const status = await getOllamaStatus();
  return status.reachable && status.modelReady;
}

function parseJsonResponse(text) {
  const trimmed = String(text).trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error('Failed to parse JSON from Ollama response');
  }
}

module.exports = {
  queueAiInference,
  ollamaGenerate,
  ollamaChat,
  checkOllamaReachable,
  getOllamaStatus,
  resolveOllamaModel,
  parseJsonResponse,
};
