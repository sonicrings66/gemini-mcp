#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const pidPath = path.resolve(process.cwd(), '.mcp-server.pid');

function log(...args) {
  console.log('[stop-server]', ...args);
}

function killPid(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    log(`Sent SIGTERM to pid ${pid}`);
    // wait a bit
    const start = Date.now();
    while (Date.now() - start < 3000) {
      try { process.kill(pid, 0); } catch (err) { return true; }
    }
    // force kill
    process.kill(pid, 'SIGKILL');
    log(`Sent SIGKILL to pid ${pid}`);
    return true;
  } catch (err) {
    log(`Failed to kill pid ${pid}: ${err.message}`);
    return false;
  }
}

function pkillFallback() {
  log('Attempting to pkill processes matching "node src/server.js"');
  try {
    const r = spawnSync('pkill', ['-f', 'node src/server.js']);
    if (r.status === 0) {
      log('pkill succeeded');
      return true;
    }
    log('pkill did not find any matching processes');
    return false;
  } catch (err) {
    log('pkill failed:', err.message);
    return false;
  }
}

function main() {
  if (fs.existsSync(pidPath)) {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
    if (Number.isNaN(pid)) {
      log('PID file exists but contents are invalid; removing pid file');
      fs.unlinkSync(pidPath);
      process.exit(1);
    }

    try {
      process.kill(pid, 0); // check if exists
      log(`Found process with PID ${pid}, attempting to stop`);
      const ok = killPid(pid);
      if (ok) {
        try { fs.unlinkSync(pidPath); } catch (e) {}
        log('Server stopped and PID file removed');
        process.exit(0);
      }
      log('Unable to stop process by PID');
    } catch (err) {
      log('No process found for PID in pidfile; removing stale pidfile');
      try { fs.unlinkSync(pidPath); } catch (e) {}
      process.exit(1);
    }
  }

  // Fallback: try pkill
  const pk = pkillFallback();
  if (pk) {
    log('Stopped matching processes with pkill');
    try { fs.unlinkSync(pidPath); } catch (e) {}
    process.exit(0);
  }

  log('No running server processes found');
  process.exit(1);
}

main();
