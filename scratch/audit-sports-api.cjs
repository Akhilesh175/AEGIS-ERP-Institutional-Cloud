const fs = require('fs');
const path = require('path');

const mockApiPath = path.resolve(__dirname, '../src/services/mockApi.ts');
const content = fs.readFileSync(mockApiPath, 'utf-8');
const lines = content.split('\n');

const sportsFunctions = [];
let currentFunc = null;

// Scan lines 17400 to 20527
for (let i = 17399; i < Math.min(lines.length, 20527); i++) {
  const line = lines[i];
  // Simple regex to match function declarations
  const funcMatch = line.match(/^\s*(async\s+)?(\w+)\s*\(([^)]*)\)\s*:\s*Promise<([^>]+)?>\s*\{/);
  if (funcMatch) {
    if (currentFunc) {
      sportsFunctions.push(currentFunc);
    }
    currentFunc = {
      name: funcMatch[2],
      args: funcMatch[3],
      returnType: funcMatch[4],
      startLine: i + 1,
      body: [],
      hasSupabaseInsert: false,
      hasSupabaseUpdate: false,
      hasSupabaseDelete: false,
      hasSupabaseSelect: false,
      tablesReferenced: new Set()
    };
  }
  if (currentFunc) {
    currentFunc.body.push(line);
    if (line.includes('insert(') || line.includes('.insert(')) currentFunc.hasSupabaseInsert = true;
    if (line.includes('update(') || line.includes('.update(')) currentFunc.hasSupabaseUpdate = true;
    if (line.includes('delete(') || line.includes('.delete(') || line.includes('.delete()')) currentFunc.hasSupabaseDelete = true;
    if (line.includes('select(') || line.includes('.select(')) currentFunc.hasSupabaseSelect = true;
    if (line.includes('upsert(') || line.includes('.upsert(')) {
      currentFunc.hasSupabaseInsert = true;
      currentFunc.hasSupabaseUpdate = true;
    }
    
    // Find references to tables
    const tableMatch = line.match(/\.from\(['"]([^'"]+)['"]\)/);
    if (tableMatch) {
      currentFunc.tablesReferenced.add(tableMatch[1]);
    }
  }
}
if (currentFunc) {
  sportsFunctions.push(currentFunc);
}

const logStream = fs.createWriteStream(path.resolve(__dirname, 'full-sports-api-audit.txt'));
logStream.write(`Audited ${sportsFunctions.length} sports functions in mockApi.ts:\n`);
sportsFunctions.forEach(f => {
  logStream.write(`\n- Function: ${f.name}(${f.args})\n`);
  logStream.write(`  Lines: ${f.startLine} to ${f.startLine + f.body.length - 1}\n`);
  logStream.write(`  Tables: ${Array.from(f.tablesReferenced).join(', ') || 'None'}\n`);
  logStream.write(`  Operations: Select:${f.hasSupabaseSelect}, Insert:${f.hasSupabaseInsert}, Update:${f.hasSupabaseUpdate}, Delete:${f.hasSupabaseDelete}\n`);
});
logStream.end();
console.log("Written audit results to scratch/full-sports-api-audit.txt");
