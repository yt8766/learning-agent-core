#!/usr/bin/env node
/* global AbortController, URL, clearTimeout, console, fetch, process, setTimeout */

const requiredEnv = ['PREVIEW_BASE_URL', 'LLM_GATEWAY_PREVIEW_API_KEY'];
const optionalEnv = [
  'LLM_GATEWAY_PREVIEW_ADMIN_TOKEN',
  'LLM_GATEWAY_PREVIEW_ADMIN_USERNAME',
  'LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD',
  'LLM_GATEWAY_PREVIEW_MODEL',
  'LLM_GATEWAY_PREVIEW_STREAM',
  'LLM_GATEWAY_PREVIEW_TIMEOUT_MS'
];

const timeoutMs = Number.parseInt(process.env.LLM_GATEWAY_PREVIEW_TIMEOUT_MS ?? '20000', 10);

main().catch(error => {
  console.error(`[preview-smoke] failed: ${redact(String(error?.message ?? error))}`);
  process.exitCode = 1;
});

async function main() {
  validateEnv();

  const baseUrl = normalizeBaseUrl(process.env.PREVIEW_BASE_URL);
  const gatewayApiKey = process.env.LLM_GATEWAY_PREVIEW_API_KEY;
  const adminToken = await resolveAdminToken(baseUrl);

  console.log(`[preview-smoke] target=${baseUrl.origin}`);
  console.log('[preview-smoke] secrets=redacted');

  await runAdminAuthSmoke(baseUrl, adminToken);
  const models = await runModelsSmoke(baseUrl, gatewayApiKey);
  await runKeySmoke(baseUrl, gatewayApiKey);
  await runChatSmoke(baseUrl, gatewayApiKey, pickModel(models));

  if (isTruthy(process.env.LLM_GATEWAY_PREVIEW_STREAM)) {
    await runStreamSmoke(baseUrl, gatewayApiKey, pickModel(models));
  }

  console.log('[preview-smoke] ok');
}

function validateEnv() {
  const missing = requiredEnv.filter(name => !process.env[name]?.trim());
  const hasAdminToken = Boolean(process.env.LLM_GATEWAY_PREVIEW_ADMIN_TOKEN?.trim());
  const hasAdminPassword = Boolean(process.env.LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD?.trim());

  if (!hasAdminToken && !hasAdminPassword) {
    missing.push('LLM_GATEWAY_PREVIEW_ADMIN_TOKEN or LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD');
  }

  if (missing.length > 0) {
    throw new Error(
      [
        `Missing required env: ${missing.join(', ')}`,
        'Required base smoke env: PREVIEW_BASE_URL, LLM_GATEWAY_PREVIEW_API_KEY.',
        'Required admin smoke env: either LLM_GATEWAY_PREVIEW_ADMIN_TOKEN or LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD.',
        `Optional env: ${optionalEnv.join(', ')}.`
      ].join(' ')
    );
  }
}

function normalizeBaseUrl(value) {
  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, '');
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    throw new Error('PREVIEW_BASE_URL must be an absolute http(s) URL.');
  }
}

async function resolveAdminToken(baseUrl) {
  const suppliedToken = process.env.LLM_GATEWAY_PREVIEW_ADMIN_TOKEN?.trim();
  if (suppliedToken) {
    return suppliedToken;
  }

  const username = process.env.LLM_GATEWAY_PREVIEW_ADMIN_USERNAME?.trim() || 'admin';
  const password = process.env.LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD;
  const response = await requestJson(baseUrl, '/api/admin/auth/login', {
    method: 'POST',
    body: { username, password },
    expectStatus: 200,
    label: 'admin login'
  });

  if (!isObject(response.body) || typeof response.body.accessToken !== 'string' || !response.body.accessToken) {
    throw new Error('admin login did not return accessToken');
  }

  return response.body.accessToken;
}

async function runAdminAuthSmoke(baseUrl, adminToken) {
  const response = await requestJson(baseUrl, '/api/admin/providers', {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
    expectStatus: 200,
    label: 'admin auth smoke'
  });

  if (!Array.isArray(response.body?.providers) && !Array.isArray(response.body)) {
    throw new Error('admin auth smoke returned an unexpected providers payload');
  }

  console.log('[preview-smoke] admin auth smoke ok');
}

