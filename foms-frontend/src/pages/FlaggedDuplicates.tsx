import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFlaggedDuplicates } from '../hooks/useDuplicates';
import { duplicatesService, type DuplicateFlagItem } from '../services/duplicates.service';
import StatusBadge from '../components/shared/StatusBadge';
import { PageHeader } from '../components/shared/PageHeader';
import Button from '../components/Buttons';
import ConfirmModal from '../components/shared/ConfirmModal';
import { useToast } from '../components/ToastContext';
import {
  canDecideDuplicate,
  canReviewDuplicate,
  canApproveOwnCheck,
  DUPLICATE_STATUS_LABELS,
} from '../utils/duplicateWorkflow';
import { DuplicateReviewPanel } from '../components/ai/DuplicateReviewPanel';
import { ROLES } from '../types/auth';

type ActionModalType = 'mark_duplicate' | 'mark_not_duplicate' | 'approve' | 'return' | null;

export const FlaggedDuplicates: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const isHeadAccountant = user?.role === ROLES.HEAD_ACCOUNTANT;
  const isFinancialManager = user?.role === ROLES.FINANCIAL_MANAGER;
  const initialStatus = isHeadAccountant ? 'PENDING_REVIEW' : '';

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
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    applyFilters,
    resetFilters,
    scope,
  } = useFlaggedDuplicates({ initialStatus });

  const [activeItem, setActiveItem] = useState<DuplicateFlagItem | null>(null);
  const [modalAction, setModalAction] = useState<ActionModalType>(null);
  const [remarks, setRemarks] = useState('');
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inspectDoc, setInspectDoc] = useState<DuplicateFlagItem | null>(null);
  const [reviewPanelDoc, setReviewPanelDoc] = useState<DuplicateFlagItem | null>(null);

  const currentUserId = user?.id || user?.employeeId;

  const handleOpenAction = (item: DuplicateFlagItem, action: ActionModalType) => {
    setActiveItem(item);
    setModalAction(action);
    setRemarks('');
    setValidationError('');
  };

  const handleCloseModal = () => {
    setActiveItem(null);
    setModalAction(null);
    setRemarks('');
    setValidationError('');
  };

  const handleActionSubmit = async () => {
    if (!activeItem || !modalAction) return;

    if ((modalAction === 'mark_duplicate' || modalAction === 'mark_not_duplicate' || modalAction === 'return') && !remarks.trim()) {
      setValidationError('Remarks and justification are required for this action.');
      return;
    }

    if (modalAction === 'approve') {
      const sodCheck = canApproveOwnCheck(currentUserId, activeItem.decidedBy);
      if (!sodCheck.allowed) {
        setValidationError(sodCheck.reason || 'You cannot approve your own decision.');
        return;
      }
    }

    setIsSubmitting(true);
    setValidationError('');
    try {
      const reviewerName = user?.fullName || user?.employeeId || 'Reviewer';
      if (modalAction === 'mark_duplicate') {
        await duplicatesService.decideDuplicate(activeItem.id, {
          decision: 'DUPLICATE',
          remarks: remarks.trim(),
          reviewer: reviewerName,
        });
        toast.success(`Marked flag ${activeItem.flagId} as Duplicate. Forwarded to Head Accountant for Review.`);
      } else if (modalAction === 'mark_not_duplicate') {
        await duplicatesService.decideDuplicate(activeItem.id, {
          decision: 'NOT_DUPLICATE',
          remarks: remarks.trim(),
          reviewer: reviewerName,
        });
        toast.info(`Marked flag ${activeItem.flagId} as Not Duplicate. Forwarded to Head Accountant for Review.`);
      } else if (modalAction === 'approve') {
        await duplicatesService.reviewDecision(activeItem.id, {
          action: 'APPROVE',
          remarks: remarks.trim() || undefined,
          reviewer: reviewerName,
        });
        toast.success(`Approved decision for ${activeItem.flagId}. Official status updated.`);
      } else if (modalAction === 'return') {
        await duplicatesService.reviewDecision(activeItem.id, {
          action: 'RETURN',
          remarks: remarks.trim(),
          reviewer: reviewerName,
        });
        toast.warning(`Returned flag ${activeItem.flagId} to Accountant with remarks.`);
      }
      handleCloseModal();
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed to execute.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalPages = Math.ceil(items.length / pageSize) || 1;
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {scope === 'liquidation' && (
        <div style={{ padding: '10px 16px', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '10px', fontSize: '0.85rem', color: '#0369A1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-filter" />
          Assistant FM Scope: Liquidation &amp; Expense Documents Only
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
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 16 }} />
            <input
              type="text"
              placeholder="Search flags, doc number, client..."
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            {Object.entries(DUPLICATE_STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

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
            <strong>Error loading flagged duplicates:</strong> {error.message || 'Unknown error'}
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
          <div style={{ fontWeight: 600 }}>Loading flagged duplicates...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', color: '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>
            <i className="ti ti-copy-check" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No flagged duplicate documents found</div>
          <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
            There are currently no AI-detected duplicate documents requiring attention.
          </p>
        </div>
      )}

      {/* Cards Grid */}
      {!isLoading && !error && items.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {paginatedItems.map((row) => {
            const sim = row.similarity ?? 0;
            const isExact = sim >= 95 || (row.matchType && row.matchType.toUpperCase().includes('EXACT'));
            const canDecide = canDecideDuplicate(user?.role, row.status, row.documentType);
            const canReview = canReviewDuplicate(user?.role, row.status, row.documentType);
            const sodCheck = canApproveOwnCheck(currentUserId, row.decidedBy);

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
                {/* Top Row: Flag ID + Match Type Pill + Similarity */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0F172A' }}>
                      FLAG # <span>{row.flagId}</span>
                    </span>
                    <span style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: 800,
                      background: isExact ? '#FEF2F2' : '#FFFBEB',
                      color: isExact ? '#EF4444' : '#D97706',
                    }}>
                      {row.matchType || (isExact ? 'EXACT MATCH' : 'PARTIAL MATCH')}
                    </span>
                  </div>

                  <span style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: isExact ? '#DC2626' : '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <i className="ti ti-flame" />
                    {sim}% Match
                  </span>
                </div>

                {/* Source Document Number & Client */}
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {row.uploadedNumber || '—'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                      {row.clientName || 'General Client'}
                    </span>
                  </div>
                </div>

                {/* Matched Record Box */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>Matched Record</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.existingRecord && row.existingRecord !== 'N/A' ? '#4338CA' : '#94A3B8' }}>
                      {row.existingRecord || 'N/A'}
                    </span>
                  </div>
                  {row.duplicateReason && (
                    <div style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic', marginTop: 2 }}>
                      {row.duplicateReason.replace(/â,±/g, '₱')}
                    </div>
                  )}
                </div>

                {/* Workflow Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                    Flagged: {row.flaggedDate || 'Recent'}
                  </span>
                  <StatusBadge status={row.status} />
                </div>

                {/* Actions Footer */}
                <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <Button
                    title="Inspect"
                    variant="secondary"
                    size="sm"
                    icon="ti-eye"
                    onClick={() => setInspectDoc(row)}
                  />

                  {/* Level 1: Accountant / Asst FM Decision Actions */}
                  {canDecide && (
                    <>
                      <Button
                        title="Mark Real Duplicate"
                        variant="danger"
                        size="sm"
                        onClick={() => handleOpenAction(row, 'mark_duplicate')}
                      />
                      <Button
                        title="Mark False Positive"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAction(row, 'mark_not_duplicate')}
                      />
                    </>
                  )}

                  {/* Level 2: Head Accountant / FM Review Actions */}
                  {canReview && (
                    <>
                      <Button
                        title="Review"
                        variant="primary"
                        size="sm"
                        onClick={() => setReviewPanelDoc(row)}
                      />
                      {sodCheck.allowed ? (
                        <Button
                          title="Approve"
                          variant="success"
                          size="sm"
                          onClick={() => handleOpenAction(row, 'approve')}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: '#EF4444',
                            fontWeight: 600,
                            padding: '4px 8px',
                            background: '#FEF2F2',
                            borderRadius: 4,
                            border: '1px solid #FECACA',
                          }}
                          title="You cannot approve your own decision"
                        >
                          Cannot Self-Approve
                        </span>
                      )}
                      <Button
                        title="Return"
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenAction(row, 'return')}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !error && items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 4px', fontSize: 13, color: '#64748B' }}>
          <div>
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, items.length)} of {items.length} records
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

      {/* Level 1 & Level 2 Action Modal */}
      {modalAction && activeItem && (
        <ConfirmModal
          isOpen={true}
          title={
            modalAction === 'mark_duplicate'
              ? `Mark Real Duplicate — ${activeItem.flagId}`
              : modalAction === 'mark_not_duplicate'
              ? `Mark False Positive — ${activeItem.flagId}`
              : modalAction === 'approve'
              ? `Approve Decision — ${activeItem.flagId}`
              : `Return to Accountant — ${activeItem.flagId}`
          }
          message={
            modalAction === 'mark_duplicate'
              ? `Marking ${activeItem.uploadedNumber} as a duplicate of ${activeItem.existingRecord}. This moves the record to PENDING_REVIEW for Head Accountant supervisor approval.`
              : modalAction === 'mark_not_duplicate'
              ? `Marking ${activeItem.uploadedNumber} as legitimate and NOT a duplicate. This moves the record to PENDING_REVIEW for Head Accountant supervisor approval.`
              : modalAction === 'approve'
              ? `Approve the Accountant's decision on ${activeItem.flagId}? Official system records will be updated upon your approval.`
              : `Returning flag ${activeItem.flagId} back to the Accountant for re-examination. Please provide required remarks explaining why.`
          }
          variant={modalAction === 'mark_duplicate' ? 'danger' : 'primary'}
          confirmLabel={
            isSubmitting
              ? 'Processing…'
              : modalAction === 'mark_duplicate'
              ? 'Mark Real Duplicate'
              : modalAction === 'mark_not_duplicate'
              ? 'Mark False Positive'
              : modalAction === 'approve'
              ? 'Approve'
              : 'Return'
          }
          onCancel={handleCloseModal}
          onConfirm={handleActionSubmit}
        >
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
              {modalAction === 'approve'
                ? 'Approval Notes (Optional)'
                : 'Justification Remarks (Required) *'}
            </label>
            <textarea
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder={
                modalAction === 'mark_duplicate'
                  ? 'Required: Explain why this record is confirmed as a duplicate...'
                  : modalAction === 'mark_not_duplicate'
                  ? 'Required: Explain why this document is unique and not a duplicate...'
                  : modalAction === 'return'
                  ? 'Required: Explain why the decision is returned to the Accountant...'
                  : 'Optional approval notes...'
              }
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                border: `1px solid ${validationError ? '#EF4444' : '#CBD5E1'}`,
                fontSize: '0.85rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
            {validationError && (
              <span style={{ color: '#DC2626', fontSize: '0.78rem', fontWeight: 600, marginTop: 4, display: 'block' }}>
                {validationError}
              </span>
            )}
          </div>
        </ConfirmModal>
      )}

      {/* Level 2 Side-by-Side Review Panel */}
      {reviewPanelDoc && (
        <DuplicateReviewPanel
          isOpen={true}
          item={reviewPanelDoc}
          onClose={() => setReviewPanelDoc(null)}
          onApprove={async (apprRemarks) => {
            try {
              await duplicatesService.reviewDecision(reviewPanelDoc.id, {
                action: 'APPROVE',
                remarks: apprRemarks,
                reviewer: user?.fullName || user?.employeeId || 'Reviewer',
              });
              toast.success(`Approved duplicate decision for ${reviewPanelDoc.flagId}.`);
              setReviewPanelDoc(null);
              refetch();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Approval failed.');
            }
          }}
          onReturn={async (retRemarks) => {
            try {
              await duplicatesService.reviewDecision(reviewPanelDoc.id, {
                action: 'RETURN',
                remarks: retRemarks,
                reviewer: user?.fullName || user?.employeeId || 'Reviewer',
              });
              toast.warning(`Returned flag ${reviewPanelDoc.flagId} to Accountant.`);
              setReviewPanelDoc(null);
              refetch();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Return failed.');
            }
          }}
        />
      )}

      {/* Inspect Modal */}
      {inspectDoc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => setInspectDoc(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 26,
              maxWidth: 520,
              width: '92%',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              border: '1px solid #E2E8F0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
                  Flag Inspection
                </h3>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Flag ID #{inspectDoc.flagId}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectDoc(null)}
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
                  color: '#64748B'
                }}
              >
                &times;
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Source Document</span>
                <strong style={{ color: '#0F172A' }}>{inspectDoc.uploadedNumber}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Matched Record</span>
                <strong style={{ color: '#4338CA' }}>{inspectDoc.existingRecord}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Client Name</span>
                <span style={{ fontWeight: 600 }}>{inspectDoc.clientName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>AI Similarity</span>
                <strong style={{ color: (inspectDoc.similarity ?? 0) >= 95 ? '#EF4444' : '#D97706', fontWeight: 800 }}>
                  {inspectDoc.similarity !== undefined ? `${inspectDoc.similarity}% Match` : 'N/A'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Match Reason</span>
                <span style={{ fontStyle: 'italic' }}>{inspectDoc.duplicateReason}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                <span style={{ color: '#64748B' }}>Workflow Status</span>
                <StatusBadge status={inspectDoc.status} />
              </div>
              {inspectDoc.decision && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: 8 }}>
                  <span style={{ color: '#64748B' }}>Level 1 Decision</span>
                  <strong>{inspectDoc.decision}</strong>
                </div>
              )}
              {inspectDoc.decidedRemarks && (
                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 8, marginTop: 4 }}>
                  <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem', fontWeight: 700, marginBottom: 2 }}>
                    Accountant Remarks:
                  </span>
                  <span style={{ color: '#334155' }}>{inspectDoc.decidedRemarks}</span>
                </div>
              )}
            </div>

            <div style={{ marginTop: 22, display: 'flex', justifyContent: 'flex-end' }}>
              <Button title="Close" variant="secondary" size="sm" onClick={() => setInspectDoc(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlaggedDuplicates;
