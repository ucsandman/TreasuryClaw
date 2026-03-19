const fs = require('fs');
let code = fs.readFileSync('node_modules/dashclaw/dashclaw.js', 'utf8');
// Make _request not throw on errors, just return empty
code = code.replace("throw error;", "console.log('DashClaw API error (non-fatal):', error.message); return {};");
fs.writeFileSync('node_modules/dashclaw/dashclaw.js', code);
console.log('DashClaw SDK patched to not throw');