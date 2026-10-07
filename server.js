// server.js — SmartPOS local server. No npm install needed: uses only Node's
// built-in modules (http, node:sqlite). Run with: node server.js
// Then open http://localhost:4173 in a browser on this computer.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openDb, loadState, saveState } = require('./db');
const { seed } = require('./logic-seed');

const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;
const DB_FILE = path.join(__dirname, 'data', 'smartpos.db');
const INDEX_FILE = path.join(__dirname, 'public', 'index.html');

const db = openDb(DB_FILE);
const wasEmpty = !db.prepare('SELECT 1 FROM singletons LIMIT 1').get() && !db.prepare('SELECT 1 FROM records LIMIT 1').get();
let cached = loadState(db, seed).state;
// Persist immediately: this is also how one-time data migrations (like an old
// database's ready-made stock being converted from kg to portions) get written
// back to disk right away, so they never accidentally run a second time.
saveState(db, cached);
if (wasEmpty) console.log('New database created at ' + DB_FILE + ' with sample data.');

function send(res, status, body, type) {
  res.writeHead(status, { 'Content-Type': type || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer((req, res) => {
  try {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      fs.readFile(INDEX_FILE, (err, data) => {
        if (err) return send(res, 500, 'Could not read public/index.html');
        send(res, 200, data, 'text/html; charset=utf-8');
      });
      return;
    }
    if (req.method === 'GET' && req.url === '/api/state') {
      return send(res, 200, JSON.stringify(cached));
    }
    if (req.method === 'POST' && req.url === '/api/state') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 25 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        let next;
        try { next = JSON.parse(body); } catch (e) { return send(res, 400, JSON.stringify({ error: 'Invalid JSON' })); }
        try {
          saveState(db, next);
          cached = next;
          send(res, 200, JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
        } catch (e) {
          console.error('Save failed:', e);
          send(res, 500, JSON.stringify({ error: 'Could not save to the database' }));
        }
      });
      return;
    }
    send(res, 404, JSON.stringify({ error: 'Not found' }));
  } catch (e) {
    console.error(e);
    send(res, 500, JSON.stringify({ error: 'Server error' }));
  }
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Mister Hogs SmartPOS is running.');
  console.log('  Open this in a browser on this computer:  http://localhost:' + PORT);
  console.log('  Database file:  ' + DB_FILE);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
