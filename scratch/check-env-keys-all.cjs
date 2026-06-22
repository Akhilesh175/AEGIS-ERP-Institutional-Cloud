const fs = require('fs');
['.env.local', '.env.production'].forEach(file => {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf-8');
      console.log(`\nKeys in ${file}:`);
      content.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 1 && parts[0].trim()) {
          console.log("- " + parts[0].trim());
        }
      });
    }
  } catch (e) {
    console.error(`Failed to read ${file}:`, e.message);
  }
});
