import { executeAgentCashFetch } from './src/agentcash-wrapper.js';

const res = executeAgentCashFetch({
  url: 'https://stableenrich.dev/api/exa/search',
  method: 'POST',
  body: { query: "TreasuryClaw architecture openclaw" }
});

console.log(JSON.stringify(res, null, 2));
