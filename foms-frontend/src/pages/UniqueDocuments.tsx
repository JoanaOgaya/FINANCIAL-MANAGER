import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUniqueDocuments } from '../hooks/useDuplicates';
import { DataTable, type Column } from '../components/shared/DataTable';
import FilterBar from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import { PageHeader } from '../components/shared/PageHeader';
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

  const columns: Column<UniqueDocumentItem>[] = [
    {
      key: 'id',
      label: 'RECORD ID',
      render: (row) => <span style={{ fontWeight: 700, color: '#0F172A' }}>{row.id}</span>,
    },
    {
      key: 'type',
      label: 'DOCUMENT TYPE',
      render: (row) => (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: row.type === 'Invoice' ? '#EFF6FF' : '#F0FDF4',
            color: row.type === 'Invoice' ? '#2563EB' : '#16A34A',
          }}
        >
          {row.type}
        </span>
      ),
    },
    {
      key: 'orInvoiceNumber',
      label: 'OR / INVOICE NUMBER',
      render: (row) => <span>{row.orInvoiceNumber || '—'}</span>,
    },
    {
      key: 'clientName',
      label: 'CLIENT / ENTITY',
      render: (row) => <span>{row.clientName}</span>,
    },
    {
      key: 'amount',
      label: 'AMOUNT',
      align: 'right',
      render: (row) => (
        <span style={{ fontWeight: 700 }}>
          {row.amount !== undefined
            ? `₱${row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : 'N/A'}
        </span>
      ),
    },
    {
      key: 'transactionDate',
      label: 'TRANSACTION DATE',
      render: (row) => <span style={{ color: '#64748B' }}>{row.transactionDate}</span>,
    },
    {
      key: 'aiConfidence',
      label: 'UNIQUENESS SCORE',
      render: (row) => (
        <span style={{ color: '#0D9488', fontWeight: 700 }}>
          {row.aiConfidence}% Unique
        </span>
      ),
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  const filterFields = [
    {
      key: 'docType',
      label: 'DOCUMENT TYPE',
      type: 'select' as const,
      options: [
        { label: 'Invoice', value: 'Invoice' },
        { label: 'Official Receipt', value: 'Receipt' },
        { label: 'Liquidation Voucher', value: 'Liquidation' },
      ],
    },
    {
      key: 'dateFrom',
      label: 'TRANSACTION DATE',
      type: 'date' as const,
    },
  ];

  const filterValues = {
    docType: docTypeFilter,
    dateFrom,
  };

  const handleFieldChange = (key: string, value: string) => {
    if (key === 'docType') setDocTypeFilter(value);
    if (key === 'dateFrom') setDateFrom(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Unique Documents"
        subtitle={
          scope === 'liquidation'
            ? 'Verified unique documents for liquidation expenses and driver reimbursements.'
            : scope === 'own'
            ? 'Verified unique documents within your accounting portfolio scope.'
            : 'All system-verified unique financial and billing documents.'
        }
      />

      {scope === 'liquidation' && (
        <div style={{ padding: '8px 14px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', fontSize: '0.8rem', color: '#0369A1', fontWeight: 600 }}>
          <i className="ti ti-filter" style={{ marginRight: 6 }} />
          Showing Liquidation &amp; Expense Documents Scope for Assistant FM
        </div>
      )}

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by ID, invoice, or client…"
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
        emptyMessage="No unique documents found."
        renderActions={(row) => (
          <Button
            title="Inspect"
            variant="secondary"
            size="sm"
            onClick={() => setSelectedDoc(row)}
          />
        )}
      />

      {/* Document Details Modal */}
      {selectedDoc && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setSelectedDoc(null)}
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
                Document Inspection — {selectedDoc.id}
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748B' }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Document Number</span>
                <span style={{ fontWeight: 600 }}>{selectedDoc.orInvoiceNumber || 'N/A'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Client Name</span>
                <span style={{ fontWeight: 600 }}>{selectedDoc.clientName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Amount</span>
                <span style={{ fontWeight: 700 }}>
                  {selectedDoc.amount !== undefined
                    ? `₱${selectedDoc.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
                    : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Transaction Date</span>
                <span>{selectedDoc.transactionDate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Source</span>
                <span>{selectedDoc.source}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Uniqueness Confidence</span>
                <span style={{ color: '#0D9488', fontWeight: 700 }}>{selectedDoc.aiConfidence}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Reviewed By</span>
                <span>{selectedDoc.reviewedBy}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Status</span>
                <StatusBadge status={selectedDoc.status} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <Button title="Close" variant="secondary" size="sm" onClick={() => setSelectedDoc(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniqueDocuments;
