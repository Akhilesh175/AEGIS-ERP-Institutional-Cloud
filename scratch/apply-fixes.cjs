const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/components/SportsManagement.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// Replacement 1: Linked Student dropdown styling and select options
const target1 = `            {portalRole === 'PARENT' && parentLinkedStudents.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 font-mono">Linked Student:</label>
                <select
                  value={studentProfileId}
                  onChange={(e) => setStudentProfileId(e.target.value)}
                  className="px-3 py-2 bg-slate-905 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  {parentLinkedStudents.map(std => (
                    <option key={std.id} value={std.id}>
                      {std.users ? \`\${std.users.first_name} \${std.users.last_name}\` : 'Unknown student'}
                    </option>
                  ))}
                </select>
              </div>
            )}`;

const replacement1 = `            {portalRole === 'PARENT' && parentLinkedStudents.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 font-mono">Linked Student:</label>
                <select
                  value={studentProfileId}
                  onChange={(e) => setStudentProfileId(e.target.value)}
                  style={{ backgroundColor: '#0b101d', color: '#ffffff', borderColor: '#1e293b' }}
                  className="px-3 py-2 border rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 [&>option]:bg-[#0b101d] [&>option]:text-white"
                >
                  {parentLinkedStudents.map(std => (
                    <option key={std.id} value={std.id} style={{ backgroundColor: '#0b101d', color: '#ffffff' }}>
                      {std.users ? \`\${std.users.first_name} \${std.users.last_name}\` : 'Unknown student'}
                    </option>
                  ))}
                </select>
              </div>
            )}`;

// Replacement 3: Sports Fee Payments Queue action buttons
const target3 = `                         <td className="py-3 px-4 flex gap-2">
                          {portalRole === 'FINANCE_ADMIN' ? (
                            <>`;

const replacement3 = `                         <td className="py-3 px-4 flex gap-2">
                          {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SCHOOL_ADMIN'].includes(portalRole) ? (
                            <>`;

if (!content.includes(target1)) {
  console.error("Error: Target 1 not found!");
  process.exit(1);
}
if (!content.includes(target3)) {
  console.error("Error: Target 3 not found!");
  process.exit(1);
}

content = content.replace(target1, replacement1);
content = content.replace(target3, replacement3);

// Replace Target 2 (status span) - handle template literal formatting
const target2Alternative = `                          <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full \${
                            pmt?.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-550'
                          }\`}>{pmt?.status || 'UNPAID'}</span>`;

const replacement2Alternative = `                          <span className={\`text-[10px] font-bold px-2 py-0.5 rounded-full \${
                            pmt?.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                            pmt?.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                            pmt?.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-800 text-slate-400'
                          }\`}>{
                            pmt?.status === 'APPROVED' ? 'PAID' :
                            pmt?.status === 'PENDING' ? 'PENDING_VERIFICATION' :
                            pmt?.status || 'UNPAID'
                          }</span>`;

if (content.includes(target2Alternative)) {
  content = content.replace(target2Alternative, replacement2Alternative);
} else {
  console.log("Warning: Target 2 not found (might have been replaced already).");
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Successfully applied all fixes to SportsManagement.tsx!");
