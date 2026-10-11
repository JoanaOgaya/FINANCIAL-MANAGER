/**
 * mock-api/server.js
 * Standalone mock API server for UI testing across all 4 roles.
 * Supports in-memory CRUD, state transitions, search/sort/filter/pagination,
 * WebSocket real-time updates, and flags: --empty, --fail.
 *
 * Runs completely outside src/. Zero external npm dependencies required (native Node.js).
 */

import http from 'node:http';
import url from 'node:url';
import crypto from 'node:crypto';
import { createSeedData } from './seedData.js';

const PORT = Number(process.env.PORT) || 4000;
const isEmptyMode = process.argv.includes('--empty');
const isFailMode = process.argv.includes('--fail');

console.log('='.repeat(60));
console.log(' FOMS Standalone Mock API Server');
console.log(` Mode: ${isFailMode ? 'FAIL (502 Bad Gateway)' : isEmptyMode ? 'EMPTY (0 records)' : 'SEEDED (realistic data)'}`);
console.log(` Port: ${PORT}`);
console.log('='.repeat(60));

// ── In-Memory Store Initialization ──────────────────────────────────────────
const rawSeed = createSeedData();

const store = {
  users: [...rawSeed.users],
  clients: isEmptyMode ? [] : [...rawSeed.clients],
  billingRates: isEmptyMode ? [] : [...rawSeed.billingRates],
  billingRecords: isEmptyMode ? [] : [...rawSeed.billingRecords],
  waybills: isEmptyMode ? [] : [...rawSeed.waybills],
  invoices: isEmptyMode ? [] : [...rawSeed.invoices],
  payments: isEmptyMode ? [] : [...rawSeed.payments],
  receipts: isEmptyMode ? [] : [...rawSeed.receipts],
  arRecords: isEmptyMode ? [] : [...rawSeed.arRecords],
  followUps: isEmptyMode ? [] : [...rawSeed.followUps],
  aiCollectionRecommendations: isEmptyMode ? [] : [...rawSeed.aiCollectionRecommendations],
  aiDuplicates: isEmptyMode ? [] : [...rawSeed.aiDuplicates],
  uniqueDocuments: isEmptyMode ? [] : [...rawSeed.uniqueDocuments],
  reviewHistory: isEmptyMode ? [] : [...rawSeed.reviewHistory],
  liquidations: isEmptyMode ? [] : [...rawSeed.liquidations],
  cashFlowRecords: isEmptyMode ? [] : [...rawSeed.cashFlowRecords],
  settlements: isEmptyMode ? [] : [...rawSeed.settlements],
  adjustments: isEmptyMode ? [] : [...rawSeed.adjustments],
  speedpaySubmissions: isEmptyMode ? [] : [...rawSeed.speedpaySubmissions],
  reports: isEmptyMode ? [] : [...rawSeed.reports],
  auditLogs: isEmptyMode ? [] : [...rawSeed.auditLogs],
  notifications: isEmptyMode ? [] : [...rawSeed.notifications],
  aiDocuments: isEmptyMode ? [] : [
    {
      id: 'DOC-2026-001',
      fileName: 'Express_Billing_INV901.pdf',
      fileSize: 142850,
      docType: 'invoice',
      status: 'extracted',
      overallConfidence: 94,
      uploadedAt: new Date(Date.now() - 3600000).toISOString(),
      uploadedBy: 'Clara Oswald',
      fields: [
        { fieldName: 'invoiceNumber', label: 'Invoice Number', extractedValue: 'INV-2026-901', confidence: 99, isLowConfidence: false },
        { fieldName: 'clientName', label: 'Client Name', extractedValue: 'FastTrack Logistics Corp', confidence: 96, isLowConfidence: false },
        { fieldName: 'totalAmount', label: 'Total Amount (PHP)', extractedValue: '54200.00', confidence: 92, isLowConfidence: false },
        { fieldName: 'tinNumber', label: 'Client TIN', extractedValue: '004-912-381-000', confidence: 64, isLowConfidence: true, warning: 'Confidence is below 70% threshold' },
        { fieldName: 'billingDate', label: 'Billing Date', extractedValue: '2026-03-01', confidence: 95, isLowConfidence: false },
      ],
      completeness: [
        { name: 'Company Letterhead / Header', present: true, notes: 'Clear Speedex Header Present' },
        { name: 'Official Client Details', present: true, notes: 'Matches FOMS Client Directory' },
        { name: 'Authorized Signatory', present: true, notes: 'Signature line verified' },
        { name: 'Tax / TIN Identifier', present: false, notes: 'TIN field low contrast / blurred' },
      ],
    },
  ],
  aiOutputs: isEmptyMode ? [] : [
    {
      id: 'AIO-001',
      module: 'receivable_risk',
      modelName: 'Speedex Risk Scoring Engine',
      modelVersion: 'v2.4-risk-matrix',
      generatedAt: new Date(Date.now() - 7200000).toISOString(),
      triggeredBy: 'Clara Oswald',
      inputSummary: 'Invoice INV-2026-004 aging analysis (57,200 PHP, 38 days overdue)',
      outputSummary: 'High Delinquency Probability (Score: 82). Factor: Days past due + historical delay.',
      confidence: 89,
      status: 'pending_validation',
      requiresValidation: true,
      humanReview: {
        action: 'pending',
      },
    },
    {
      id: 'AIO-002',
      module: 'document_extraction',
      modelName: 'Speedex OCR Intelligence',
      modelVersion: 'v1.8-vision-ocr',
      generatedAt: new Date(Date.now() - 3600000).toISOString(),
      triggeredBy: 'Clara Oswald',
      inputSummary: 'Express_Billing_INV901.pdf (Invoice)',
      outputSummary: 'Extracted 5 fields with 94% overall confidence. 1 field flagged low confidence (TIN).',
      confidence: 94,
      status: 'pending_validation',
      requiresValidation: true,
      humanReview: {
        action: 'pending',
      },
    },
    {
      id: 'AIO-003',
      module: 'duplicate_detection',
      modelName: 'Speedex Duplicate Vector Matcher',
      modelVersion: 'v3.1-embedding',
      generatedAt: new Date(Date.now() - 86400000).toISOString(),
      triggeredBy: 'Miles Morales',
      inputSummary: 'Waybill WB-1004 vs Archive',
      outputSummary: 'Flagged potential duplicate with WB-1002 (96% similarity)',
      confidence: 96,
      status: 'reviewed',
      requiresValidation: true,
      humanReview: {
        action: 'confirmed',
        reviewedBy: 'Arthur Pendelton',
        reviewedAt: new Date(Date.now() - 43200000).toISOString(),
        remarks: 'Duplicate delivery confirmation detected.',
      },
    },
  ],
};

// ── Active Sessions Store ───────────────────────────────────────────────────
const sessions = new Map(); // token -> user

// ── WebSocket Clients ───────────────────────────────────────────────────────
const wsClients = new Set();
const sseClients = new Set();

