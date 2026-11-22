import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createYampiAuthRouter } from '../routes/yampiAuth.js';

test('marketplace entry restarts PKCE; forged or incomplete browser callbacks never exchange tokens', async () => {
  let exchanges = 0, reads = 0, saves = 0;
  const app = express();
  app.use('/auth/yampi', createYampiAuthRouter({
    repository: { consumeState: async () => { reads++; return null; }, save: async () => { saves++; } },
    exchange: async () => { exchanges++; }
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/auth/yampi/callback`;
  try {
    const entry = await fetch(url + '?code=unsolicited&merchant=other', { redirect: 'manual' });
    assert.equal(entry.status, 302);
    assert.equal(entry.headers.get('location'), '/auth/yampi/install');
    assert.equal(entry.headers.get('set-cookie'), null);
    for (const options of [
      { query: '?code=rogue&state=forged' },
      { query: '?code=rogue', headers: { cookie: 'image_sync_yampi_oauth=pending-browser' } },
      { query: '?error=access_denied' }
    ]) {
      assert.equal((await fetch(url + options.query, { redirect: 'manual', headers: options.headers })).status, 400);
    }
    assert.equal(exchanges, 0); assert.equal(reads, 0); assert.equal(saves, 0);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
