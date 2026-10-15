import React, { useState } from 'react';
import { Button } from '../components/Buttons';
import { StatusBadge } from '../components/shared/StatusBadge';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { RecordHistoryModal } from '../components/RecordHistoryModal';
import { CalendarPicker } from '../components/FormModals';
import { useQuery } from '../hooks/useQuery';
import { liquidationsService } from '../services/liquidationsService';
import { cashFlowService } from '../services/cashFlowService';
import { auditLogsService } from '../services/auditLogsService';
import type { Liquidation, LiquidationExpense } from '../types/entities';
import { formatCurrency, formatDate } from '../utils/format';
import { invalidateForMutation } from '../services/invalidation';
import '../components/FormModals.css';

export default function LiquidationValidation() {
  const { data: liqData, refetch, isLoading } = useQuery('liquidations', () => liquidationsService.list({ pageSize: 100 }));
  const liquidations: Liquidation[] = liqData?.items || [];

  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedLiquidationId, setSelectedLiquidationId] = useState<string | null>(null);

  const [remarks, setRemarks] = useState('');
  const [reviewDecision, setReviewDecision] = useState('Validate Liquidation');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{ name: string; url: string; size: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Record Expense state (Assistant Finance Manager)
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    category: 'Office Supplies',
    date: new Date().toISOString().split('T')[0],
    referenceNo: '',
  });
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  const handleSubmitExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.description || !expenseForm.amount || !expenseForm.date || isSubmittingExpense) return;
    setIsSubmittingExpense(true);
    try {
      const parsedAmount = parseFloat(expenseForm.amount);
      const expenseDate = expenseForm.date;

      // 1. Create Cash Flow Outflow record
      await cashFlowService.create({
        type: 'Outflow',
        amount: parsedAmount,
        sourceReference: `${expenseForm.category}: ${expenseForm.description}`,
        date: expenseDate,
        recordedBy: user?.fullName || 'Assistant Finance Manager',
      });

      // 2. Also register in Liquidations so it appears on Liquidation Reports
      try {
        await liquidationsService.create({
          reference: expenseForm.referenceNo || `EXP-${Date.now().toString().slice(-6)}`,
          submittedBy: user?.fullName || 'Assistant Finance Manager',
          department: expenseForm.category,
          amount: parsedAmount,
          submittedAt: expenseDate,
          status: 'Validated',
          remarks: expenseForm.description,
          items: [{
            id: `item-${Date.now()}`,
            description: expenseForm.description,
            amount: parsedAmount,
            category: expenseForm.category,
            receiptNumber: expenseForm.referenceNo || 'N/A'
          }]
        } as any);
      } catch {
        // Fallback if liquidationsService mock differs
      }

      // 3. Create Audit Log
      await auditLogsService.create({
        userId: user?.employeeId || 'AFM-001',
        userFullName: user?.fullName || 'Assistant Finance Manager',
        userRole: user?.role || 'ASSISTANT_FM',
        action: 'RECORD_EXPENSE',
        module: 'Liquidation & Expense',
        recordId: expenseForm.referenceNo || `EXP-${Date.now()}`,
        recordType: 'CashFlowOutflow',
        ipAddress: '127.0.0.1',
        details: `Recorded expense: ${expenseForm.description} (₱${parsedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}) under ${expenseForm.category}`,
        timestamp: new Date().toISOString()
      });

      // 4. Invalidate all applicable pages (cashflow, payments, asst, liquidations, dashboard, reports, auditLogs)
      await invalidateForMutation('recordCashFlow');
      await invalidateForMutation('approveLiquidation');

      setExpenseForm({ description: '', amount: '', category: 'Office Supplies', date: new Date().toISOString().split('T')[0], referenceNo: '' });
      setShowExpenseForm(false);
      toast.success(`Expense "${expenseForm.description}" recorded — ₱${parsedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Expense Recorded');
    } catch {
      toast.error('Failed to record expense. Please try again.');
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 9;

  const filteredLiquidations = liquidations.filter((row: Liquidation) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (row.id || '').toLowerCase().includes(q) ||
        (row.reference || '').toLowerCase().includes(q) ||
        (row.submittedBy || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (statusFilter && row.status !== statusFilter) return false;
    if (fromDate && new Date(row.submittedAt) < new Date(fromDate)) return false;
    if (toDate) {
      const t = new Date(toDate);
      t.setHours(23, 59, 59, 999);
      if (new Date(row.submittedAt) > t) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredLiquidations.length / pageSize) || 1;
  const paginatedLiquidations = filteredLiquidations.slice((page - 1) * pageSize, page * pageSize);

  const viewRecord = liquidations.find((l: Liquidation) => l.id === selectedLiquidationId);

  const handleLogDecision = () => {
    if (reviewDecision === 'Validate Liquidation') {
      handleValidate();
    } else {
      handleReject();
    }
  };

  const handleValidate = async () => {
    if (!viewRecord || submitting) return;
    setSubmitting(true);

    try {
      await liquidationsService.update(viewRecord.id, { status: 'Validated', remarks: 'Successfully validated.' });

      await cashFlowService.create({
        sourceReference: `Liquidation Validated: ${viewRecord.id} - ${viewRecord.reference}`,
        type: 'Outflow',
        amount: viewRecord.amount,
        date: new Date().toISOString(),
        recordedBy: user?.fullName || 'System'
      });

      await auditLogsService.create({
        userId: user?.employeeId || 'System',
        userFullName: user?.fullName || 'System',
        userRole: user?.role || 'ASSISTANT_FM',
        action: 'VALIDATE_LIQUIDATION',
        module: 'Liquidation Validation',
        recordId: viewRecord.id,
        recordType: 'Liquidation',
        ipAddress: '127.0.0.1',
        details: `Liquidation approved and validated. Generated cash outflow record. Remarks: ${remarks || 'None'}`,
        timestamp: new Date().toISOString()
      });

      await invalidateForMutation('approveLiquidation');
      toast.success(`Liquidation ${viewRecord.id} validated.`);
      setRemarks('');
      setSelectedLiquidationId(null);
    } catch {
      toast.error('Failed to validate liquidation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!viewRecord || submitting) return;

    if (!remarks.trim()) {
      toast.error('Please enter remarks for returning this liquidation.');
      return;
    }

    setSubmitting(true);
    try {
      await liquidationsService.update(viewRecord.id, { status: 'Returned', remarks });

      await auditLogsService.create({
        userId: user?.employeeId || 'System',
        userFullName: user?.fullName || 'System',
        userRole: user?.role || 'ASSISTANT_FM',
        action: 'REJECT_LIQUIDATION',
        module: 'Liquidation Validation',
        recordId: viewRecord.id,
        recordType: 'Liquidation',
        ipAddress: '127.0.0.1',
        details: `Liquidation returned. Reason: ${remarks}`,
        timestamp: new Date().toISOString()
      });

      await invalidateForMutation('returnLiquidation');
      toast.error(`Liquidation ${viewRecord.id} returned for correction.`);
      setRemarks('');
      setSelectedLiquidationId(null);
    } catch {
      toast.error('Failed to return liquidation.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Search and Filter Controls */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #E2E8F0',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 14,
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 16 }} />
            <input
              type="text"
              placeholder="Search liquidations by reference or submitter..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                fontSize: '13px',
                outline: 'none',
                background: '#F8FAFC',
                color: '#1E293B',
                boxSizing: 'border-box'
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0D9488'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              fontSize: '13px',
              outline: 'none',
              background: '#F8FAFC',
              color: '#334155',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <option value="">All Statuses</option>
            <option value="Pending Validation">Pending Validation</option>
            <option value="Validated">Validated</option>
            <option value="Returned">Returned</option>
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>From:</span>
            <div style={{ width: '140px' }}>
              <CalendarPicker
                label=""
                value={fromDate}
                onChange={(d) => { setFromDate(d); setPage(1); }}
                placeholder="Start date..."
                variant="filter"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>To:</span>
            <div style={{ width: '140px' }}>
              <CalendarPicker
                label=""
                value={toDate}
                onChange={(d) => { setToDate(d); setPage(1); }}
                placeholder="End date..."
                variant="filter"
                minDate={fromDate}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {(searchQuery || statusFilter || fromDate || toDate) && (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter(''); setFromDate(''); setToDate(''); setPage(1); }}
              style={{
                height: 38,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: '#fff',
                color: '#64748B',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowExpenseForm(true)}
            style={{
              height: 38,
              padding: '0 18px',
              borderRadius: 8,
              background: '#0D9488',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 4px rgba(13,148,136,0.2)',
              boxSizing: 'border-box',
              whiteSpace: 'nowrap'
            }}
          >
            <i className="ti ti-receipt-refund" /> Record Expense
          </button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
          <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 32, color: '#0D9488', marginBottom: 12 }} />
          <div style={{ fontWeight: 600 }}>Loading liquidation reports...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredLiquidations.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            <i className="ti ti-receipt-tax" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No liquidation records found</div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
            No liquidations match the selected filters.
          </p>
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && filteredLiquidations.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {paginatedLiquidations.map((row: Liquidation) => {
            return (
              <div
                key={row.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: 22,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0,0,0,0.08)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                }}
              >
                {/* Top Row: Reference + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                    REF #{row.reference || row.id}
                  </span>
                  <StatusBadge status={row.status} />
                </div>

                {/* Submitter */}
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {row.submittedBy || 'Unknown Employee'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: '#64748B' }}>
                    <i className="ti ti-calendar" style={{ color: '#94A3B8' }} />
                    <span>Submitted: {formatDate(row.submittedAt)}</span>
                  </div>
                </div>

                {/* Total Computed Amount Highlight Box */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#166534' }}>Total Amount</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#166534' }}>
                    {formatCurrency(row.amount)}
                  </span>
                </div>

                {/* Leftover / Reimbursement notes if any */}
                {((row.leftoverCash ?? 0) > 0 || (row.reimbursementAmount ?? 0) > 0) && (
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 600 }}>
                    {(row.leftoverCash ?? 0) > 0 && (
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: '#EFF6FF', color: '#1E40AF' }}>
                        Leftover: {formatCurrency(row.leftoverCash!)}
                      </span>
                    )}
                    {(row.reimbursementAmount ?? 0) > 0 && (
                      <span style={{ padding: '3px 8px', borderRadius: 6, background: '#FFFBEB', color: '#B45309' }}>
                        Reimbursement: {formatCurrency(row.reimbursementAmount!)}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer Action */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    title="Review Liquidation"
                    variant="secondary"
                    size="sm"
                    icon="ti-file-search"
                    onClick={() => setSelectedLiquidationId(row.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && filteredLiquidations.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', fontSize: 13, color: '#64748B' }}>
          <div>
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filteredLiquidations.length)} of {filteredLiquidations.length} records
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: page <= 1 ? '#F8FAFC' : '#fff',
                color: page <= 1 ? '#CBD5E1' : '#334155',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 12
              }}
            >
              Previous
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontWeight: 700, color: '#0F172A' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page >= totalPages}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                background: page >= totalPages ? '#F8FAFC' : '#fff',
                color: page >= totalPages ? '#CBD5E1' : '#334155',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: 12
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Liquidation Details Modal */}
      {viewRecord && (
        <div className="modal-overlay" style={{ zIndex: 999 }}>
          <div className="modal-card" style={{ width: '800px', maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-hd">
              <h3 className="modal-hd-title">Liquidation Details</h3>
              <button className="modal-x-btn" onClick={() => setSelectedLiquidationId(null)}>&times;</button>
            </div>
            <div className="modal-bd" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h3 style={{ margin: 0, fontSize: '1.75rem', color: '#0F172A', fontWeight: 800 }}>{viewRecord.id}</h3>
                <StatusBadge status={viewRecord.status} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px', background: '#fff' }}>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '6px' }}>Operations / trip reference</div>
                  <div style={{ fontSize: '15px', color: '#0F172A', fontWeight: 700 }}>{viewRecord.reference}</div>
                </div>
                <div style={{ border: '1px solid #10B981', borderRadius: '8px', padding: '16px', background: '#F0FDF4' }}>
                  <div style={{ fontSize: '12px', color: '#047857', marginBottom: '6px' }}>Total computed amount</div>
                  <div style={{ fontSize: '18px', color: '#047857', fontWeight: 800 }}>{formatCurrency(viewRecord.amount)}</div>
                </div>
              </div>

              <div style={{ marginBottom: '32px' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Expense breakdown</h4>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden', background: '#fff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ background: '#F8FAFC' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0' }}>Type</th>
                        <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 600, color: '#64748B', borderBottom: '1px solid #E2E8F0', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewRecord.expenses || []).map((exp: LiquidationExpense, idx: number) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '16px', verticalAlign: 'top' }}>
                            <div style={{ fontSize: '14px', color: '#0F172A', fontWeight: 700, marginBottom: '4px' }}>{exp.type}</div>
                            <div style={{ fontSize: '13px', color: '#64748B' }}>{exp.description}</div>
                          </td>
                          <td style={{ padding: '16px', fontSize: '14px', color: '#0F172A', fontWeight: 700, textAlign: 'right', verticalAlign: 'top' }}>
                            {formatCurrency(exp.amount)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#F8FAFC' }}>
                        <td style={{ padding: '16px', fontSize: '14px', color: '#0F172A', fontWeight: 800 }}>Total</td>
                        <td style={{ padding: '16px', fontSize: '15px', color: '#10B981', fontWeight: 800, textAlign: 'right' }}>
                          {formatCurrency(viewRecord.amount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Supporting documents</h4>
                  <span style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>{(viewRecord.documents || []).length} files</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(viewRecord.documents || []).map((doc: { name: string; url: string; size: string }, idx: number) => (
                    <div key={idx} style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className="ti ti-file-text" style={{ color: '#64748B', fontSize: '20px' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{doc.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{doc.size}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        style={{ padding: '6px 16px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#0F172A', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <i className="ti ti-eye" /> View
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {viewRecord.remarks && viewRecord.status !== 'Pending Validation' && (
                <div style={{ marginBottom: '32px', padding: '16px', background: '#F1F5F9', borderLeft: '4px solid #64748B', borderRadius: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', textTransform: 'uppercase', marginBottom: '6px' }}>Previous Remarks</span>
                  <span style={{ fontSize: '14px', color: '#1E293B' }}>{viewRecord.remarks}</span>
                </div>
              )}

              {selectedDoc && (
                <div className="modal-overlay" style={{ zIndex: 1000 }}>
                  <div className="modal-card" style={{ width: '500px' }}>
                    <div className="modal-hd">
                      <h3 className="modal-hd-title">View Document: {selectedDoc.name}</h3>
                      <button className="modal-x-btn" onClick={() => setSelectedDoc(null)}>&times;</button>
                    </div>
                    <div className="modal-bd" style={{ textAlign: 'center', padding: '32px 24px' }}>
                      <i className="ti ti-file-text" style={{ fontSize: '48px', color: '#94A3B8', marginBottom: '16px', display: 'block' }} />
                      <p style={{ color: '#475569', fontSize: '14px', marginBottom: '24px' }}>
                        Previewing <strong>{selectedDoc.name}</strong> ({selectedDoc.size}).
                      </p>
                      <Button title="Download Document" variant="secondary" icon="ti-download" onClick={() => toast.success(`Downloading ${selectedDoc.name}...`)} />
                    </div>
                  </div>
                </div>
              )}

              {viewRecord.status === 'Pending Validation' ? (
                <div style={{ marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '24px' }}>
                  <div className="tf-group state-default" style={{ marginBottom: '20px' }}>
                    <label className="tf-label" style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Review decision</label>
                    <div className="tf-wrapper">
                      <select
                        className="tf-input"
                        value={reviewDecision}
                        onChange={(e) => setReviewDecision(e.target.value)}
                        style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', padding: '10px 14px' }}
                      >
                        <option value="Validate Liquidation">Validate liquidation</option>
                        <option value="Return for Correction">Return for correction</option>
                      </select>
                    </div>
                  </div>

                  <div className="tf-group state-default" style={{ marginBottom: '32px' }}>
                    <label className="tf-label" style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>Remarks / validation notes (optional)</label>
                    <div className="tf-wrapper tf-textarea-wrapper">
                      <textarea
                        className="tf-textarea"
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        placeholder="Optional validation steps or extra context..."
                        style={{ padding: '12px 14px', fontSize: '14px', minHeight: '80px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button
                      onClick={() => setSelectedLiquidationId(null)}
                      style={{ padding: '10px 24px', background: '#fff', color: '#0F172A', border: '1px solid #E2E8F0', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogDecision}
                      disabled={submitting}
                      style={{ padding: '10px 24px', background: submitting ? '#94A3B8' : '#14B8A6', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}
                    >
                      {submitting ? 'Processing...' : 'Log decision'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px', borderTop: '1px solid #E2E8F0', paddingTop: '24px' }}>
                  <Button title="Close" variant="secondary" onClick={() => setSelectedLiquidationId(null)} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <RecordHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        recordId={viewRecord?.id || ''}
        recordType="Liquidation"
      />

      {/* Record Expense Modal (Assistant Finance Manager) */}
      {showExpenseForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '24px', width: 440, maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Record Expense</h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#64748B' }}>Add a new operational cash outflow record</p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseForm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18 }}
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleSubmitExpense} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Description *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Supplies, Fuel, Maintenance..."
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Amount (₱) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Category *</label>
                  <select
                    value={expenseForm.category}
                    onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  >
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Fuel & Transportation">Fuel & Transportation</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Professional Fees">Professional Fees</option>
                    <option value="Miscellaneous">Miscellaneous</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Expense Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>Reference No.</label>
                  <input
                    type="text"
                    placeholder="e.g. EXP-2026-001"
                    value={expenseForm.referenceNo}
                    onChange={e => setExpenseForm(prev => ({ ...prev, referenceNo: e.target.value }))}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #CBD5E1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #CBD5E1', background: '#fff', color: '#475569', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: isSubmittingExpense ? '#94A3B8' : '#0D9488',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: isSubmittingExpense ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <i className="ti ti-arrow-down-right" /> {isSubmittingExpense ? 'Recording...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
