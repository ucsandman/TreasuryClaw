const fs = require('fs');
let code = fs.readFileSync('src/demo.js', 'utf8');
code = code.replace("await dc.createHandoff({", "try { await dc.createHandoff({");
code = code.replace("  });", "  }); } catch(e) { console.log('DashClaw handoff failed'); }");
fs.writeFileSync('src/demo.js', code);