const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.html') || fullPath.endsWith('.js')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content
        .replace(/href="\/register\.html"/g, 'href="/register"')
        .replace(/href="\/feedback\.html"/g, 'href="/feedback"')
        .replace(/href="\/GSA\.html"/g, 'href="/GSA"')
        .replace(/\/register\.html\?/g, '/register?')
        .replace(/\/feedback\.html\?/g, '/feedback?');
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
}

walk(publicDir);
console.log('Done replacement');