async function runModelsSmoke(baseUrl, gatewayApiKey) {
  const response = await requestJson(baseUrl, '/api/v1/models', {
    method: 'GET',
    headers: gatewayHeaders(gatewayApiKey),
    expectStatus: 200,
    label: 'models smoke'
  });

  const models = response.body?.data;
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error('/api/v1/models returned no models; create and enable a model alias before running smoke.');
  }

  console.log(`[preview-smoke] models smoke ok count=${models.length}`);
  return models;
}

async function runKeySmoke(baseUrl, gatewayApiKey) {
  const response = await requestJson(baseUrl, '/api/v1/key', {
    method: 'GET',
    headers: gatewayHeaders(gatewayApiKey),
    expectStatus: 200,
    label: 'key smoke'
  });

  if (!response.body?.id || !response.body?.status) {
    throw new Error('/api/v1/key returned an unexpected key metadata payload');
  }

  console.log(`[preview-smoke] key smoke ok status=${response.body.status}`);
}

async function runChatSmoke(baseUrl, gatewayApiKey, model) {
  const response = await requestJson(baseUrl, '/api/v1/chat/completions', {
    method: 'POST',
    headers: gatewayHeaders(gatewayApiKey),
    body: {
      model,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
      max_tokens: 8,
      stream: false
    },
    expectStatus: 200,
    label: 'chat completions smoke'
  });

  if (response.body?.object !== 'chat.completion' || !Array.isArray(response.body?.choices)) {
    throw new Error('/api/v1/chat/completions returned an unexpected completion payload');
  }

  console.log(`[preview-smoke] chat completions smoke ok model=${model}`);
}

async function runStreamSmoke(baseUrl, gatewayApiKey, model) {
  const response = await requestRaw(baseUrl, '/api/v1/chat/completions', {
    method: 'POST',
    headers: gatewayHeaders(gatewayApiKey),
    body: {
      model,
      messages: [{ role: 'user', content: 'Reply with the word ok.' }],
      max_tokens: 8,
      stream: true
    },
    expectStatus: 200,
    label: 'chat stream smoke'
  });

  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();
  if (!contentType.includes('text/event-stream') || !text.includes('data: [DONE]')) {
    throw new Error('/api/v1/chat/completions stream did not return SSE done sentinel');
  }

  console.log(`[preview-smoke] chat stream smoke ok model=${model}`);
}

function pickModel(models) {
  const configured = process.env.LLM_GATEWAY_PREVIEW_MODEL?.trim();
  if (configured) {
    return configured;
  }

  const model = models.find(item => isObject(item) && typeof item.id === 'string')?.id;
  if (!model) {
    throw new Error('Unable to pick a model from /api/v1/models response.');
  }

  return model;
}

function gatewayHeaders(apiKey) {
  return { authorization: `Bearer ${apiKey}` };
}

async function requestJson(baseUrl, path, options) {
  const response = await requestRaw(baseUrl, path, options);
  const text = await response.text();

  try {
    return { response, body: text ? JSON.parse(text) : null };
  } catch {
    throw new Error(`${options.label} returned non-JSON response: ${redact(text.slice(0, 500))}`);
  }
}

async function requestRaw(baseUrl, path, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = new URL(path, baseUrl);
  const headers = {
    accept: options.body?.stream ? 'text/event-stream' : 'application/json',
    ...options.headers
  };

  if (options.body) {
    headers['content-type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    if (response.status !== options.expectStatus) {
      const body = await response.text();
      throw new Error(
        `${options.label} expected HTTP ${options.expectStatus} but got ${response.status}: ${redact(body.slice(0, 500))}`
      );
    }

    return response;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${options.label} timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function redact(value) {
  let redacted = value;
  for (const secretName of [
    'LLM_GATEWAY_PREVIEW_API_KEY',
    'LLM_GATEWAY_PREVIEW_ADMIN_TOKEN',
    'LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD'
  ]) {
    redacted = maskSecret(redacted, process.env[secretName]);
  }

  return redacted.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [redacted]');
}

function maskSecret(text, secret) {
  if (!secret || secret.length < 4) {
    return text;
  }

  return text.split(secret).join('[redacted]');
}

function isTruthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase());
}

function isObject(value) {
  return typeof value === 'object' && value !== null;
}