function broadcastEvent(topic = '*') {
  const payload = JSON.stringify({ topic, timestamp: new Date().toISOString() });
  
  // Broadcast to WebSockets
  const frame = makeWsFrame(payload);
  for (const client of wsClients) {
    try {
      if (client.writable) client.write(frame);
    } catch {
      wsClients.delete(client);
    }
  }

  // Broadcast to SSE
  const sseMsg = `data: ${payload}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(sseMsg);
    } catch {
      sseClients.delete(res);
    }
  }
}

function makeWsFrame(payloadStr) {
  const payload = Buffer.from(payloadStr);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

// ── Helper: Audit Log Emitter ──────────────────────────────────────────────
function recordAudit(user, action, module, recordId, recordType, details) {
  const log = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    userId: user?.id || 'EMP-SYSTEM',
    userFullName: user?.fullName || 'System User',
    userRole: user?.role || 'SYSTEM',
    action,
    module,
    recordId: String(recordId || ''),
    recordType: String(recordType || ''),
    details: String(details || ''),
    ipAddress: '127.0.0.1',
  };
  store.auditLogs.unshift(log);
  broadcastEvent('auditLogs');
}

// ── Helper: Query Filter / Sorter / Paginator ───────────────────────────────
function filterAndPaginate(list, query) {
  let items = [...list];

  // 1. Search filter
  if (query.search) {
    const q = String(query.search).toLowerCase();
    items = items.filter((item) =>
      Object.values(item).some((val) => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(q);
        }
        return false;
      }),
    );
  }

  // 2. Status filter
  if (query.status && query.status !== 'all' && query.status !== 'All') {
    const st = String(query.status).toLowerCase();
    items = items.filter((item) => item.status && String(item.status).toLowerCase() === st);
  }

  // 3. Client filter
  if (query.clientId) {
    items = items.filter((item) => item.clientId === query.clientId);
  }

  // 4. Sorting
  if (query.sortBy) {
    const dir = query.sortDir === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      const va = a[query.sortBy];
      const vb = b[query.sortBy];
      if (va === vb) return 0;
      if (va === undefined || va === null) return 1;
      if (vb === undefined || vb === null) return -1;
      return va > vb ? dir : -dir;
    });
  }

  const total = items.length;

  // 5. Pagination
  if (query.page !== undefined || query.pageSize !== undefined) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.max(1, Number(query.pageSize) || 10);
    const start = (page - 1) * pageSize;
    items = items.slice(start, start + pageSize);
  }

  return { items, total };
}

// ── Request Body Parser ─────────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({ raw: body });
      }
    });
  });
}

// ── JSON Response Helper ────────────────────────────────────────────────────
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

// ── Auth Token Extractor ────────────────────────────────────────────────────
function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return sessions.get(token) || null;
}

// ── HTTP Request Router ─────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Check Fail Mode
  if (isFailMode) {
    return sendJson(res, 502, { message: '502 Bad Gateway: Simulated error mode (--fail)' });
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Transparently normalize /api prefix
  if (pathname.startsWith('/api/')) {
    pathname = pathname.slice(4);
  } else if (pathname === '/api') {
    pathname = '/';
  }

  const method = req.method;
  const body = method !== 'GET' && method !== 'HEAD' ? await parseBody(req) : {};
  const currentUser = getAuthUser(req);

  // ── SSE Endpoint ──────────────────────────────────────────────────────────
  if (pathname === '/events' || pathname === '/realtime/sse') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('data: {"topic":"connected"}\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── Authentication Endpoints ──────────────────────────────────────────────
  if (pathname === '/auth/login' && method === 'POST') {
    const identifier = String(body.identifier || body.username || body.employeeId || '').trim().toLowerCase();
    const password = String(body.password || '');

    const found = store.users.find((u) => {
      const matchId = u.id.toLowerCase() === identifier;
      const matchUsername = u.username && u.username.toLowerCase() === identifier;
      const matchRole = u.role.toLowerCase() === identifier;
      return (matchId || matchUsername || matchRole) && u.password === password;
    });

    const client = store.clients.find((c) =>
      c.id.toLowerCase() === identifier || (c.email && c.email.toLowerCase() === identifier) || (c.clientCode && c.clientCode.toLowerCase() === identifier)
    ) || (identifier ? { id: identifier, name: identifier, email: identifier, contactPerson: identifier } : null);

    if (!found && !client) {
      return sendJson(res, 401, { message: 'Invalid login details' });
    }

    const activeUser = found || {
      id: client.id,
      fullName: client.contactPerson || client.name,
      role: 'CLIENT',
      email: client.email,
    };

    const accessToken = `mock-token-${activeUser.id}-${Date.now()}`;
    const refreshToken = `mock-refresh-${activeUser.id}-${Date.now()}`;
    sessions.set(accessToken, activeUser);

    if (found) {
      recordAudit(found, 'User Login', 'Authentication', found.id, 'User', `Logged in successfully as ${found.role}`);
    }
    return sendJson(res, 200, { accessToken, refreshToken, client });
  }

  if (pathname === '/auth/me' && method === 'GET') {
    if (!currentUser) {
      return sendJson(res, 401, { message: 'Unauthorized: Session invalid or expired' });
    }
    return sendJson(res, 200, {
      id: currentUser.id,
      fullName: currentUser.fullName,
      role: currentUser.role,
      email: currentUser.email,
    });
  }

  if (pathname === '/auth/logout' && method === 'POST') {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      sessions.delete(token);
    }
    return sendJson(res, 200, { message: 'Logged out successfully' });
  }

  // ── Dashboard Endpoints ───────────────────────────────────────────────────
  if (pathname === '/dashboard/nav-badges' && method === 'GET') {
    const pendingInvoices = store.invoices.filter((i) => i.status === 'Pending Approval').length;
    const reviewInvoices = store.invoices.filter((i) => i.status === 'Needs Revision' || i.status === 'Pending Approval').length;
    const pendingPayments = store.payments.filter((p) => p.status === 'Pending Validation').length;
    const pendingLiquidations = store.liquidations.filter((l) => l.status === 'Pending Validation').length;
    const pendingSettlements = store.settlements.filter((s) => s.status === 'For validation').length;
    const pendingSpeedpay = store.speedpaySubmissions.filter((s) => s.status === 'Pending Validation').length;
    let flaggedDuplicates = 0;
    if (currentUser?.role === 'ACCOUNTANT') {
      flaggedDuplicates = store.aiDuplicates.filter((d) => d.status === 'FLAGGED' || d.status === 'RETURNED' || d.status === 'Pending Review').length;
    } else if (currentUser?.role === 'HEAD_ACCOUNTANT') {
      flaggedDuplicates = store.aiDuplicates.filter((d) => d.status === 'PENDING_REVIEW' || d.status === 'Pending Review').length;
    } else {
      flaggedDuplicates = store.aiDuplicates.length;
    }

    return sendJson(res, 200, {
      invoicingDesk: pendingInvoices,
      invoiceReview: reviewInvoices,
      billingValidation: store.billingRecords.filter((b) => b.status === 'Pending Review').length,
      payments: pendingPayments,
      settlements: pendingSettlements,
      liquidations: pendingLiquidations,
      speedpayValidation: pendingSpeedpay,
      flaggedDuplicates,
      forReview: store.aiCollectionRecommendations.filter((r) => r.review_status === 'Pending Review').length,
    });
  }

  if (pathname === '/dashboard/summary' && method === 'GET') {
    const totalRevenue = store.invoices
      .filter((i) => i.status === 'Paid')
      .reduce((sum, i) => sum + (i.totalAmount || 0), 0);
    const outstandingAR = store.arRecords.reduce((sum, r) => sum + (r.outstandingBalance || 0), 0);
    const pendingApprovalCount = store.invoices.filter((i) => i.status === 'Pending Approval').length;
    const overdueCount = store.invoices.filter((i) => i.status === 'Overdue').length;

    const summary = {
      headline: 'Financial Operations Executive Summary',
      kpis: [
        { key: 'total_revenue', label: 'Collected Revenue', value: totalRevenue, format: 'currency', variant: 'teal', trend: 8.5 },
        { key: 'outstanding_ar', label: 'Outstanding Receivables', value: outstandingAR, format: 'currency', variant: 'warning', trend: -2.4 },
        { key: 'pending_invoices', label: 'Pending Invoice Approvals', value: pendingApprovalCount, format: 'number', variant: 'info', trend: null },
        { key: 'overdue_invoices', label: 'Overdue Accounts', value: overdueCount, format: 'number', variant: 'danger', trend: 1.2 },
      ],
      attention: [
        ...(pendingApprovalCount > 0 ? [{ id: 'ATTN-01', severity: 'warning', title: `${pendingApprovalCount} Invoices require approval`, path: '/invoicing-desk' }] : []),
        ...(overdueCount > 0 ? [{ id: 'ATTN-02', severity: 'danger', title: `${overdueCount} Accounts are overdue for collection`, path: '/accounts-receivable' }] : []),
      ],
      topClients: store.clients.slice(0, 5).map((c) => ({
        id: c.id,
        name: c.name,
        amount: store.invoices.filter((i) => i.clientId === c.id).reduce((s, i) => s + (i.totalAmount || 0), 0) || 50000,
      })),
      agingBuckets: [
        { label: 'Current', value: store.arRecords.filter((r) => r.agingBracket === 'Current').reduce((s, r) => s + r.outstandingBalance, 0) },
        { label: '0-30 days', value: store.arRecords.filter((r) => r.agingBracket === '0-30 days').reduce((s, r) => s + r.outstandingBalance, 0) },
        { label: '31-60 days', value: store.arRecords.filter((r) => r.agingBracket === '31-60 days').reduce((s, r) => s + r.outstandingBalance, 0) },
        { label: '61-90 days', value: store.arRecords.filter((r) => r.agingBracket === '61-90 days').reduce((s, r) => s + r.outstandingBalance, 0) },
        { label: '90+ days', value: store.arRecords.filter((r) => r.agingBracket === '90+ days').reduce((s, r) => s + r.outstandingBalance, 0) },
      ],
      cashFlowTrend: [
        { period: 'Jan', inflow: 14850, outflow: 3200 },
        { period: 'Feb', inflow: 22000, outflow: 8500 },
        { period: 'Mar', inflow: 31000, outflow: 11200 },
      ],
      statusTrend: [
        { period: 'W1', validated: 12, pending: 4, returned: 1 },
        { period: 'W2', validated: 18, pending: 3, returned: 0 },
        { period: 'W3', validated: 24, pending: 6, returned: 2 },
      ],
      duplicateDistribution: [
        { label: 'Exact Match', value: store.aiDuplicates.filter((d) => d.confidence_score >= 95).length },
        { label: 'Partial Match', value: store.aiDuplicates.filter((d) => d.confidence_score < 95).length },
      ],
      recentActivity: store.auditLogs.slice(0, 10),
    };

    return sendJson(res, 200, summary);
  }

  // ── Invoices Endpoints ────────────────────────────────────────────────────
  if (pathname === '/invoices' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.invoices, query));
  }
  if (pathname === '/invoices' && method === 'POST') {
    const newInvoice = {
      id: `INV-2026-${String(store.invoices.length + 1).padStart(3, '0')}`,
      invoiceNumber: `INV-2026-${String(store.invoices.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.fullName || 'Clara Oswald',
      status: 'Pending Approval',
      paymentStatus: 'Unpaid',
      waybills: [],
      ...body,
    };
    store.invoices.unshift(newInvoice);
    recordAudit(currentUser, 'Created Invoice', 'Invoices', newInvoice.id, 'Invoice', `Created invoice ${newInvoice.invoiceNumber}`);
    broadcastEvent('invoices');
    return sendJson(res, 201, newInvoice);
  }

  const invoiceActionMatch = pathname.match(/^\/invoices\/([^/]+)\/(submit|verify|return|approve|reject)$/);
  if (invoiceActionMatch && method === 'POST') {
    const [, id, action] = invoiceActionMatch;
    const inv = store.invoices.find((i) => i.id === id || i.invoiceNumber === id);
    if (!inv) return sendJson(res, 404, { message: 'Invoice not found' });

    if (action === 'submit') inv.status = 'Pending Approval';
    else if (action === 'verify') inv.status = 'Approved';
    else if (action === 'approve') { inv.status = 'Approved'; inv.approvedBy = currentUser?.fullName || 'Eleanor Vance'; inv.approvedAt = new Date().toISOString(); }
    else if (action === 'return') { inv.status = 'Needs Revision'; inv.notes = body.remarks || 'Returned for revisions'; }
    else if (action === 'reject') { inv.status = 'Needs Revision'; inv.notes = body.remarks || 'Rejected by manager'; }

    recordAudit(currentUser, `${action.toUpperCase()} Invoice`, 'Invoices', inv.id, 'Invoice', `Action ${action} executed with remarks: ${body.remarks || 'None'}`);
    broadcastEvent('invoices');
    return sendJson(res, 200, inv);
  }

  const invoiceIdMatch = pathname.match(/^\/invoices\/([^/]+)$/);
  if (invoiceIdMatch) {
    const id = invoiceIdMatch[1];
    const index = store.invoices.findIndex((i) => i.id === id || i.invoiceNumber === id);
    if (method === 'GET') {
      if (index === -1) return sendJson(res, 404, { message: 'Invoice not found' });
      return sendJson(res, 200, store.invoices[index]);
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (index === -1) return sendJson(res, 404, { message: 'Invoice not found' });
      store.invoices[index] = { ...store.invoices[index], ...body };
      recordAudit(currentUser, 'Updated Invoice', 'Invoices', id, 'Invoice', `Updated invoice ${id}`);
      broadcastEvent('invoices');
      return sendJson(res, 200, store.invoices[index]);
    }
    if (method === 'DELETE') {
      if (index === -1) return sendJson(res, 404, { message: 'Invoice not found' });
      store.invoices.splice(index, 1);
      recordAudit(currentUser, 'Deleted Invoice', 'Invoices', id, 'Invoice', `Removed invoice ${id}`);
      broadcastEvent('invoices');
      return sendJson(res, 200, { success: true });
    }
  }

  // ── Payments & Receipts Endpoints ─────────────────────────────────────────
  if (pathname === '/payments' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.payments, query));
  }
  if (pathname === '/payments' && method === 'POST') {
    const newPayment = {
      id: `PAY-${String(store.payments.length + 1).padStart(3, '0')}`,
      recordedAt: new Date().toISOString(),
      recordedBy: currentUser?.fullName || 'Clara Oswald',
      status: 'Pending Validation',
      ...body,
    };
    store.payments.unshift(newPayment);
    recordAudit(currentUser, 'Recorded Payment', 'Payments', newPayment.id, 'Payment', `Recorded payment of ₱${newPayment.amount}`);
    broadcastEvent('payments');
    return sendJson(res, 201, newPayment);
  }

  const paymentActionMatch = pathname.match(/^\/payments\/([^/]+)\/(verify|approve|reject|return)$/);
  if (paymentActionMatch && method === 'POST') {
    const [, id, action] = paymentActionMatch;
    const payment = store.payments.find((p) => p.id === id);
    if (!payment) return sendJson(res, 404, { message: 'Payment not found' });

    if (action === 'verify') { payment.status = 'Validated'; payment.validatedBy = currentUser?.fullName; payment.validatedAt = new Date().toISOString(); }
    else if (action === 'approve') { payment.status = 'Approved'; }
    else if (action === 'reject') { payment.status = 'Rejected'; }
    else if (action === 'return') { payment.status = 'Pending Validation'; }

    recordAudit(currentUser, `${action.toUpperCase()} Payment`, 'Payments', payment.id, 'Payment', `Action ${action} on payment ${id}`);
    broadcastEvent('payments');
    return sendJson(res, 200, payment);
  }

  const paymentIdMatch = pathname.match(/^\/payments\/([^/]+)$/);
  if (paymentIdMatch) {
    const id = paymentIdMatch[1];
    const index = store.payments.findIndex((p) => p.id === id);
    if (method === 'GET') {
      if (index === -1) return sendJson(res, 404, { message: 'Payment not found' });
      return sendJson(res, 200, store.payments[index]);
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (index === -1) return sendJson(res, 404, { message: 'Payment not found' });
      store.payments[index] = { ...store.payments[index], ...body };
      broadcastEvent('payments');
      return sendJson(res, 200, store.payments[index]);
    }
  }

  if (pathname === '/official-receipts' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.receipts, query));
  }
  if (pathname === '/official-receipts' && method === 'POST') {
    const newReceipt = {
      id: `OR-2026-${String(store.receipts.length + 1).padStart(3, '0')}`,
      receiptNumber: `OR-2026-${String(store.receipts.length + 1).padStart(3, '0')}`,
      issuedAt: new Date().toISOString(),
      issuedBy: currentUser?.fullName || 'Arthur Pendelton',
      status: 'Issued',
      ...body,
    };
    store.receipts.unshift(newReceipt);
    broadcastEvent('receipts');
    return sendJson(res, 201, newReceipt);
  }

  // ── Accounts Receivable Endpoints ─────────────────────────────────────────
  if (pathname === '/ar/records' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.arRecords, query));
  }
  if (pathname === '/ar/aging' && method === 'GET') {
    const aging = [
      { label: 'Current', value: store.arRecords.filter((r) => r.agingBracket === 'Current').reduce((s, r) => s + r.outstandingBalance, 0) },
      { label: '0-30 days', value: store.arRecords.filter((r) => r.agingBracket === '0-30 days').reduce((s, r) => s + r.outstandingBalance, 0) },
      { label: '31-60 days', value: store.arRecords.filter((r) => r.agingBracket === '31-60 days').reduce((s, r) => s + r.outstandingBalance, 0) },
      { label: '61-90 days', value: store.arRecords.filter((r) => r.agingBracket === '61-90 days').reduce((s, r) => s + r.outstandingBalance, 0) },
      { label: '90+ days', value: store.arRecords.filter((r) => r.agingBracket === '90+ days').reduce((s, r) => s + r.outstandingBalance, 0) },
    ];
    return sendJson(res, 200, aging);
  }
  if (pathname === '/ar/follow-ups' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.followUps, query));
  }
  if (pathname === '/ar/follow-ups' && method === 'POST') {
    const newFollowUp = {
      id: `FLW-${Date.now()}`,
      formInputs: {
        followUpTimestamp: new Date().toISOString(),
        authorizedUserLogged: currentUser?.fullName || 'Clara Oswald',
        ...body.formInputs,
      },
      referenceFields: body.referenceFields || {},
      ...body,
    };
    store.followUps.unshift(newFollowUp);
    recordAudit(currentUser, 'Logged AR Follow-up', 'Accounts Receivable', newFollowUp.id, 'FollowUp', 'Logged client communication');
    broadcastEvent('ar');
    return sendJson(res, 201, newFollowUp);
  }

  // ── AI Collection Recommendations Endpoints ───────────────────────────────
  if (pathname === '/ai/collection/recommendations' && method === 'GET') {
    return sendJson(res, 200, store.aiCollectionRecommendations);
  }
  if (pathname === '/ai/collection/priorities' && method === 'GET') {
    const prios = store.aiCollectionRecommendations.map((r) => ({
      ...r.priority,
      suggestedAction: r.recommended_action,
      riskScore: String(r.priority?.priority_level || '').includes('HIGH') ? 82 : 45,
      riskLevel: String(r.priority?.priority_level || '').includes('HIGH') ? 'HIGH' : 'MEDIUM',
    })).filter(Boolean);
    return sendJson(res, 200, { items: prios, total: prios.length });
  }
  if (pathname === '/ai/collection/recommendations/new' && method === 'POST') {
    const newRec = {
      id: `REC-${Date.now()}`,
      priority_id: body.priority_id,
      review_status: body.decision || 'Accept & Close',
      remarks: body.remarks || '',
      recommended_action: body.recommendedAction || '',
      reviewed_by: currentUser?.fullName || 'Eleanor Vance',
      reviewer_username: currentUser?.fullName || 'Eleanor Vance',
      reviewer_role: currentUser?.role || 'FINANCIAL_MANAGER',
      reviewed_at: new Date().toISOString(),
      priority: {
        id: body.priority_id || `PRIO-${Date.now()}`,
        priority_level: 'HIGH PRIORITY',
      },
    };
    store.aiCollectionRecommendations.unshift(newRec);
    recordAudit(currentUser, 'Submitted AI Priority', 'AI Collections', newRec.id, 'Recommendation', `Decision: ${body.decision}`);
    broadcastEvent('aiCollection');
    return sendJson(res, 200, newRec);
  }

  const aiRecReviewMatch = pathname.match(/^\/ai\/collection\/recommendations\/([^/]+)\/review$/);
  if (aiRecReviewMatch && method === 'POST') {
    const id = aiRecReviewMatch[1];
    let rec = store.aiCollectionRecommendations.find((r) => r.id === id || r.priority_id === id);
    if (!rec) {
      rec = {
        id,
        review_status: body.decision || 'Accept & Close',
        remarks: body.remarks || '',
        recommended_action: body.recommendedAction || '',
        reviewed_by: currentUser?.fullName || 'Eleanor Vance',
        reviewer_username: currentUser?.fullName || 'Eleanor Vance',
        reviewer_role: currentUser?.role || 'FINANCIAL_MANAGER',
        reviewed_at: new Date().toISOString(),
      };
      store.aiCollectionRecommendations.push(rec);
    } else {
      rec.review_status = body.decision || 'Accept & Close';
      rec.remarks = body.remarks || rec.remarks;
      rec.recommended_action = body.recommendedAction || rec.recommended_action;
      rec.reviewed_by = currentUser?.fullName || 'Eleanor Vance';
      rec.reviewer_username = currentUser?.fullName || 'Eleanor Vance';
      rec.reviewer_role = currentUser?.role || 'FINANCIAL_MANAGER';
      rec.reviewed_at = new Date().toISOString();
    }
    recordAudit(currentUser, 'Reviewed AI Recommendation', 'AI Collections', id, 'Recommendation', `Decision: ${body.decision}`);
    broadcastEvent('aiCollection');
    return sendJson(res, 200, rec);
  }

  // ── AI Duplicate Detection Endpoints ──────────────────────────────────────
  if (pathname === '/ai/duplicates/scan' && method === 'POST') {
    // Return unique document result for clean demonstration
    return sendJson(res, 200, {
      result: 'unique',
      confidence: 100,
      message: 'No duplicate document detected in in-memory archive.',
    });
  }
  if (pathname === '/ai/duplicates' && method === 'GET') {
    return sendJson(res, 200, store.aiDuplicates);
  }
  if (pathname === '/ai/duplicates/unique-documents' && method === 'GET') {
    return sendJson(res, 200, store.uniqueDocuments);
  }
  if (pathname === '/ai/duplicates/review-history' && method === 'GET') {
    return sendJson(res, 200, store.reviewHistory);
  }
  const dupDecideMatch = pathname.match(/^\/ai\/duplicates\/([^/]+)\/decide$/);
  if (dupDecideMatch && method === 'POST') {
    const [, id] = dupDecideMatch;
    const dup = store.aiDuplicates.find((d) => d.id === id);
    if (dup) {
      dup.status = 'PENDING_REVIEW';
      dup.decision = body.decision;
      dup.decidedBy = currentUser?.fullName || body.reviewer || 'Accountant';
      dup.decidedRemarks = body.remarks;
      dup.decidedAt = new Date().toISOString();
    }
    recordAudit(currentUser, `Decided Duplicate Flag (${body.decision})`, 'Duplicate Detection', id, 'DuplicateFlag', body.remarks || '');
    broadcastEvent('aiDuplicates');
    return sendJson(res, 200, dup || { id, status: 'PENDING_REVIEW' });
  }

  const dupReviewMatch = pathname.match(/^\/ai\/duplicates\/([^/]+)\/review$/);
  if (dupReviewMatch && method === 'POST') {
    const [, id] = dupReviewMatch;
    const dup = store.aiDuplicates.find((d) => d.id === id);
    if (dup) {
      if (body.action === 'APPROVE') {
        dup.status = dup.decision === 'NOT_DUPLICATE' ? 'CLEARED_NOT_DUPLICATE' : 'APPROVED_DUPLICATE';
      } else {
        dup.status = 'RETURNED';
      }
      dup.reviewedBy = currentUser?.fullName || body.reviewer || 'Head Accountant';
      dup.reviewedRemarks = body.remarks;
      dup.reviewedAt = new Date().toISOString();
    }
    recordAudit(currentUser, `Reviewed Duplicate Decision (${body.action})`, 'Duplicate Detection', id, 'DuplicateFlag', body.remarks || '');
    broadcastEvent('aiDuplicates');
    return sendJson(res, 200, dup || { id, status: body.action === 'APPROVE' ? 'APPROVED_DUPLICATE' : 'RETURNED' });
  }

  const dupActionMatch = pathname.match(/^\/ai\/duplicates\/([^/]+)\/(verify|return|approve|reject)$/);
  if (dupActionMatch && method === 'POST') {
    const [, id, action] = dupActionMatch;
    const dup = store.aiDuplicates.find((d) => d.id === id);
    if (dup) {
      dup.status = action === 'approve' ? 'Resolved' : action === 'reject' ? 'Dismissed' : 'Reviewed';
    }
    recordAudit(currentUser, `Reviewed Duplicate Flag (${action})`, 'Duplicate Detection', id, 'DuplicateFlag', body.remarks || '');
    broadcastEvent('aiDuplicates');
    return sendJson(res, 200, dup || { id, status: 'Resolved' });
  }

  // ── AI Pre-Save Duplicate Check & Skip Log ────────────────────────────────
  if (pathname === '/ai/duplicates/check' && method === 'POST') {
    const { entityType, fieldName, fieldValue, entityId } = body || {};
    let isDuplicate = false;
    let matches = [];

    if (fieldValue) {
      const val = String(fieldValue).trim().toLowerCase();
      if (entityType === 'waybill') {
        const found = store.waybills.find((w) => String(w.waybillNumber).toLowerCase() === val && (!entityId || w.id !== entityId));
        if (found) {
          isDuplicate = true;
          matches.push({
            recordId: found.id,
            documentNumber: found.waybillNumber,
            clientName: found.clientName || 'Existing Client',
            similarity: 100,
            matchReason: `Exact match with existing Waybill #${found.waybillNumber}`,
          });
        }
      } else if (entityType === 'invoice') {
        const found = store.invoices.find((i) => String(i.invoiceNumber).toLowerCase() === val && (!entityId || i.id !== entityId));
        if (found) {
          isDuplicate = true;
          matches.push({
            recordId: found.id,
            documentNumber: found.invoiceNumber,
            amount: found.totalAmount,
            similarity: 100,
            matchReason: `Exact match with existing Invoice #${found.invoiceNumber}`,
          });
        }
      } else if (entityType === 'speedpay' || entityType === 'receipt') {
        const found = store.speedpaySubmissions.find((s) => String(s.referenceNumber).toLowerCase() === val && (!entityId || s.id !== entityId));
        if (found) {
          isDuplicate = true;
          matches.push({
            recordId: found.id,
            documentNumber: found.referenceNumber,
            clientName: found.clientName,
            amount: found.amountPaid,
            similarity: 100,
            matchReason: `Exact match with existing Payment Reference #${found.referenceNumber}`,
          });
        }
      }
    }

    return sendJson(res, 200, {
      isDuplicate,
      matches,
      message: isDuplicate ? 'Potential duplicate records detected.' : 'No duplicate matches found.',
    });
  }

  if (pathname === '/ai/duplicates/skip-log' && method === 'POST') {
    recordAudit(currentUser, 'Skipped Duplicate AI Pre-Check', 'Duplicate Detection', body.fieldValue || 'N/A', 'PreCheckBypass', `User Remarks: ${body.remarks || 'Manual review override'}`);
    return sendJson(res, 200, { success: true, message: 'Skip logged successfully.' });
  }

  // ── AI Dynamic Risk Scoring Endpoints ─────────────────────────────────────
  if (pathname === '/ai/risk/config' && method === 'GET') {
    return sendJson(res, 200, {
      formulaVersion: 'v2.4-risk-matrix',
      description: 'Dynamic Multi-Factor Delinquency Matrix incorporating payment history (40%), current aging days (35%), and balance ratio (25%).',
      lastUpdated: '2026-03-01T00:00:00Z',
      bands: [
        { level: 'LOW', min: 0, max: 33, color: '#16A34A', badgeBg: '#F0FDF4', description: 'Low Default Risk — Timely payer' },
        { level: 'MEDIUM', min: 34, max: 66, color: '#D97706', badgeBg: '#FFFBEB', description: 'Moderate Exposure — Regular follow-up advised' },
        { level: 'HIGH', min: 67, max: 100, color: '#DC2626', badgeBg: '#FEF2F2', description: 'High Delinquency Probability — Immediate collection required' },
      ],
    });
  }

  const invoiceRiskMatch = pathname.match(/^\/ai\/risk\/invoices\/([^/]+)$/);
  if (invoiceRiskMatch && method === 'GET') {
    const invId = invoiceRiskMatch[1];
    const inv = store.invoices.find((i) => i.id === invId || i.invoiceNumber === invId);
    return sendJson(res, 200, {
      entityId: invId,
      entityType: 'invoice',
      riskScore: inv?.status === 'Overdue' ? 82 : 24,
      riskLevel: inv?.status === 'Overdue' ? 'HIGH' : 'LOW',
      paymentLabel: inv?.status === 'Overdue' ? 'OVERDUE' : 'DUE_SOON',
      formulaVersion: 'v2.4-risk-matrix',
      computedAt: new Date().toISOString(),
      factors: [
        { name: 'Days Past Due', points: 35, inputValue: '38 days', description: 'Exceeds standard 30-day net terms' },
        { name: 'Historical Delay', points: 25, inputValue: 'Avg 14 days late', description: 'Client frequently pays outside terms' },
        { name: 'Outstanding Ratio', points: 22, inputValue: '68% of credit limit', description: 'High total outstanding relative to limit' },
      ],
    });
  }

  const accountRiskMatch = pathname.match(/^\/ai\/risk\/accounts\/([^/]+)$/);
  if (accountRiskMatch && method === 'GET') {
    const accountId = accountRiskMatch[1];
    return sendJson(res, 200, {
      entityId: accountId,
      entityType: 'account',
      riskScore: 78,
      riskLevel: 'HIGH',
      paymentLabel: 'HIGH_RISK_PORTFOLIO',
      formulaVersion: 'v2.4-risk-matrix',
      computedAt: new Date().toISOString(),
      factors: [
        { name: 'Multiple Overdue Invoices', points: 40, inputValue: '3 open overdue bills', description: 'Repeated non-payment occurrences' },
        { name: 'Average DSO', points: 38, inputValue: '54 days', description: 'Days Sales Outstanding significantly elevated' },
      ],
    });
  }

  // ── AI Document Extraction Endpoints ──────────────────────────────────────
  if (pathname === '/ai/documents/upload' && method === 'POST') {
    const newDoc = {
      id: `DOC-${Date.now()}`,
      fileName: body.fileName || 'Uploaded_Document.pdf',
      fileSize: body.fileSize || 128000,
      docType: body.docType || 'invoice',
      status: 'extracted',
      overallConfidence: 94,
      uploadedAt: new Date().toISOString(),
      uploadedBy: currentUser?.fullName || 'Clara Oswald',
      fields: [
        { fieldName: 'invoiceNumber', label: 'Invoice Number', extractedValue: body.invoiceNumber || 'INV-2026-905', confidence: 99, isLowConfidence: false },
        { fieldName: 'clientName', label: 'Client Name', extractedValue: body.clientName || 'FastTrack Logistics Corp', confidence: 96, isLowConfidence: false },
        { fieldName: 'totalAmount', label: 'Total Amount (PHP)', extractedValue: body.totalAmount || '54200.00', confidence: 92, isLowConfidence: false },
        { fieldName: 'tinNumber', label: 'Client TIN', extractedValue: '004-912-381-000', confidence: 64, isLowConfidence: true, warning: 'Confidence is below 70% threshold' },
        { fieldName: 'billingDate', label: 'Billing Date', extractedValue: new Date().toISOString().split('T')[0], confidence: 95, isLowConfidence: false },
      ],
      completeness: [
        { name: 'Company Letterhead / Header', present: true, notes: 'Clear Speedex Header Present' },
        { name: 'Official Client Details', present: true, notes: 'Matches FOMS Client Directory' },
        { name: 'Authorized Signatory', present: true, notes: 'Signature line verified' },
        { name: 'Tax / TIN Identifier', present: false, notes: 'TIN field low contrast / blurred' },
      ],
    };
    store.aiDocuments.unshift(newDoc);
    recordAudit(currentUser, 'Uploaded Document for AI OCR', 'Document Intelligence', newDoc.id, 'DocumentExtraction', `File: ${newDoc.fileName}`);
    broadcastEvent('aiDocuments');
    return sendJson(res, 201, newDoc);
  }

  const docConfirmMatch = pathname.match(/^\/ai\/documents\/([^/]+)\/confirm$/);
  if (docConfirmMatch && method === 'POST') {
    const docId = docConfirmMatch[1];
    const doc = store.aiDocuments.find((d) => d.id === docId);
    if (doc) {
      doc.status = 'confirmed';
      doc.confirmedAt = new Date().toISOString();
      doc.confirmedBy = currentUser?.fullName || 'Clara Oswald';
      doc.remarks = body.remarks || 'Human verified fields';
    }
    recordAudit(currentUser, 'Confirmed AI Document Extraction', 'Document Intelligence', docId, 'DocumentExtraction', body.remarks || 'Confirmed without changes');
    broadcastEvent('aiDocuments');
    return sendJson(res, 200, { success: true, message: 'Document extraction confirmed and saved.' });
  }

  const docGetMatch = pathname.match(/^\/ai\/documents\/([^/]+)$/);
  if (docGetMatch && method === 'GET') {
    const doc = store.aiDocuments.find((d) => d.id === docGetMatch[1]);
    if (!doc) return sendJson(res, 404, { error: 'Document not found' });
    return sendJson(res, 200, doc);
  }

  if (pathname === '/ai/documents' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.aiDocuments, query));
  }

  // ── AI Output History Endpoints ───────────────────────────────────────────
  const outputGetMatch = pathname.match(/^\/ai\/outputs\/([^/]+)$/);
  if (outputGetMatch && method === 'GET') {
    const item = store.aiOutputs.find((o) => o.id === outputGetMatch[1]);
    if (!item) return sendJson(res, 404, { error: 'AI output record not found' });
    return sendJson(res, 200, item);
  }

  if (pathname === '/ai/outputs' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.aiOutputs, query));
  }

  // ── AI Dashboard Alerts & Follow-up Suggestions ───────────────────────────
  if (pathname === '/ai/dashboard/alerts' && method === 'GET') {
    const scopeRole = query.scope || currentUser?.role;
    let alerts = [
      {
        id: 'ALT-001',
        type: 'risk',
        title: 'High Default Risk Account',
        message: 'Global Prime Agro Exporters (INV-2026-004) has exceeded 30 days overdue with risk score 82.',
        severity: 'high',
        targetRoute: '/accounts-receivable',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ALT-002',
        type: 'duplicate',
        title: 'Potential Duplicate Flag',
        message: 'Waybill WB-1004 matches archival WB-1002 with 96% text & destination similarity.',
        severity: 'medium',
        targetRoute: '/flagged-duplicates',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'ALT-003',
        type: 'document',
        title: 'OCR Extraction Pending Human Review',
        message: 'Express_Billing_INV901.pdf has 1 low-confidence field (Client TIN at 64%).',
        severity: 'medium',
        targetRoute: '/document-extraction',
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
    ];

    if (scopeRole === 'ASSISTANT_FM') {
      alerts = alerts.filter((a) => a.type === 'duplicate' || a.type === 'document');
    }

    return sendJson(res, 200, alerts);
  }

  if (pathname === '/ai/collection/suggestions' && method === 'GET') {
    return sendJson(res, 200, [
      {
        id: 'SUG-001',
        clientId: 'CLI-001',
        clientName: 'Global Prime Agro Exporters',
        score: 85,
        suggestionText: 'Schedule phone call with David Chen regarding overdue balance before cutoff.',
        priority: 'High',
        confidence: 91,
        isAiGenerated: true,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  // ── Waybills & Shipment Records Endpoints ─────────────────────────────────
  const isWaybills = pathname === '/waybills' || pathname === '/shipment-records';
  if (isWaybills && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.waybills, query));
  }
  if (isWaybills && method === 'POST') {
    const newWaybill = {
      id: `WB-${1000 + store.waybills.length + 1}`,
      waybillNumber: `WB-${1000 + store.waybills.length + 1}`,
      encodedAt: new Date().toISOString(),
      encodedBy: currentUser?.fullName || 'Clara Oswald',
      status: 'For Checking',
      hasOriginalPOD: true,
      hasApprovedCTC: false,
      ...body,
    };
    store.waybills.unshift(newWaybill);
    recordAudit(currentUser, 'Created Waybill', 'Waybills', newWaybill.id, 'Waybill', `Waybill ${newWaybill.waybillNumber}`);
    broadcastEvent('waybills');
    return sendJson(res, 201, newWaybill);
  }

  const waybillActionMatch = pathname.match(/^\/(?:waybills|shipment-records)\/([^/]+)\/(submit|verify|return|approve|reject)$/);
  if (waybillActionMatch && method === 'POST') {
    const [, id, action] = waybillActionMatch;
    const wb = store.waybills.find((w) => w.id === id || w.waybillNumber === id);
    if (!wb) return sendJson(res, 404, { message: 'Waybill not found' });
    wb.status = action === 'verify' ? 'Validated' : action === 'approve' ? 'Billed' : 'Returned';
    recordAudit(currentUser, `${action.toUpperCase()} Waybill`, 'Waybills', wb.id, 'Waybill', body.remarks || '');
    broadcastEvent('waybills');
    return sendJson(res, 200, wb);
  }

  const waybillIdMatch = pathname.match(/^\/(?:waybills|shipment-records)\/([^/]+)$/);
  if (waybillIdMatch) {
    const id = waybillIdMatch[1];
    const index = store.waybills.findIndex((w) => w.id === id || w.waybillNumber === id);
    if (method === 'GET') {
      if (index === -1) return sendJson(res, 404, { message: 'Waybill not found' });
      return sendJson(res, 200, store.waybills[index]);
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (index === -1) return sendJson(res, 404, { message: 'Waybill not found' });
      store.waybills[index] = { ...store.waybills[index], ...body };
      broadcastEvent('waybills');
      return sendJson(res, 200, store.waybills[index]);
    }
    if (method === 'DELETE') {
      if (index === -1) return sendJson(res, 404, { message: 'Waybill not found' });
      store.waybills.splice(index, 1);
      broadcastEvent('waybills');
      return sendJson(res, 200, { success: true });
    }
  }

  // ── Clients Endpoints ─────────────────────────────────────────────────────
  if (pathname === '/clients' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.clients, query));
  }
  if (pathname === '/clients' && method === 'POST') {
    const newClient = {
      id: `CLI-${String(store.clients.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      status: 'Active',
      ...body,
    };
    store.clients.push(newClient);
    recordAudit(currentUser, 'Created Client', 'Clients', newClient.id, 'Client', `Client ${newClient.name}`);
    broadcastEvent('clients');
    return sendJson(res, 201, newClient);
  }
  const clientIdMatch = pathname.match(/^\/clients\/([^/]+)$/);
  if (clientIdMatch) {
    const id = clientIdMatch[1];
    const index = store.clients.findIndex((c) => c.id === id);
    if (method === 'GET') {
      if (index === -1) return sendJson(res, 404, { message: 'Client not found' });
      return sendJson(res, 200, store.clients[index]);
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (index === -1) return sendJson(res, 404, { message: 'Client not found' });
      store.clients[index] = { ...store.clients[index], ...body };
      recordAudit(currentUser, 'Updated Client', 'Clients', id, 'Client', `Updated client ${id}`);
      broadcastEvent('clients');
      return sendJson(res, 200, store.clients[index]);
    }
  }

  // ── Billing Rates & Records Endpoints ─────────────────────────────────────
  if (pathname === '/billing-rates' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.billingRates, query));
  }
  if (pathname === '/billing-rates' && method === 'POST') {
    const newRate = {
      id: `RATE-${String(store.billingRates.length + 1).padStart(3, '0')}`,
      status: 'Active',
      ...body,
    };
    store.billingRates.push(newRate);
    recordAudit(currentUser, 'Created Billing Rate', 'Rates', newRate.id, 'BillingRate', `Rate for ${newRate.region}`);
    broadcastEvent('rates');
    return sendJson(res, 201, newRate);
  }
  const rateIdMatch = pathname.match(/^\/billing-rates\/([^/]+)$/);
  if (rateIdMatch) {
    const id = rateIdMatch[1];
    const index = store.billingRates.findIndex((r) => r.id === id);
    if (method === 'GET') {
      if (index === -1) return sendJson(res, 404, { message: 'Billing rate not found' });
      return sendJson(res, 200, store.billingRates[index]);
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (index === -1) return sendJson(res, 404, { message: 'Billing rate not found' });
      store.billingRates[index] = { ...store.billingRates[index], ...body };
      broadcastEvent('rates');
      return sendJson(res, 200, store.billingRates[index]);
    }
  }

  if (pathname === '/billing-records' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.billingRecords, query));
  }
  if (pathname === '/billing-records' && method === 'POST') {
    const newRec = {
      id: `BREC-${String(store.billingRecords.length + 1).padStart(3, '0')}`,
      computedAt: new Date().toISOString(),
      computedBy: currentUser?.fullName || 'Clara Oswald',
      status: 'Pending Review',
      ...body,
    };
    store.billingRecords.unshift(newRec);
    broadcastEvent('billingRecords');
    return sendJson(res, 201, newRec);
  }

  // ── Liquidations Endpoints ────────────────────────────────────────────────
  if (pathname === '/liquidations' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.liquidations, query));
  }
  if (pathname === '/liquidations' && method === 'POST') {
    const newLiq = {
      id: `LIQ-2026-${String(store.liquidations.length + 1).padStart(3, '0')}`,
      reference: `LIQ-2026-${String(store.liquidations.length + 1).padStart(3, '0')}`,
      submittedAt: new Date().toISOString(),
      submittedBy: currentUser?.fullName || 'Miles Morales',
      status: 'Pending Validation',
      documents: [],
      expenses: [],
      ...body,
    };
    store.liquidations.unshift(newLiq);
    recordAudit(currentUser, 'Submitted Liquidation', 'Liquidations', newLiq.id, 'Liquidation', `Amount: ₱${newLiq.amount}`);
    broadcastEvent('liquidations');
    return sendJson(res, 201, newLiq);
  }
  const liqActionMatch = pathname.match(/^\/liquidations\/([^/]+)\/(verify|return|approve|reject)$/);
  if (liqActionMatch && method === 'POST') {
    const [, id, action] = liqActionMatch;
    const liq = store.liquidations.find((l) => l.id === id);
    if (!liq) return sendJson(res, 404, { message: 'Liquidation not found' });
    liq.status = action === 'verify' ? 'Validated' : action === 'approve' ? 'Approved' : 'Returned';
    recordAudit(currentUser, `${action.toUpperCase()} Liquidation`, 'Liquidations', liq.id, 'Liquidation', body.remarks || '');
    broadcastEvent('liquidations');
    return sendJson(res, 200, liq);
  }
  const liqIdMatch = pathname.match(/^\/liquidations\/([^/]+)$/);
  if (liqIdMatch) {
    const id = liqIdMatch[1];
    const index = store.liquidations.findIndex((l) => l.id === id);
    if (method === 'GET') {
      if (index === -1) return sendJson(res, 404, { message: 'Liquidation not found' });
      return sendJson(res, 200, store.liquidations[index]);
    }
  }

  // ── Cash Flow Endpoints ───────────────────────────────────────────────────
  const isCashFlow = pathname === '/cash-flow' || pathname === '/cashflow';
  if (isCashFlow && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.cashFlowRecords, query));
  }
  if (isCashFlow && method === 'POST') {
    const newCf = {
      id: `CF-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      recordedBy: currentUser?.fullName || 'Eleanor Vance',
      ...body,
    };
    store.cashFlowRecords.unshift(newCf);
    recordAudit(currentUser, 'Recorded Cash Flow', 'Cash Flow', newCf.id, 'CashFlow', `${newCf.type} of ₱${newCf.amount}`);
    broadcastEvent('cashflow');
    return sendJson(res, 201, newCf);
  }

  // ── Settlements Endpoints ─────────────────────────────────────────────────
  if (pathname === '/settlements' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.settlements, query));
  }
  if (pathname === '/settlements' && method === 'POST') {
    const newSet = {
      id: `SET-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      recordedBy: currentUser?.fullName || 'Clara Oswald',
      status: 'For validation',
      ...body,
    };
    store.settlements.unshift(newSet);
    recordAudit(currentUser, 'Recorded Settlement', 'Settlements', newSet.id, 'Settlement', `Settlement ${newSet.id}`);
    broadcastEvent('settlements');
    return sendJson(res, 201, newSet);
  }
  const setActionMatch = pathname.match(/^\/settlements\/([^/]+)\/(verify|approve|reject|return)$/);
  if (setActionMatch && method === 'POST') {
    const [, id, action] = setActionMatch;
    const item = store.settlements.find((s) => s.id === id);
    if (!item) return sendJson(res, 404, { message: 'Settlement not found' });
    item.status = action === 'verify' ? 'Validated' : action === 'approve' ? 'Validated' : 'Rejected';
    broadcastEvent('settlements');
    return sendJson(res, 200, item);
  }

  // ── Adjustments Endpoints ─────────────────────────────────────────────────
  if (pathname === '/adjustments' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.adjustments, query));
  }
  if (pathname === '/adjustments' && method === 'POST') {
    const newAdj = {
      id: `ADJ-${Date.now()}`,
      referenceNo: `CM-2026-${String(store.adjustments.length + 1).padStart(3, '0')}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.fullName || 'Clara Oswald',
      status: 'Draft',
      ...body,
    };
    store.adjustments.unshift(newAdj);
    recordAudit(currentUser, 'Created Adjustment', 'Adjustments', newAdj.id, 'Adjustment', `Amount: ₱${newAdj.amount}`);
    broadcastEvent('adjustments');
    return sendJson(res, 201, newAdj);
  }
  const adjActionMatch = pathname.match(/^\/adjustments\/([^/]+)\/(submit|verify|approve|reject)$/);
  if (adjActionMatch && method === 'POST') {
    const [, id, action] = adjActionMatch;
    const adj = store.adjustments.find((a) => a.id === id);
    if (!adj) return sendJson(res, 404, { message: 'Adjustment not found' });
    adj.status = action === 'submit' ? 'Pending Approval' : action === 'approve' ? 'Approved' : 'Rejected';
    broadcastEvent('adjustments');
    return sendJson(res, 200, adj);
  }

  // ── SpeedPay Submissions Endpoints ────────────────────────────────────────
  if (pathname === '/speedpay/submissions' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.speedpaySubmissions, query));
  }
  if (pathname === '/speedpay/submissions' && method === 'POST') {
    const newSp = {
      id: `SP-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      status: 'Pending Validation',
      ...body,
    };
    store.speedpaySubmissions.unshift(newSp);
    broadcastEvent('speedpay');
    return sendJson(res, 201, newSp);
  }
  const spVerifyMatch = pathname.match(/^\/speedpay\/submissions\/([^/]+)\/verify$/);
  if (spVerifyMatch && method === 'POST') {
    const id = spVerifyMatch[1];
    const sub = store.speedpaySubmissions.find((s) => s.id === id);
    if (!sub) return sendJson(res, 404, { message: 'SpeedPay submission not found' });
    sub.status = body.status === 'Rejected' ? 'Rejected' : 'Validated';
    sub.validatedBy = currentUser?.fullName || 'Arthur Pendelton';
    sub.validatedAt = new Date().toISOString();
    sub.remarks = body.remarks || body.notes || '';
    recordAudit(currentUser, `SpeedPay Validation (${sub.status})`, 'SpeedPay', sub.id, 'SpeedPay', sub.remarks);
    broadcastEvent('speedpay');
    return sendJson(res, 200, sub);
  }

  // ── Reports Endpoints ─────────────────────────────────────────────────────
  if (pathname === '/reports' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.reports, query));
  }
  const reportTypeMatch = pathname.match(/^\/reports\/([^/]+)$/);
  if (reportTypeMatch && method === 'GET') {
    const type = reportTypeMatch[1];
    return sendJson(res, 200, {
      reportType: type,
      generatedAt: new Date().toISOString(),
      items: store.invoices,
    });
  }

  // ── Audit Logs Endpoints ──────────────────────────────────────────────────
  if (pathname === '/audit-logs' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.auditLogs, query));
  }
  if (pathname === '/audit-logs' && method === 'POST') {
    const newLog = {
      id: `AUD-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: currentUser?.id || 'EMP-001',
      userFullName: currentUser?.fullName || 'System User',
      userRole: currentUser?.role || 'SYSTEM',
      ipAddress: '127.0.0.1',
      ...body,
    };
    store.auditLogs.unshift(newLog);
    broadcastEvent('auditLogs');
    return sendJson(res, 201, newLog);
  }

  // ── Users Endpoints ───────────────────────────────────────────────────────
  if (pathname === '/users' && method === 'GET') {
    const safeUsers = store.users.map(({ password, ...u }) => u);
    return sendJson(res, 200, filterAndPaginate(safeUsers, query));
  }
  const userStatusMatch = pathname.match(/^\/users\/([^/]+)\/status$/);
  if (userStatusMatch && method === 'PATCH') {
    const id = userStatusMatch[1];
    const u = store.users.find((user) => user.id === id);
    if (!u) return sendJson(res, 404, { message: 'User not found' });
    u.status = body.status || u.status;
    recordAudit(currentUser, 'Updated User Status', 'Users', u.id, 'User', `Status changed to ${u.status}`);
    broadcastEvent('users');
    return sendJson(res, 200, { id: u.id, status: u.status });
  }

  // ── Notifications Endpoints ───────────────────────────────────────────────
  if (pathname === '/notifications' && method === 'GET') {
    return sendJson(res, 200, filterAndPaginate(store.notifications, query));
  }
  if (pathname === '/notifications/read-all' && method === 'POST') {
    store.notifications.forEach((n) => { n.read = true; });
    broadcastEvent('notifications');
    return sendJson(res, 200, { success: true });
  }
  if (pathname === '/notifications' && method === 'DELETE') {
    store.notifications.length = 0;
    broadcastEvent('notifications');
    return sendJson(res, 200, { success: true });
  }
  const notifIdMatch = pathname.match(/^\/notifications\/([^/]+)$/);
  if (notifIdMatch && method === 'PATCH') {
    const id = notifIdMatch[1];
    const n = store.notifications.find((notif) => notif.id === id);
    if (!n) return sendJson(res, 404, { message: 'Notification not found' });
    if (typeof body.read === 'boolean') n.read = body.read;
    broadcastEvent('notifications');
    return sendJson(res, 200, n);
  }

  // Fallback 404
  return sendJson(res, 404, { message: `Route not found: ${method} ${pathname}` });
});

// ── WebSocket Upgrade Handling ──────────────────────────────────────────────
server.on('upgrade', (req, socket) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== '/ws' && parsed.pathname !== '/') {
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const digest = crypto
    .createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${digest}\r\n\r\n`
  );

  wsClients.add(socket);
  socket.on('close', () => wsClients.delete(socket));
  socket.on('error', () => wsClients.delete(socket));

  // Welcome message
  const welcome = makeWsFrame(JSON.stringify({ topic: '*', message: 'Connected to mock WebSocket server' }));
  socket.write(welcome);
});

// ── Server Listen ───────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`Mock API server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server is listening on ws://localhost:${PORT}/ws`);
  console.log('Press Ctrl+C to terminate.');
});
