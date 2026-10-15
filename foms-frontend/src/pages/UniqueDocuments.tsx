import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUniqueDocuments } from '../hooks/useDuplicates';
import StatusBadge from '../components/shared/StatusBadge';
import Button from '../components/Buttons';
import type { UniqueDocumentItem } from '../services/duplicates.service';

const UniqueDocuments: React.FC = () => {
  const { user } = useAuth();
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
    docTypeFilter,
    setDocTypeFilter,
    dateFrom,
    setDateFrom,
    applyFilters,
    resetFilters,
    scope,
  } = useUniqueDocuments();

  const [selectedDoc, setSelectedDoc] = useState<UniqueDocumentItem | null>(null);

  const displayedItems = items.filter((row: any) => {
    if (!docTypeFilter || docTypeFilter === 'All') return true;
    const t = (row.type || row.documentType || '').toLowerCase();
    const f = docTypeFilter.toLowerCase();
    if (f === 'invoice') return t.includes('invoice');
    if (f === 'receipt' || f.includes('receipt')) return t.includes('receipt');
    if (f === 'liquidation' || f.includes('liquidation')) return t.includes('liquidation');
    return t.includes(f);
  });

  const totalPages = Math.ceil(displayedItems.length / pageSize) || 1;
  const paginatedItems = displayedItems.slice((page - 1) * pageSize, page * pageSize);

  const getTypeStyle = (typeStr?: string) => {
    const t = (typeStr || '').toLowerCase();
    if (t.includes('invoice')) {
      return { bg: '#EFF6FF', color: '#2563EB', icon: 'ti-file-invoice' };
    }
    if (t.includes('receipt')) {
      return { bg: '#F0FDF4', color: '#16A34A', icon: 'ti-receipt' };
    }
    return { bg: '#FEF3C7', color: '#D97706', icon: 'ti-file-text' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {scope === 'liquidation' && (
        <div style={{ padding: '10px 16px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', fontSize: '0.85rem', color: '#0369A1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-filter" />
          Showing Liquidation &amp; Expense Documents Scope for Assistant FM
        </div>
      )}

      {/* Filter and Search Bar */}
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
          {/* Search Input */}
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 16 }} />
            <input
              type="text"
              placeholder="Search by ID, invoice, or client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 14px 9px 38px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                fontSize: '13px',
                outline: 'none',
                background: '#F8FAFC',
                color: '#1E293B',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, background 0.2s'
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#0D9488'; e.currentTarget.style.background = '#fff'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; }}
            />
          </div>

          {/* Doc Type Filter */}
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
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
            <option value="">All Document Types</option>
            <option value="Invoice">Invoices</option>
            <option value="Receipt">Official Receipts</option>
            <option value="Liquidation">Liquidation Vouchers</option>
          </select>

          {/* Date Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Date:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid #E2E8F0',
                fontSize: '13px',
                outline: 'none',
                background: '#F8FAFC',
                color: '#334155'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => { applyFilters(); }}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#0D9488',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <i className="ti ti-check" />
            Apply
          </button>
          <button
            onClick={() => { resetFilters(); }}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              background: '#fff',
              color: '#64748B',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, color: '#991B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Error loading unique documents:</strong> {error.message || 'Unknown error'}
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
          <div style={{ fontWeight: 600 }}>Loading unique documents...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && displayedItems.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            <i className="ti ti-file-check" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No unique documents found</div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
            No verified unique records match your search or filter criteria.
          </p>
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && !error && displayedItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {paginatedItems.map((doc) => {
            const typeInfo = getTypeStyle(doc.type || doc.documentType);
            return (
              <div
                key={doc.id}
                style={{
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: 22,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative'
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
                {/* Top Row: Type Pill + Uniqueness Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: typeInfo.bg,
                    color: typeInfo.color,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}>
                    <i className={`ti ${typeInfo.icon}`} />
                    {doc.type || doc.documentType || 'Invoice'}
                  </span>
                  <span style={{
                    padding: '3px 9px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: '#CCFBF1',
                    color: '#0F766E',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <i className="ti ti-shield-check" />
                    {doc.aiConfidence}% Unique
                  </span>
                </div>

                {/* Doc Number & Client */}
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {doc.orInvoiceNumber || 'No Document Number'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                      {doc.clientName}
                    </span>
                    <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                      ID: #{doc.id}
                    </span>
                  </div>
                </div>

                {/* Amount Highlight Box */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Amount</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                    {doc.amount !== undefined
                      ? `₱${doc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'N/A'}
                  </span>
                </div>

                {/* Transaction Date & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="ti ti-calendar" style={{ color: '#94A3B8' }} />
                    <span>{doc.transactionDate || 'N/A'}</span>
                  </div>
                  <StatusBadge status={doc.status || 'VERIFIED'} />
                </div>

                {/* Footer Action */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                    Source: {doc.source || 'Internal Billing'}
                  </span>
                  <Button
                    title="Inspect"
                    variant="secondary"
                    size="sm"
                    icon="ti-eye"
                    onClick={() => setSelectedDoc(doc)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && displayedItems.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', fontSize: 13, color: '#64748B' }}>
          <div>
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, displayedItems.length)} of {displayedItems.length} records
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

      {/* Document Details Modal */}
      {selectedDoc && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => setSelectedDoc(null)}
        >
          <div
            style={{
              background: '#fff', borderRadius: 16, padding: 26, maxWidth: 520, width: '92%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid #E2E8F0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                  Document Inspection
                </h3>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Record ID #{selectedDoc.id}
                </div>
              </div>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: 18,
                  color: '#64748B',
                  transition: 'background 0.2s'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Document Number</span>
                <span style={{ fontWeight: 700, color: '#0F172A' }}>{selectedDoc.orInvoiceNumber || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Client / Entity</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{selectedDoc.clientName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Document Type</span>
                <span style={{ fontWeight: 600, color: '#0F172A' }}>{selectedDoc.type || selectedDoc.documentType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Amount</span>
                <span style={{ fontWeight: 800, color: '#0D9488', fontSize: '1rem' }}>
                  {selectedDoc.amount !== undefined
                    ? `₱${selectedDoc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Transaction Date</span>
                <span style={{ fontWeight: 600 }}>{selectedDoc.transactionDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Source</span>
                <span>{selectedDoc.source}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Uniqueness Confidence</span>
                <span style={{ color: '#0D9488', fontWeight: 800 }}>{selectedDoc.aiConfidence}% Unique</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 10 }}>
                <span style={{ color: '#64748B' }}>Verified By</span>
                <span>{selectedDoc.reviewedBy}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 4 }}>
                <span style={{ color: '#64748B' }}>Validation Status</span>
                <StatusBadge status={selectedDoc.status} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
              <Button title="Close" variant="secondary" size="sm" onClick={() => setSelectedDoc(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniqueDocuments;
