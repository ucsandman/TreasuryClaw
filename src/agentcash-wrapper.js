import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export function executeAgentCashFetch({ url, method = 'POST', body, maxUsd = 1 }) {
  // Use the local project's agentcash bin or the globally installed one
  const agentcashCli = resolve(process.cwd(), 'node_modules/agentcash/dist/esm/index.js');
  
  const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
  
  // Use -y to bypass interactive approval because this wrapper assumes 
  // DashClaw upstream approval has already been granted for maxUsd.
  const args = [
    agentcashCli, 
    'fetch', url, 
    '-m', method, 
    '-b', bodyString, 
    '--format', 'json', 
    '-y'
  ];

  console.log(`[AgentCash Wrapper] Executing: node ${args.slice(1).join(' ')}`);

  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
    cwd: process.cwd(),
    env: process.env,
    shell: false
  });

  if (result.error) {
    throw new Error(`AgentCash spawn error: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errText = result.stderr || result.stdout;
    throw new Error(`AgentCash process failed (code ${result.status}):\n${errText}`);
  }

  // Find JSON portion
  const raw = result.stdout;
  const jsonStart = raw.indexOf('{');
  const jsonEnd = raw.lastIndexOf('}');

  let parsedData = null;
  if (jsonStart !== -1 && jsonEnd !== -1 && jsonStart < jsonEnd) {
    try {
      parsedData = JSON.parse(raw.substring(jsonStart, jsonEnd + 1));
    } catch (e) {
      // Ignore parse err, rely on raw
    }
  }

  return {
    success: true,
    data: parsedData,
    rawOutput: raw
  };
}
