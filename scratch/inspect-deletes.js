const fs = require('fs');
const path = require('path');

const mockApiPath = path.resolve(__dirname, '../src/services/mockApi.ts');
const content = fs.readFileSync(mockApiPath, 'utf-8');
const lines = content.split('\n');

console.log("Lines 17400 to 20500 search for delete or remove methods:");
for (let i = 17399; i < Math.min(lines.length, 20500); i++) {
  const line = lines[i];
  if (line.includes('delete') || line.includes('remove') || line.includes('Delete') || line.includes('Remove')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
