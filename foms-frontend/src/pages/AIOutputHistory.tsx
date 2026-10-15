import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import FilterBar from '../components/shared/FilterBar';
import Button from '../components/Buttons';
import { AiDisclaimer } from '../components/ai/AiDisclaimer';
import { AiErrorBoundary } from '../components/ai/ErrorBoundary';
import { aiOutputsService } from '../services/ai/aiOutputs.service';
import { getDuplicateScope, canDo } from '../utils/roleAccess';
import { useQuery } from '../hooks/useQuery';
import type { AiOutputRecord } from '../types/ai';

const getModuleBadge = (mod: string) => {
  const m = (mod || '').toLowerCase();
  if (m.includes('dup')) return { label: 'DUPLICATE', bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE', icon: 'ti-copy' };
  if (m.includes('risk')) return { label: 'RISK', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: 'ti-alert-triangle' };
  if (m.includes('coll')) return { label: 'COLLECTION', bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0', icon: 'ti-cash' };
  if (m.includes('doc')) return { label: 'DOCUMENT', bg: '#FAF5FF', color: '#9333EA', border: '#E9D5FF', icon: 'ti-file-text' };
  return { label: (mod || 'AI').toUpperCase(), bg: '#F1F5F9', color: '#475569', border: '#E2E8F0', icon: 'ti-cpu' };
};

const getDecisionBadge = (decision?: string) => {
  const d = (decision || '').toLowerCase();
  if (d.includes('unique') || d.includes('verified')) {
    return { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0', icon: 'ti-check' };
  }
  if (d.includes('flag') || d.includes('dup') || d.includes('reject')) {
    return { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA', icon: 'ti-alert-circle' };
  }
  return { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A', icon: 'ti-clock' };
};

export const AIOutputHistory: React.FC = () => {
  const { user } = useAuth();
  const scope = getDuplicateScope(user?.role);
  const canExport = canDo(user?.role, 'aiHistory', 'export');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<AiOutputRecord | null>(null);

  const queryKey = `aiOutputs:${scope}:${page}:${pageSize}:${search}:${moduleFilter}:${dateFrom}`;
  const { data: aiData, isLoading, error, refetch } = useQuery(
    queryKey,
    () =>
      aiOutputsService.list({
        page,
        pageSize,
        search: search || undefined,
        module: moduleFilter || undefined,
        dateFrom: dateFrom || undefined,
        scope,
      }),
    { enabled: !!user },
  );

  const items = aiData?.items || [];
  const total = aiData?.total || 0;

  const handleExport = () => {
    if (!canExport || items.length === 0) return;
    const headers = ['Output ID', 'Module', 'Document/Entity', 'Client', 'Summary', 'Score', 'Reviewer', 'Decision', 'Date'];
    const rows = items.map((r) => [
      r.id,
      r.module.toUpperCase(),
      r.documentNumber || r.entityId,
      `"${(r.clientName || '').replace(/"/g, '""')}"`,
      `"${(r.outputSummary || '').replace(/"/g, '""')}"`,
      r.score !== undefined ? `${r.score}%` : 'N/A',
      r.reviewer || 'Unreviewed',
      r.reviewDecision || 'Pending',
      r.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ai-output-history-${scope}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filterFields = [
    {
      key: 'module',
      label: 'AI MODULE',
      type: 'select' as const,
      options: [
        { label: 'Duplicate Detection', value: 'duplicate' },
        { label: 'Receivable Risk', value: 'risk' },
        { label: 'Collection Forecasting', value: 'collection' },
        { label: 'Document Extraction', value: 'document' },
      ],
    },
    {
      key: 'dateFrom',
      label: 'DATE RECORDED',
      type: 'date' as const,
    },
  ];

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <AiErrorBoundary>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Top Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <AiDisclaimer />
            {canExport && (
              <Button
                title="Export CSV"
                icon="ti ti-download"
                variant="secondary"
                size="sm"
                onClick={handleExport}
                disabled={items.length === 0}
              />
            )}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search ID, document number, client…"
          fields={filterFields}
          values={{ module: moduleFilter, dateFrom }}
          onFieldChange={(k, v) => {
            if (k === 'module') setModuleFilter(v);
            if (k === 'dateFrom') setDateFrom(v);
          }}
          onApply={refetch}
          onReset={() => {
            setSearch('');
            setModuleFilter('');
            setDateFrom('');
          }}
        />

        {/* Error state */}
        {error && (
          <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#991B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>Error loading AI outputs:</strong> {error.message || 'Unknown error'}
            </div>
            <button onClick={() => refetch()} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
              Retry
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
            <i className="ti ti-loader-2 ti-spin" style={{ fontSize: 32, color: '#0D9488', marginBottom: 12 }} />
            <div style={{ fontWeight: 600 }}>Loading AI outputs...</div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && items.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
              <i className="ti ti-robot" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No AI output records found</div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
              No intelligence logs match your search or filter criteria.
            </p>
          </div>
        )}

        {/* Table View */}
        {!isLoading && !error && items.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 960, borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Record ID</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Document / Entity</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score / Level</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Output Summary</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Review Decision</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date Recorded</th>
                    <th style={{ padding: '12px 18px', fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const modBadge = getModuleBadge(row.module);
                    const decBadge = getDecisionBadge(row.reviewDecision);
                    return (
                      <tr
                        key={row.id}
                        style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                              {row.id}
                            </span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 7px',
                              borderRadius: 5,
                              fontSize: 10,
                              fontWeight: 700,
                              background: modBadge.bg,
                              color: modBadge.color,
                              border: `1px solid ${modBadge.border}`,
                              width: 'fit-content'
                            }}>
                              <i className={`ti ${modBadge.icon}`} style={{ fontSize: 10 }} />
                              {modBadge.label}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <div>
                            {row.linkUrl ? (
                              <a
                                href={row.linkUrl}
                                style={{ fontSize: 13, fontWeight: 800, color: '#0D9488', textDecoration: 'none' }}
                                title="Click to navigate to official record"
                              >
                                {row.documentNumber || row.entityId} ↗
                              </a>
                            ) : (
                              <span style={{ fontSize: 13, fontWeight: 800, color: '#0F172A' }}>
                                {row.documentNumber || row.entityId}
                              </span>
                            )}
                            {row.clientName && (
                              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 600, marginTop: 2 }}>
                                {row.clientName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 800,
                            color: '#0F172A',
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#F1F5F9',
                            border: '1px solid #E2E8F0'
                          }}>
                            {row.score !== undefined ? `${row.score}%` : row.level || 'N/A'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', maxWidth: 340 }}>
                          <span style={{
                            fontSize: 12,
                            color: '#334155',
                            lineHeight: 1.45,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }} title={row.outputSummary}>
                            {row.outputSummary}
                          </span>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: decBadge.bg,
                              color: decBadge.color,
                              border: `1px solid ${decBadge.border}`
                            }}>
                              <i className={`ti ${decBadge.icon}`} style={{ fontSize: 11 }} />
                              {row.reviewDecision || 'Pending Validation'}
                            </span>
                            {row.reviewer && (
                              <div style={{ fontSize: 11, color: '#64748B', marginTop: 3 }}>
                                by {row.reviewer}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', whiteSpace: 'nowrap', fontSize: 12, color: '#64748B' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <i className="ti ti-calendar" style={{ color: '#0D9488' }} />
                            <span>{new Date(row.createdAt).toLocaleDateString('en-PH')}</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 18px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Button
                            title="Inspect"
                            variant="secondary"
                            size="sm"
                            icon="ti ti-eye"
                            onClick={() => setSelectedRecord(row)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination Footer */}
        {!isLoading && !error && total > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ fontSize: 13, color: '#64748B' }}>
              Showing {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total} records
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  background: page <= 1 ? '#F8FAFC' : '#fff',
                  color: page <= 1 ? '#94A3B8' : '#0F172A',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                Previous
              </button>

              <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', padding: '0 8px' }}>
                Page {page} of {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '6px 14px',
                  borderRadius: 8,
                  border: '1px solid #E2E8F0',
                  background: page >= totalPages ? '#F8FAFC' : '#fff',
                  color: page >= totalPages ? '#94A3B8' : '#0F172A',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: 13
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Modal for detail inspection */}
        {selectedRecord && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.55)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
            onClick={() => setSelectedRecord(null)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 14,
                maxWidth: 500,
                width: '100%',
                padding: 24,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                  AI Output Log — {selectedRecord.id}
                </h3>
                <button
                  onClick={() => setSelectedRecord(null)}
                  style={{ background: 'none', border: 'none', fontSize: 20, color: '#64748B', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Module</span>
                  <span style={{ fontWeight: 700 }}>{selectedRecord.module.toUpperCase()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Target Record</span>
                  <span style={{ fontWeight: 700, color: '#0D9488' }}>{selectedRecord.documentNumber || selectedRecord.entityId}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>AI Output Summary</span>
                  <span style={{ background: '#F8FAFC', padding: 8, borderRadius: 6, color: '#0F172A' }}>
                    {selectedRecord.outputSummary}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Human Reviewer</span>
                  <span>{selectedRecord.reviewer || 'None'} ({selectedRecord.reviewerRole || 'N/A'})</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                  <span style={{ color: '#64748B' }}>Decision</span>
                  <span style={{ fontWeight: 700 }}>{selectedRecord.reviewDecision || 'Pending'}</span>
                </div>
                {selectedRecord.remarks && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderBottom: '1px solid #F1F5F9', paddingBottom: 6 }}>
                    <span style={{ color: '#64748B' }}>Remarks</span>
                    <span style={{ background: '#FFFBEB', padding: 8, borderRadius: 6, fontStyle: 'italic' }}>
                      {selectedRecord.remarks}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748B' }}>Recorded At</span>
                  <span>{new Date(selectedRecord.createdAt).toLocaleString('en-PH')}</span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                <Button title="Close" variant="secondary" size="sm" onClick={() => setSelectedRecord(null)} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AiErrorBoundary>
  );
};

export default AIOutputHistory;
