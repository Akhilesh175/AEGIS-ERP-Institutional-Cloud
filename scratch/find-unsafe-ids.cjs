const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/portals/ParentPortal.tsx');
const content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  const lineNum = index + 1;
  // Match any word boundary followed by dot and id, but NOT preceded by question mark dot
  // E.g. student.id matches, student?.id does not.
  const regex = /\b\w+\.id\b/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    // Check if the character before the match is '?'
    const matchIndex = match.index;
    const isSafe = matchIndex > 0 && line[matchIndex - 1] === '?';
    if (!isSafe) {
      console.log(`Line ${lineNum}: ${line.trim()}`);
    }
  }
});
