const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/components/SportsManagement.tsx');
const content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');
for (let i = 3105; i < 3125; i++) {
  console.log(`${i + 1}: ${JSON.stringify(lines[i])}`);
}
