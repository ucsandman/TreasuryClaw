const fs = require('fs');
let code = fs.readFileSync('src/demo.js', 'utf8');
code = code.replace(/await dc\.createHandoff\(\{[\s\S]*?\}\);/, "// dc.createHandoff skipped due to 404");
fs.writeFileSync('src/demo.js', code);