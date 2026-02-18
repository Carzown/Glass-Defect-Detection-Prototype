#!/usr/bin/env node

/**
 * Start all backend services
 * Runs Express API server + WebSocket server
 * 
 * Usage: node start-all.js
 * Or: npm run start:all (if added to package.json)
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting all backend services...\n');

// WebSocket is now integrated into server.js - only start one service
const services = [
  {
    name: 'Express API Server + WebSocket',
    command: 'node',
    args: ['server.js'],
    env: { ...process.env, PORT: process.env.PORT || '5000' }
  }
];

let servicesStarted = 0;

services.forEach((service) => {
  console.log(`📦 Starting ${service.name}...`);
  
  const proc = spawn(service.command, service.args, {
    cwd: __dirname,
    env: service.env,
    stdio: 'inherit'
  });

  proc.on('error', (err) => {
    console.error(`❌ Failed to start ${service.name}:`, err);
    process.exit(1);
  });

  proc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`❌ ${service.name} exited with code ${code}`);
      process.exit(code);
    }
  });

  servicesStarted++;
});

console.log(`\n✅ Server started\n`);
console.log('Services running:');
console.log(`  • Express API on http://localhost:${process.env.PORT || 5000}`);
console.log(`  • WebSocket on ws://localhost:${process.env.PORT || 5000}/ws`);
console.log('\nPress Ctrl+C to stop\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down all services...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down all services...');
  process.exit(0);
});
