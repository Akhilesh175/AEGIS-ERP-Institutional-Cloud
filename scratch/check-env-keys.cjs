const fs = require('fs');
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  console.log("Keys in .env:");
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 1 && parts[0].trim()) {
      console.log("- " + parts[0].trim());
    }
  });
} catch (e) {
  console.error("Failed to read .env:", e.message);
}
