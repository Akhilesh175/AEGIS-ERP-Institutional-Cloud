import * as fs from 'fs';
import * as path from 'path';

const loadEnv = (fileName: string) => {
  const filePath = path.resolve(process.cwd(), fileName);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        let val = parts.slice(1).join('=').trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        if (val) {
          process.env[key] = val;
        }
      }
    });
  }
};

loadEnv('.env.production');
loadEnv('.env.local');
loadEnv('.env'); // Load base .env last so it acts as fallback if not set by others


