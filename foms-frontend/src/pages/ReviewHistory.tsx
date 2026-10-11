import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReviewHistory } from '../hooks/useDuplicates';
import { canDo } from '../utils/roleAccess';
import { DataTable, type Column } from '../components/shared/DataTable';
import FilterBar from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import { PageHeader } from '../components/shared/PageHeader';
import Button from '../components/Buttons';
import type { ReviewHistoryItem } from '../services/duplicates.service';

const ReviewHistory: React.FC = () => {
  const { user } = useAuth();
  const canExport = canDo(user?.role, 'reviewHistory', 'export');

  const {
    items,
    total,
    isLoading,
    error,
    refetch,
    page,
    setPage,
    pageSize,
    search,
    setSearch,
    decisionFilter,
    setDecisionFilter,
    dateFrom,
    setDateFrom,
    applyFilters,
    resetFilters,
    scope,
  } = useReviewHistory();

  const [selectedRecord, setSelectedRecord] = useState<ReviewHistoryItem | null>(null);

  const handleExport = () => {
    if (!canExport || items.length === 0) return;

    const headers = ['History ID', 'Document Type', 'Document Number', 'Client Name', 'Decision', 'Reviewer', 'Role', 'Reason', 'Reviewed Date'];
    const rows = items.map((r) => [
      r.historyId,
      r.documentType || r.type,
      r.documentNumber,
      `"${(r.clientName || '').replace(/"/g, '""')}"`,
      r.finalDecision,
      `"${(r.reviewer || '').replace(/"/g, '""')}"`,
      r.reviewerRole,
      `"${(r.decisionReason || '').replace(/"/g, '""')}"`,
      r.reviewedDate,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `duplicate-review-history-${scope}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: Column<ReviewHistoryItem>[] = [
    {
      key: 'historyId',
      label: 'HISTORY ID',
      render: (row) => <span style={{ fontWeight: 700, color: '#0F172A' }}>{row.historyId}</span>,
    },
    {
      key: 'documentNumber',
      label: 'DOCUMENT NUMBER',
      render: (row) => <span>{row.documentNumber || '—'}</span>,
    },
    {
      key: 'finalDecision',
      label: 'FINAL DECISION',
      render: (row) => <StatusBadge status={row.finalDecision} />,
    },
    {
      key: 'reviewer',
      label: 'REVIEWER',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: '#0F172A' }}>{row.reviewer}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{row.reviewerRole}</div>
        </div>
      ),
    },
    {
      key: 'decisionReason',
      label: 'DECISION REASON / REMARKS',
      render: (row) => (
        <span style={{ color: '#475569', fontStyle: 'italic', maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.decisionReason}>
          {row.decisionReason || 'No remarks provided'}
        </span>
      ),
    },
    {
      key: 'reviewedDate',
      label: 'REVIEWED DATE',
      render: (row) => <span style={{ color: '#64748B' }}>{row.reviewedDate}</span>,
    },
  ];

  const filterFields = [
    {
      key: 'decision',
      label: 'DECISION',
      type: 'select' as const,
      options: [
        { label: 'Confirmed Duplicate', value: 'Confirmed Duplicate' },
        { label: 'Dismissed', value: 'Dismissed' },
        { label: 'Resolved', value: 'Resolved' },
      ],
    },
    {
      key: 'dateFrom',
      label: 'REVIEWED DATE',
      type: 'date' as const,
    },
  ];

  const filterValues = {
    decision: decisionFilter,
    dateFrom,
  };

  const handleFieldChange = (key: string, value: string) => {
    if (key === 'decision') setDecisionFilter(value);
    if (key === 'dateFrom') setDateFrom(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <PageHeader
          title="Review History"
          subtitle={
            scope === 'liquidation'
              ? 'Audit log of reviewed liquidation duplicates and reimbursable claims.'
              : scope === 'own'
              ? 'Audit log of duplicate resolutions for your assigned accounts.'
              : 'Complete organizational audit trail of duplicate detection decisions.'
          }
        />

        {canExport && (
          <Button
            title={`Export ${scope === 'all' ? 'All' : scope === 'liquidation' ? 'Liquidation' : 'My Scope'} CSV`}
            icon="ti ti-download"
            variant="secondary"
            size="sm"
            onClick={handleExport}
            disabled={items.length === 0}
          />
        )}
      </div>

      {scope === 'liquidation' && (
        <div style={{ padding: '8px 14px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', fontSize: '0.8rem', color: '#0369A1', fontWeight: 600 }}>
          <i className="ti ti-filter" style={{ marginRight: 6 }} />
          Assistant FM Scope: Audit records restricted to liquidation &amp; expense documents
        </div>
      )}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by ID, document #, reviewer…"
        fields={filterFields}
        values={filterValues}
        onFieldChange={handleFieldChange}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <DataTable
        rows={items}
        columns={columns}
        rowKey={(r) => r.id}
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        emptyMessage="No review history records found."
        renderActions={(row) => (
          <Button
            title="Inspect"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedRecord(row)}
          />
        )}
      />

      {/* Detail Modal */}
      {selectedRecord && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 12, padding: 24, maxWidth: 500, width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                Review Record — {selectedRecord.historyId}
              </h3>
              <button
                onClick={() => setSelectedRecord(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                <span style={{ color: '#64748B' }}>Target Document</span>
                <span style={{ fontWeight: 600 }}>{selectedRecord.documentNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                <span style={{ color: '#64748B' }}>Client / Account</span>
                <span>{selectedRecord.clientName}</span>
              </div>

              {/* Full Multi-Step Audit Trail */}
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Complete Decision Audit Trail
                </div>

                {/* Step 1: AI Detection */}
                <div style={{ borderLeft: '2px solid #0D9488', paddingLeft: 10 }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.82rem' }}>1. AI Detection Flag</div>
                  <div style={{ color: '#64748B', fontSize: '0.78rem' }}>Result: {selectedRecord.aiResult}</div>
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Flagged: {selectedRecord.aiFlagDate || selectedRecord.reviewedDate}</div>
                </div>

                {/* Step 2: Level 1 Decision (Accountant) */}
                <div style={{ borderLeft: '2px solid #3B82F6', paddingLeft: 10 }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.82rem' }}>2. Level 1 Decision (Accountant)</div>
                  <div style={{ color: '#1E40AF', fontSize: '0.78rem', fontWeight: 600 }}>
                    Decision: {selectedRecord.accountantDecision || 'Marked as Duplicate'}
                  </div>
                  {selectedRecord.accountantRemarks && (
                    <div style={{ color: '#475569', fontSize: '0.78rem', fontStyle: 'italic', marginTop: 2 }}>
                      Remarks: "{selectedRecord.accountantRemarks}"
                    </div>
                  )}
                  {selectedRecord.accountantDecidedAt && (
                    <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Decided: {selectedRecord.accountantDecidedAt}</div>
                  )}
                </div>

                {/* Step 3: Level 2 Review (Head Accountant) */}
                <div style={{ borderLeft: '2px solid #10B981', paddingLeft: 10 }}>
                  <div style={{ fontWeight: 700, color: '#0F172A', fontSize: '0.82rem' }}>3. Level 2 Approval (Head Accountant)</div>
                  <div style={{ color: '#065F46', fontSize: '0.78rem', fontWeight: 600 }}>
                    Final Decision: {selectedRecord.finalDecision}
                  </div>
                  <div style={{ color: '#64748B', fontSize: '0.78rem' }}>
                    Reviewer: {selectedRecord.reviewer} ({selectedRecord.reviewerRole})
                  </div>
                  {selectedRecord.decisionReason && (
                    <div style={{ color: '#475569', fontSize: '0.78rem', fontStyle: 'italic', marginTop: 2 }}>
                      Supervisor Remarks: "{selectedRecord.decisionReason}"
                    </div>
                  )}
                  <div style={{ color: '#94A3B8', fontSize: '0.75rem' }}>Approved: {selectedRecord.reviewedDate}</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <Button title="Close" variant="secondary" size="sm" onClick={() => setSelectedRecord(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewHistory;
