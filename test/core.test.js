import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import CsvReport from '../utils/csvReport.js';
import NuvemshopClient from '../services/nuvemshop.js';
import { extractSkuFromFolder, parseCsvSkus } from '../services/uploadSessions.js';
import { getJob, startSyncJob } from '../services/syncJobs.js';
import { buildAuthorizeUrl } from '../routes/auth.js';

test('extractSkuFromFolder uses the first SKU-like token', () => {
  assert.equal(extractSkuFromFolder('1001 Produto Azul'), '1001');
  assert.equal(extractSkuFromFolder('ABC-123 - Camiseta'), 'ABC-123');
  assert.equal(extractSkuFromFolder('MEGA-1094077 - Carregador'), 'MEGA-1094077');
});

test('parseCsvSkus accepts semicolon CSV and known headers', () => {
  const skus = parseCsvSkus('codigo;nome\n1001 Produto Azul;Produto A\nABC-123 - Camiseta;Produto B\n');
  assert.deepEqual([...skus], ['1001', 'ABC-123']);
});

test('CsvReport writes batch metadata columns', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sku-report-'));
  const reportPath = path.join(dir, 'report.csv');
  const report = new CsvReport(reportPath, {
    batchLabel: '21-40',
    batchStart: 21,
    batchEnd: 40,
    batchSize: 20,
    batchTotal: 300,
  });

  await report.addSuccess('MEGA-1001', '123', '1.jpg', 'upload', 'Image uploaded.');

  const csv = await fs.readFile(reportPath, 'utf8');
  assert.match(csv, /batch_label;batch_start;batch_end;batch_size;batch_total/);
  assert.match(csv, /"21-40";"21";"40";"20";"300"/);
});

test('startSyncJob tracks progress and completion', async () => {
  const job = startSyncJob({
    mode: 'add',
    dryRun: true,
    run: async (progress) => {
      progress({ total: 2, completed: 1, currentSku: '1001' });
      return { stats: { processed: 1 } };
    },
  });

  assert.equal(job.status, 'running');

  let completed = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    completed = getJob(job.id);
    if (completed?.status === 'completed') break;
  }

  assert.equal(completed.status, 'completed');
  assert.equal(completed.progress.completed, 1);
  assert.equal(completed.result.stats.processed, 1);
});

test('NubeSDK script exports App without legacy browser APIs', async () => {
  const scriptPath = path.resolve('public/nube/main.min.js');
  const script = await fs.readFile(scriptPath, 'utf8');

  assert.match(script, /export function App\(nube\)/);
  assert.doesNotMatch(script, /\bwindow\b/);
  assert.doesNotMatch(script, /\bdocument\b/);
  assert.doesNotMatch(script, /\binnerHTML\b/);
  assert.doesNotMatch(script, /\blocalStorage\b/);
});

test('buildAuthorizeUrl uses the official app authorization URL only', () => {
  const url = new URL(buildAuthorizeUrl('33268'));

  assert.equal(url.origin, 'https://www.nuvemshop.com.br');
  assert.equal(url.pathname, '/apps/33268/authorize');
  assert.equal(url.search, '');
});

test('exchangeAuthorizationCode reports OAuth JSON errors returned with HTTP 200', async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.NUVEMSHOP_CLIENT_ID;
  const originalClientSecret = process.env.NUVEMSHOP_CLIENT_SECRET;
  let requestBody = null;

  process.env.NUVEMSHOP_CLIENT_ID = '33268';
  process.env.NUVEMSHOP_CLIENT_SECRET = 'secret';
  globalThis.fetch = async (url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response(
      JSON.stringify({
        error: 'invalid_request',
        error_description: 'The grant type was not specified in the request',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  };

  try {
    await assert.rejects(
      () => NuvemshopClient.exchangeAuthorizationCode('oauth-code'),
      /The grant type was not specified/
    );
    assert.equal(requestBody.client_id, '33268');
    assert.equal(requestBody.client_secret, 'secret');
    assert.equal(requestBody.grant_type, 'authorization_code');
    assert.equal(requestBody.code, 'oauth-code');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined) {
      delete process.env.NUVEMSHOP_CLIENT_ID;
    } else {
      process.env.NUVEMSHOP_CLIENT_ID = originalClientId;
    }
    if (originalClientSecret === undefined) {
      delete process.env.NUVEMSHOP_CLIENT_SECRET;
    } else {
      process.env.NUVEMSHOP_CLIENT_SECRET = originalClientSecret;
    }
  }
});

test('Nuvemshop API requests include the standard Authorization bearer header', async () => {
  const originalFetch = globalThis.fetch;
  let requestHeaders = null;

  globalThis.fetch = async (url, options) => {
    requestHeaders = options.headers;
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const client = new NuvemshopClient({
      storeId: '123',
      accessToken: 'token-abc',
      userAgent: 'SKU Image Sync (test@example.com)',
      requestDelay: 0,
    });

    await client.request('/products?per_page=1');

    assert.equal(requestHeaders.Authorization, 'Bearer token-abc');
    assert.equal(requestHeaders.Authentication, 'bearer token-abc');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
