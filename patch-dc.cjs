const fs = require('fs');
let code = fs.readFileSync('node_modules/dashclaw/dashclaw.js', 'utf8');
code = code.replace("const data = await res.json();", "const text = await res.text(); let data={}; try { data = JSON.parse(text); } catch(e) { console.log('DashClaw error HTML', res.status); }");
fs.writeFileSync('node_modules/dashclaw/dashclaw.js', code);