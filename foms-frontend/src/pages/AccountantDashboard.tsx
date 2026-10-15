import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import { invoicesService } from '../services/invoicesService';
import { waybillsService } from '../services/waybillsService';
import { clientsService } from '../services/clientsService';
import { auditLogsService } from '../services/auditLogsService';
import { speedpayService } from '../services/speedpayService';
import { KpiCard } from '../components/shared/KpiCard';
import { RecentActivity } from '../components/RecentActivity';
import { formatDate } from '../utils/format';
import type { Invoice, Waybill, Client, AuditLog, SpeedPaySubmission } from '../types/entities';
import {
  DashboardBanner, WorkQueue, QuickActions, Pipeline, peso, QueueItem,
} from '../components/DashboardWidgets';

/**
 * ACCOUNTANT DASHBOARD — "My Workspace"
 * The accountant PREPARES: bills validated waybills, drafts invoices, fixes
 * returned invoices, records payments and follows up on collections.
 */
export const AccountantDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: invoicesData } = useQuery('acc:invoices', () => invoicesService.list({ pageSize: 100 }));
  const { data: waybillsData } = useQuery('acc:waybills', () => waybillsService.list({ pageSize: 100 }));
  const { data: clientsData } = useQuery('acc:clients', () => clientsService.list({ pageSize: 100 }));
  const { data: auditData } = useQuery('acc:audit', () => auditLogsService.list({ pageSize: 20 }));
  const { data: speedPayData } = useQuery('acc:speedpay', () => speedpayService.list({ pageSize: 100 }));

  const invoices: Invoice[] = invoicesData?.items || [];
  const waybills: Waybill[] = waybillsData?.items || [];
  const clients: Client[] = clientsData?.items || [];
  const auditLogs: AuditLog[] = auditData?.items || [];
  const speedPay: SpeedPaySubmission[] = speedPayData?.items || [];

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || id;
  const firstName = (user?.fullName || 'Accountant').split(' ')[0];

  // Waybills that are validated but not yet on any invoice
  const readyToBill = waybills.filter(
    (w: Waybill) => (w.status === 'Validated' || w.status === 'Validated (CTC)') && !w.invoiceId
  );
  const drafts = invoices.filter((i: Invoice) => i.status === 'Draft');
  const needsRevision = invoices.filter((i: Invoice) => i.status === 'Needs Revision');
  const overdue = invoices.filter((i: Invoice) => i.status === 'Overdue' || i.status === 'Outstanding');
  const dueSoon = invoices.filter((i: Invoice) => {
    if (i.status !== 'Sent') return false;
    const days = Math.ceil((new Date(i.dueDate).getTime() - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  });
  const pendingApproval = invoices.filter((i: Invoice) => i.status === 'Pending Approval');
  const toRecordPayment = invoices.filter((i: Invoice) => i.status === 'Sent' || i.status === 'Overdue' || i.status === 'Outstanding');
  const pendingSpeedPay = speedPay.filter((s: SpeedPaySubmission) => s.status === 'Pending Validation').length;

  // Work queue: things the accountant must act on, most urgent first
  const queue: QueueItem[] = [
    ...needsRevision.map((i: Invoice) => ({
      id: `rev-${i.id}`, tag: 'Returned', tagColor: '#DC2626', tagBg: '#FEF2F2',
      title: `${i.invoiceNumber} — ${clientName(i.clientId)}`,
      subtitle: i.notes ? `Head Accountant: ${i.notes}` : 'Returned by Head Accountant — please revise & resubmit',
      amount: i.totalAmount, actionLabel: 'Fix', onClick: () => navigate('/invoicing-desk'),
    })),
    ...overdue.map((i: Invoice) => ({
      id: `od-${i.id}`, tag: 'Overdue', tagColor: '#B45309', tagBg: '#FEF3C7',
      title: `${i.invoiceNumber} — ${clientName(i.clientId)}`,
      subtitle: `Was due ${formatDate(i.dueDate)} — follow up for payment`,
      amount: i.totalAmount, actionLabel: 'Record Payment', onClick: () => navigate('/payments'),
    })),
    ...drafts.map((i: Invoice) => ({
      id: `dr-${i.id}`, tag: 'Draft', tagColor: '#475569', tagBg: '#F1F5F9',
      title: `${i.invoiceNumber} — ${clientName(i.clientId)}`,
      subtitle: `${i.waybillIds?.length || 0} waybill(s) · ${i.billingPeriod}`,
      amount: i.totalAmount, actionLabel: 'Finish', onClick: () => navigate('/invoicing-desk'),
    })),
    ...dueSoon.map((i: Invoice) => ({
      id: `ds-${i.id}`, tag: 'Due Soon', tagColor: '#0369A1', tagBg: '#E0F2FE',
      title: `${i.invoiceNumber} — ${clientName(i.clientId)}`,
      subtitle: `Due ${formatDate(i.dueDate)}`,
      amount: i.totalAmount, actionLabel: 'View', onClick: () => navigate('/accounts-receivable'),
    })),
  ];

  const pipeline = [
    { label: 'Draft', value: drafts.length, color: '#94A3B8' },
    { label: 'For Approval', value: pendingApproval.length, color: '#F59E0B' },
    { label: 'Returned', value: needsRevision.length, color: '#EF4444' },
    { label: 'Approved', value: invoices.filter((i: Invoice) => i.status === 'Approved').length, color: '#8B5CF6' },
    { label: 'Sent / Unpaid', value: invoices.filter((i: Invoice) => i.status === 'Sent').length, color: '#3B82F6' },
    { label: 'Paid', value: invoices.filter((i: Invoice) => i.status === 'Paid').length, color: '#10B981' },
  ];

  const myActivity = auditLogs
    .filter((l: AuditLog) => l.userRole === 'Accountant' || l.action.includes('INVOICE') || l.action.includes('PAYMENT'))
    .slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <DashboardBanner
        eyebrow="Accountant · My Workspace"
        title={`Hi ${firstName}, you have ${queue.length} task${queue.length !== 1 ? 's' : ''} to work on`}
        subtitle={`${readyToBill.length} validated waybill(s) are waiting to be billed.`}
        gradient="linear-gradient(135deg, #0D9488 0%, #0F766E 55%, #115E59 100%)"
        icon="ti-file-invoice"
        cta={{ label: 'Create Invoice', icon: 'ti-file-plus', onClick: () => navigate('/invoice-create') }}
        secondaryCta={{ label: 'Record Payment', onClick: () => navigate('/payments') }}
      />

      <div className="kpi-grid">
        <KpiCard label="Ready to Bill" value={readyToBill.length} icon="ti-package" variant="new"
          trend={{ type: 'neutral', value: 'Waybills' }} periodText="validated, no invoice yet" onClick={() => navigate('/invoice-create')} />
        <KpiCard label="My Drafts" value={drafts.length} icon="ti-pencil" variant="info"
          trend={{ type: 'neutral', value: 'In progress' }} periodText="not yet submitted" onClick={() => navigate('/invoicing-desk')} />
        <KpiCard label="Returned for Revision" value={needsRevision.length} icon="ti-arrow-back-up" variant="danger"
          trend={{ type: 'neutral', value: 'Action' }} periodText="from Head Accountant" onClick={() => navigate('/invoicing-desk')} />
        <KpiCard label="Payments to Record" value={toRecordPayment.length} icon="ti-cash" variant="warning"
          trend={{ type: 'neutral', value: `${pendingSpeedPay} SpeedPay` }} periodText="unpaid invoices" onClick={() => navigate('/payments')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <WorkQueue
            title="Needs your attention"
            subtitle="Returned, overdue and draft invoices that need your attention"
            icon="ti-checklist" iconColor="#0D9488" iconBg="#CCFBF1"
            items={queue}
            emptyText="You're all caught up — nothing needs your action right now."
            onViewAll={() => navigate('/invoicing-desk')}
          />
          <Pipeline title="My Invoice Pipeline" subtitle="Where your invoices are in the approval flow" stages={pipeline} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <QuickActions
            actions={[
              { label: 'Create Invoice', description: 'Bill validated waybills', icon: 'ti-file-plus', color: '#0D9488', bg: '#CCFBF1', onClick: () => navigate('/invoice-create') },
              { label: 'Record Payment', description: 'Log a client payment', icon: 'ti-cash', color: '#2563EB', bg: '#DBEAFE', onClick: () => navigate('/payments') },
              { label: 'Official Receipts', description: 'Issue / view receipts', icon: 'ti-receipt', color: '#7C3AED', bg: '#EDE9FE', onClick: () => navigate('/receipts') },
              { label: 'Cash Flow', description: 'Log inflows & outflows', icon: 'ti-chart-arrows', color: '#D97706', bg: '#FEF3C7', onClick: () => navigate('/cash-flow') },
            ]}
          />
          <RecentActivity title="My Recent Activity" logs={myActivity} />
        </div>
      </div>

      <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'right' }}>
        Total value in your queue: <strong style={{ color: '#475569' }}>{peso(queue.reduce((s, q) => s + (q.amount || 0), 0))}</strong>
      </div>
    </div>
  );
};

export default AccountantDashboard;
