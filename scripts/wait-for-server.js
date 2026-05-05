#!/usr/bin/env node

const http = require('http');

const url = process.argv[2] || 'http://127.0.0.1:9011/';
const timeoutMs = Number(process.argv[3] || process.env.LIVELY_SERVER_READY_TIMEOUT || 120000);
const intervalMs = Number(process.argv[4] || process.env.LIVELY_SERVER_READY_INTERVAL || 1000);
const watchedPid = Number(process.argv[5] || process.env.LIVELY_SERVER_READY_PID || 0);
const requestTimeoutMs = Number(process.env.LIVELY_SERVER_READY_REQUEST_TIMEOUT || 5000);
const startedAt = Date.now();
let attempts = 0;
let lastError = '';

function elapsed () { return Date.now() - startedAt; }

function watchedProcessIsAlive () {
  if (!watchedPid) return true;
  try {
    process.kill(watchedPid, 0);
    return true;
  } catch (err) {
    return false;
  }
}

function finishWithFailure () {
  console.error(`lively server did not become ready at ${url} within ${timeoutMs}ms${lastError ? `; last error: ${lastError}` : ''}`);
  process.exit(1);
}

function scheduleRetry (reason) {
  lastError = reason;
  if (!watchedProcessIsAlive()) {
    console.error(`lively server process ${watchedPid} exited before ${url} became ready${lastError ? `; last error: ${lastError}` : ''}`);
    process.exit(1);
  }
  if (elapsed() >= timeoutMs) return finishWithFailure();
  setTimeout(check, Math.min(intervalMs, Math.max(0, timeoutMs - elapsed())));
}

function check () {
  if (!watchedProcessIsAlive()) {
    console.error(`lively server process ${watchedPid} exited before ${url} became ready${lastError ? `; last error: ${lastError}` : ''}`);
    process.exit(1);
  }
  attempts++;
  const req = http.get(url, { timeout: requestTimeoutMs }, res => {
    res.resume();
    if (res.statusCode && res.statusCode < 500) {
      console.log(`lively server ready at ${url} after ${attempts} attempt(s)`);
      process.exit(0);
    }
    scheduleRetry(`HTTP ${res.statusCode}`);
  });

  req.on('timeout', () => req.destroy(new Error('request timeout')));
  req.on('error', err => scheduleRetry(err.message || String(err)));
}

check();
