const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/portals/AdminPortal.tsx');
const content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
let curly = 0;
let paren = 0;
let angle = 0; // for JSX elements if needed

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Simple scan ignoring strings and comments (basic approximation)
  let cleanLine = line;
  // remove string literals
  cleanLine = cleanLine.replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, '""');
  cleanLine = cleanLine.replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, "''");
  cleanLine = cleanLine.replace(/`[^`\\]*(?:\\.[`\\]*)*`/g, "``");
  // remove single line comments
  cleanLine = cleanLine.replace(/\/\/.*$/, '');
  
  for (let j = 0; j < cleanLine.length; j++) {
    const char = cleanLine[j];
    if (char === '{') curly++;
    else if (char === '}') curly--;
    else if (char === '(') paren++;
    else if (char === ')') paren--;
    
    if (curly < 0) {
      console.log(`Extra } found at line ${i + 1}:${j + 1}`);
      curly = 0;
    }
    if (paren < 0) {
      console.log(`Extra ) found at line ${i + 1}:${j + 1}`);
      paren = 0;
    }
  }
}

console.log(`Finished scan. Final count - Curly: ${curly}, Paren: ${paren}`);
