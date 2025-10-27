#!/usr/bin/env node
/**
 * Wrapper script to load .env.mcp and start MCP server
 * This ensures environment variables are properly loaded
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

const projectRoot = join(__dirname, '..');
const envFile = join(projectRoot, '.env.mcp');

// Load .env.mcp
try {
  const envContent = readFileSync(envFile, 'utf-8');

  // Parse each line
  envContent.split('\n').forEach((line) => {
    line = line.trim();

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) {
      return;
    }

    // Parse KEY=VALUE
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });

  console.error('[MCP Start] Environment loaded from .env.mcp');

  // Verify required variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'MCP_AUTH_HEADER'
  ];

  for (const key of required) {
    if (!process.env[key]) {
      console.error(`[MCP Start] ERROR: ${key} not set in .env.mcp`);
      process.exit(1);
    }
  }

  // Start MCP server
  const serverPath = join(projectRoot, 'bin', 'mcp-server.ts');
  const child = spawn('npx', ['tsx', serverPath], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    shell: true
  });

  child.on('error', (err) => {
    console.error('[MCP Start] Failed to start server:', err);
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

} catch (error) {
  console.error('[MCP Start] ERROR: Failed to load .env.mcp:', error);
  console.error('[MCP Start] Please create .env.mcp from .env.mcp.example');
  process.exit(1);
}
