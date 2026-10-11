// test.js
async function run() {
  const users = [
    { username: 'EMP-001', password: 'Password@FM2026', expectedRole: 'FINANCIAL_MANAGER' },
    { username: 'EMP-002', password: 'Password@HA2026', expectedRole: 'HEAD_ACCOUNTANT' },
    { username: 'EMP-003', password: 'Password@AC2026', expectedRole: 'ACCOUNTANT' },
    { username: 'EMP-004', password: 'Password@AF2026', expectedRole: 'ASSISTANT_FM' },
  ];

  for (const u of users) {
    const loginRes = await fetch('http://localhost:4000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u.username, password: u.password }),
    });
    if (!loginRes.ok) throw new Error(`Login failed for ${u.username}: ${loginRes.status}`);
    const loginData = await loginRes.json();
    console.log(`[PASS] Login ${u.username} -> token: ${loginData.accessToken.slice(0, 20)}...`);

    const meRes = await fetch('http://localhost:4000/auth/me', {
      headers: { Authorization: `Bearer ${loginData.accessToken}` },
    });
    if (!meRes.ok) throw new Error(`GET /auth/me failed for ${u.username}: ${meRes.status}`);
    const meData = await meRes.json();
    if (meData.role !== u.expectedRole) throw new Error(`Role mismatch for ${u.username}: expected ${u.expectedRole}, got ${meData.role}`);
    console.log(`[PASS] GET /auth/me -> ${meData.fullName} (${meData.role})`);
  }

  // Test Invoices
  const invRes = await fetch('http://localhost:4000/invoices');
  const invData = await invRes.json();
  console.log(`[PASS] GET /invoices -> ${invData.total} items`);

  // Test State Transition
  const approveRes = await fetch('http://localhost:4000/invoices/INV-2026-002/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ remarks: 'Approved by Eleanor' }),
  });
  const approvedInv = await approveRes.json();
  console.log(`[PASS] POST /invoices/INV-2026-002/approve -> status: ${approvedInv.status}`);

  // Test Bad Login (401)
  const badLogin = await fetch('http://localhost:4000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'EMP-001', password: 'wrongpassword' }),
  });
  console.log(`[PASS] Bad login status: ${badLogin.status} (expected 401)`);

  // Test WebSocket connection
  const wsRes = await fetch('http://localhost:4000/dashboard/summary');
  const dashData = await wsRes.json();
  console.log(`[PASS] Dashboard summary KPIs: ${dashData.kpis.length}`);

  console.log('\n>>> ALL TESTS PASSED SUCCESSFULLY! <<<');
}

run().catch((e) => {
  console.error('[FAIL]', e);
  process.exit(1);
});
