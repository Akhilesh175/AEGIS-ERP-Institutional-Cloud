// Mock localStorage
const mockStorage: any = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; }
};

async function run() {
  const { mockApi } = await import('../src/services/mockApi');
  console.log('--- Simulating admin login ---');
  try {
    const session = await mockApi.login('jp@gmail.com', 'Password123!');
    console.log('Returned session:', JSON.stringify(session, null, 2));
  } catch (err: any) {
    console.error('Login error:', err.message);
  }
}

run().catch(console.error);
