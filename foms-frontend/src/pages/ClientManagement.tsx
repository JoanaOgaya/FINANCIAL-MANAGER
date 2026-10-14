import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Button } from '../components/Buttons';
import { Card } from '../components/Card';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import { clientsService } from '../services/clientsService';
import { invoicesService } from '../services/invoicesService';
import { paymentsService } from '../services/paymentsService';
import { waybillsService } from '../services/waybillsService';
import { ratesService } from '../services/ratesService';
import { auditLogsService } from '../services/auditLogsService';
import type { Client, Invoice, Payment, Waybill, BillingRate } from '../types/entities';
import { TableContainer } from '../components/TableContainer';
import { Dropdown } from '../components/Dropdown';
import { Users, FileText, Phone, Mail, MapPin, Calendar as CalIcon, Hash, Settings, CreditCard } from 'lucide-react';
import { CalendarPicker } from '../components/FormModals';
import { computeFreightCost } from '../utils/billing';
import { formatCurrency, formatDate } from '../utils/format';
import { AiDisclaimer } from '../components/ai/AiDisclaimer';
import { PriorityBadge } from '../components/ai/PriorityBadge';

export const ClientManagement: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: clientsData, refetch: refetchClients } = useQuery('clients:list', () => clientsService.list({ pageSize: 100 }));
  const { data: invoicesData } = useQuery('clients:invoices', () => invoicesService.list({ pageSize: 100 }));
  const { data: paymentsData } = useQuery('clients:payments', () => paymentsService.list({ pageSize: 100 }));
  const { data: waybillsData } = useQuery('clients:waybills', () => waybillsService.list({ pageSize: 100 }));
  const { data: ratesData } = useQuery('clients:rates', () => ratesService.list({ pageSize: 100 }));

  const clients: Client[] = clientsData?.items || [];
  const invoices: Invoice[] = invoicesData?.items || [];
  const payments: Payment[] = paymentsData?.items || [];
  const waybills: Waybill[] = waybillsData?.items || [];
  const billingRates: BillingRate[] = ratesData?.items || [];

  // List view state
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form State (used for both Edit and Add)
  const [formData, setFormData] = useState({
    name: '',
    contactPerson: '',
    contactNumber: '',
    address: '',
    rateType: 'Standard',
    billingSchedule: 'Monthly',
    status: 'Active'
  });

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any | null>(null);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<any | null>(null);
  const [billingDateFrom, setBillingDateFrom] = useState('');
  const [billingDateTo, setBillingDateTo] = useState('');
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo, setPaymentDateTo] = useState('');

  // Sync form data when editing client changes (for Detail View)
  useEffect(() => {
    if (id) {
      const client = clients.find(c => c.id === id);
      if (client && !isEditMode) {
        setFormData({
          name: client.name,
          contactPerson: client.contactPerson,
          contactNumber: client.phone || '',
          address: client.address,
          rateType: 'Standard',
          billingSchedule: client.billingSchedule,
          status: client.status
        });
      }
    }
  }, [id, clients, isEditMode]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDownloadReceipt = () => {
    if (!selectedReceiptForModal) return;
    const editingClient = clients.find(c => c.id === id);
    
    const receiptHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Official Receipt - ${selectedReceiptForModal.orNumber || selectedReceiptForModal.referenceNumber || selectedReceiptForModal.id}</title>
          <style>
            body { font-family: 'Inter', 'Segoe UI', sans-serif; padding: 40px; color: #334155; background: #fff; }
            .receipt-container { border: 2px solid #E2E8F0; padding: 40px; border-radius: 8px; max-width: 800px; margin: 0 auto; background: #F8FAFC; box-sizing: border-box; }
            .text-center { text-align: center; }
            h2 { margin: 0 0 8px 0; color: #0F172A; font-size: 1.5rem; font-weight: 900; letter-spacing: -0.5px; }
            p { margin: 0; color: #475569; font-size: 0.9rem; }
            h3 { margin-top: 32px; color: #2563EB; letter-spacing: 3px; text-transform: uppercase; font-size: 1.3rem; font-weight: 800; }
            .flex-between { display: flex; justify-content: space-between; margin-bottom: 32px; border-bottom: 1px dashed #CBD5E1; padding-bottom: 24px; }
            .info-p { margin: 0 0 6px 0; font-size: 0.95rem; }
            strong { color: #0F172A; }
            .text-right { text-align: right; }
            .highlight { color: #EF4444; font-weight: 700; font-size: 1.1rem; }
            .amount-text { font-size: 1.1rem; line-height: 1.8; color: #334155; margin-bottom: 40px; }
            .amount-val { color: #0F172A; font-size: 1.2rem; text-decoration: underline; font-weight: bold; }
            .sign-area { display: flex; justify-content: flex-end; margin-top: 64px; }
            .sign-box { width: 250px; text-align: center; }
            .sign-line { border-bottom: 1px solid #0F172A; margin-bottom: 8px; padding-bottom: 4px; }
          </style>
        </head>
        <body>
          <div class="receipt-container">
            <div class="text-center" style="margin-bottom: 32px;">
              <h2>FOMS COURIER & FORWARDER, INC.</h2>
              <p>123 Logistics Way, Transport City, Metro Manila</p>
              <p>VAT Reg. TIN: 000-123-456-000</p>
              <h3>Official Receipt</h3>
            </div>
            
            <div class="flex-between">
              <div>
                <p class="info-p"><strong>Received From:</strong> ${selectedReceiptForModal.clientName || editingClient?.name}</p>
                <p class="info-p"><strong>Address:</strong> ${editingClient?.address || 'N/A'}</p>
              </div>
              <div class="text-right">
                <p class="info-p"><strong>Date:</strong> ${new Date(selectedReceiptForModal.recordedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                <p class="info-p"><strong>O.R. No.:</strong> <span class="highlight">${selectedReceiptForModal.orNumber || selectedReceiptForModal.referenceNumber || selectedReceiptForModal.id}</span></p>
                <p class="info-p"><strong>Method:</strong> ${selectedReceiptForModal.paymentMethod}</p>
              </div>
            </div>
            
            <p class="amount-text">
              Received the sum of <span class="amount-val">PHP ${selectedReceiptForModal.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> in partial/full payment of <strong>Invoice No. ${selectedReceiptForModal.invoiceNumber || selectedReceiptForModal.invoiceId || 'N/A'}</strong>.
            </p>
            
            <div class="sign-area">
              <div class="sign-box">
                <div class="sign-line">
                  <strong>Crystalyn Joyce C. Fajardo</strong>
                </div>
                <span style="font-size: 0.85rem; color: #64748B; text-transform: uppercase; letter-spacing: 1px;">Authorized Representative</span>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([receiptHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OR_${selectedReceiptForModal.orNumber || selectedReceiptForModal.referenceNumber || selectedReceiptForModal.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Official Receipt downloaded successfully!');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (id) {
      try {
        await clientsService.update(id, {
          name: formData.name,
          contactPerson: formData.contactPerson,
          phone: formData.contactNumber,
          address: formData.address,
          billingSchedule: formData.billingSchedule as any,
          status: formData.status as any,
        });
        await auditLogsService.create({
          action: 'UPDATE_CLIENT',
          module: 'ClientManagement',
          recordId: id,
          recordType: 'Client',
          details: `Updated client profile: ${id}`,
          ipAddress: '127.0.0.1',
        });
        refetchClients();
        toast.success(`Client ${id} successfully updated.`);
        setIsEditMode(false);
      } catch {
        toast.error('Failed to update client.');
      }
    }
  };

  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Partial<Client> = {
        name: formData.name,
        contactPerson: formData.contactPerson,
        phone: formData.contactNumber,
        email: `${formData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`,
        address: formData.address,
        billingSchedule: formData.billingSchedule as any,
        status: formData.status as any,
        region: 'Metro Manila',
        vatStatus: 'VATable',
        vatRate: 12,
      };

      const created = await clientsService.create(payload as any);
      await auditLogsService.create({
        action: 'CREATE_CLIENT',
        module: 'ClientManagement',
        recordId: (created as any)?.id || formData.name,
        recordType: 'Client',
        details: `Created new client: ${formData.name}`,
        ipAddress: '127.0.0.1',
      });
      refetchClients();
      toast.success('Client successfully created.');
      setIsAddingNew(false);
      setFormData({
        name: '',
        contactPerson: '',
        contactNumber: '',
        address: '',
        rateType: 'Standard',
        billingSchedule: 'Monthly',
        status: 'Active'
      });
    } catch {
      toast.error('Failed to create client.');
    }
  };

  // Helper to format client IDs cleanly
  const formatClientId = (idStr?: string) => {
    if (!idStr) return '—';
    if (idStr.length > 15 && idStr.includes('-')) {
      let hash = 0;
      for (let i = 0; i < idStr.length; i++) {
        hash = ((hash << 5) - hash) + idStr.charCodeAt(i);
        hash |= 0;
      }
      const shortNum = Math.abs(hash) % 900 + 100;
      return `CA-${shortNum}`;
    }
    return idStr;
  };

  // --- List View State & Metrics ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches] = useState<string[]>(['Lazada Account', 'Shopee Express', 'Zalora Philippines', 'TikTok Shop']);

  // Recommendation Review Modal State
  const [selectedRecommendationClient, setSelectedRecommendationClient] = useState<{ client: Client; metrics: any } | null>(null);
  const [recommendationDecision, setRecommendationDecision] = useState('Accept Recommendation');
  const [recommendationRemarks, setRecommendationRemarks] = useState('');
  const [recommendationLoading, setRecommendationLoading] = useState(false);

  const handleOpenRecommendation = (client: Client, metrics?: any) => {
    const m = metrics || clientMetrics.get(client.id);
    setSelectedRecommendationClient({ client, metrics: m });
    setRecommendationDecision('Accept Recommendation');
    setRecommendationRemarks('');
  };

  const handleLogRecommendationDecision = async () => {
    if (!selectedRecommendationClient) return;
    setRecommendationLoading(true);
    try {
      const client = selectedRecommendationClient.client;
      await auditLogsService.create({
        action: 'REVIEW_RECOMMENDATION',
        module: 'ClientManagement',
        recordId: client.id,
        recordType: 'Client',
        details: `Logged recommendation review: "${recommendationDecision}" for client "${client.name}" (${client.id}). Notes: ${recommendationRemarks || 'None'}`,
        ipAddress: '127.0.0.1',
      });
      toast.success(`Recommendation decision "${recommendationDecision}" logged for ${client.name}!`, 'Review Complete');
      setSelectedRecommendationClient(null);
    } catch {
      toast.error('Failed to log recommendation decision.');
    } finally {
      setRecommendationLoading(false);
    }
  };

  // Calculate client metrics map for high performance
  const clientMetrics = useMemo(() => {
    const map = new Map<string, {
      totalBilled: number;
      totalPaid: number;
      balance: number;
      maxOverdueDays: number;
      displayDueDate: string | null;
      priorityLevel: string;
      priorityScore: number;
      priorityScoreColor: string;
      priorityBadgeBg: string;
      priorityBadgeColor: string;
      cardBorder: string;
      actionBasis: string;
    }>();

    const now = Date.now();

    clients.forEach(client => {
      const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
      const totalBilled = clientInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      const totalPaid = clientInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
      const balance = Math.max(0, totalBilled - totalPaid);

      let maxOverdueDays = 0;
      clientInvoices.forEach(inv => {
        if (inv.status === 'Overdue' || (inv.dueDate && new Date(inv.dueDate).getTime() < now && inv.status !== 'Paid')) {
          if (inv.dueDate) {
            const days = Math.max(0, Math.floor((now - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
            if (days > maxOverdueDays) maxOverdueDays = days;
          } else {
            if (maxOverdueDays === 0) maxOverdueDays = 15;
          }
        }
      });

      const activeWithDueDate = clientInvoices
        .filter(inv => inv.status !== 'Paid' && inv.dueDate)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      let displayDueDate: string | null = null;
      if (activeWithDueDate.length > 0) {
        displayDueDate = new Date(activeWithDueDate[0].dueDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }

      const cardBorder = maxOverdueDays > 0 ? '#FECACA' : '#E2E8F0';
      let actionBasis = '';

      if (client.status === 'Inactive') {
        actionBasis = 'Account is currently inactive. Contact management to reactivate service.';
      } else if (maxOverdueDays > 0) {
        actionBasis = 'Client has consistently missed payment deadlines and has an outstanding balance.';
      } else if (balance > 0) {
        actionBasis = `Account in good standing with scheduled billing cycle of ₱${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}.`;
      } else {
        actionBasis = client.address
          ? `Standard logistics billing terms with active corporate standing. Location: ${client.address}.`
          : 'Standard logistics billing terms with active corporate standing.';
      }

      let priorityLevel = 'Low Priority';
      let priorityScore = 20;
      if (client.status === 'Inactive') {
        priorityLevel = 'Inactive';
        priorityScore = 0;
      } else if (maxOverdueDays > 15) {
        priorityLevel = 'High Priority';
        priorityScore = 95;
      } else if (maxOverdueDays > 0) {
        priorityLevel = 'Medium Priority';
        priorityScore = 65;
      } else if (balance > 0) {
        priorityLevel = 'Good Standing';
        priorityScore = 30;
      }

      map.set(client.id, {
        totalBilled,
        totalPaid,
        balance,
        maxOverdueDays,
        displayDueDate,
        priorityLevel,
        priorityScore,
        priorityScoreColor: priorityScore >= 70 ? '#DC2626' : priorityScore >= 40 ? '#D97706' : '#16A34A',
        priorityBadgeBg: priorityScore >= 70 ? '#FEF2F2' : priorityScore >= 40 ? '#FFFBEB' : '#F0FDF4',
        priorityBadgeColor: priorityScore >= 70 ? '#DC2626' : priorityScore >= 40 ? '#D97706' : '#16A34A',
        cardBorder,
        actionBasis
      });
    });

    return map;
  }, [clients, invoices]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const q = searchQuery.toLowerCase().trim();
      const formattedId = formatClientId(client.id).toLowerCase();
      const matchesSearch = !q ||
        (client.name || '').toLowerCase().includes(q) ||
        (client.id || '').toLowerCase().includes(q) ||
        formattedId.includes(q) ||
        (client.contactPerson || '').toLowerCase().includes(q) ||
        (client.address || '').toLowerCase().includes(q);

      let matchesStatus = true;
      if (statusFilter === 'Active') {
        matchesStatus = client.status === 'Active';
      } else if (statusFilter === 'Inactive') {
        matchesStatus = client.status === 'Inactive';
      }

      return matchesSearch && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  const handleAddNew = () => {
    setFormData({
      name: '',
      contactPerson: '',
      contactNumber: '',
      address: '',
      rateType: 'Standard',
      billingSchedule: 'Monthly',
      status: 'Active'
    });
    setIsAddingNew(true);
  };

  const renderRecommendationModal = () => {
    if (!selectedRecommendationClient) return null;
    const { client, metrics } = selectedRecommendationClient;
    const overdueDays = metrics?.maxOverdueDays || 0;
    const displayDueDate = metrics?.displayDueDate || client.billingSchedule || '—';
    const balanceVal = metrics?.balance || 0;
    const totalBilled = metrics?.totalBilled || 0;
    const totalPaid = metrics?.totalPaid || 0;

    return createPortal(
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24
        }}
        onClick={() => setSelectedRecommendationClient(null)}
      >
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            width: '100%',
            maxWidth: 580,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '90vh'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: '28px 32px', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0D9488', letterSpacing: '0.05em', marginBottom: 4 }}>
                  {formatClientId(client.id)}
                </div>
                <h3 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
                  {client.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {client.status === 'Active' ? (
                    <span style={{ background: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} /> Active
                    </span>
                  ) : (
                    <span style={{ background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8' }} /> Inactive
                    </span>
                  )}
                  {overdueDays > 0 ? (
                    <span style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                      {overdueDays} Days Overdue
                    </span>
                  ) : (
                    <span style={{ background: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0', padding: '3px 10px', borderRadius: 9999, fontSize: 12, fontWeight: 700 }}>
                      Good Standing
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecommendationClient(null)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', padding: 4 }}
                title="Close"
              >
                <i className="ti ti-x" style={{ fontSize: 24 }} />
              </button>
            </div>

            {/* Client Information */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-user" style={{ color: '#0D9488', fontSize: 16 }} />
                Client Information
              </div>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Client Name</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{client.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Client ID</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{formatClientId(client.id)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Contact Person</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{client.contactPerson || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Contact Number</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{client.phone || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Email Address</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{client.email || '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Business Address</span>
                  <span style={{ fontWeight: 700, color: '#0F172A', textAlign: 'right', maxWidth: '60%' }}>{client.address || '—'}</span>
                </div>
              </div>
            </div>

            {/* Financial & Billing Details */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-receipt" style={{ color: '#0D9488', fontSize: 16 }} />
                Financial &amp; Billing Details
              </div>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Outstanding Balance</span>
                  <span style={{ fontWeight: 800, color: balanceVal > 0 ? '#DC2626' : '#16A34A', fontSize: '1rem' }}>
                    ₱{balanceVal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Due Date</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{displayDueDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Billing Schedule</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>{client.billingSchedule || 'Monthly'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Tax / VAT Status</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>
                    {client.vatStatus ? `${client.vatStatus} (${client.vatRate ?? 12}%)` : 'VATable (12%)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Total Invoiced</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>
                    ₱{totalBilled.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Total Payments Settled</span>
                  <span style={{ fontWeight: 700, color: '#16A34A' }}>
                    ₱{totalPaid.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setSelectedRecommendationClient(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#F1F5F9',
                  border: '1px solid #E2E8F0',
                  borderRadius: 8,
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#E2E8F0'}
                onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const clientId = client.id;
                  setSelectedRecommendationClient(null);
                  navigate(`/clients/${clientId}`);
                }}
                style={{
                  flex: 1.5,
                  padding: '12px',
                  background: '#0D9488',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#0F766E'}
                onMouseLeave={e => e.currentTarget.style.background = '#0D9488'}
              >
                <i className="ti ti-external-link" style={{ fontSize: 16 }} />
                View Full Profile
              </button>
            </div>

          </div>
        </div>
      </div>,
      document.body
    );
  };

  if (id) {
    const editingClient = clients.find(c => c.id === id);
    if (!editingClient) return <div>Client not found</div>;

    const billedInvoices = invoices.filter(inv => inv.clientId === editingClient.id);

    const totalBilled = billedInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
    const totalPaid = billedInvoices.filter(inv => inv.status === 'Paid').reduce((sum, inv) => sum + inv.totalAmount, 0);
    const currentBalance = totalBilled - totalPaid;
    const overdue = billedInvoices.filter(inv => inv.status === 'Overdue' || inv.status === 'Outstanding').reduce((sum, inv) => sum + inv.totalAmount, 0);
    const clientPayments = payments.filter(p => p.clientId === editingClient.id);

    const filteredBilledInvoices = billedInvoices.filter(inv => {
      const invDate = new Date(inv.createdAt);
      if (billingDateFrom && invDate < new Date(billingDateFrom)) return false;
      if (billingDateTo) {
        const to = new Date(billingDateTo);
        to.setHours(23, 59, 59, 999);
        if (invDate > to) return false;
      }
      return true;
    });

    const filteredClientPayments = clientPayments.filter(pay => {
      const payDate = new Date(pay.recordedAt);
      if (paymentDateFrom && payDate < new Date(paymentDateFrom)) return false;
      if (paymentDateTo) {
        const to = new Date(paymentDateTo);
        to.setHours(23, 59, 59, 999);
        if (payDate > to) return false;
      }
      return true;
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header Card */}
            <div style={{ background: '#0F172A', color: 'white', padding: '32px 24px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Company Code</p>
                  <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>{editingClient.id} · {editingClient.name}</h2>
                  <div style={{ width: 'fit-content' }}>
                    <StatusBadge status={editingClient.status} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => handleOpenRecommendation(editingClient, clientMetrics.get(editingClient.id))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#0D9488', color: '#fff', border: 'none',
                      padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#0F766E'}
                    onMouseLeave={e => e.currentTarget.style.background = '#0D9488'}
                  >
                    <i className="ti ti-eye" /> VIEW
                  </button>
                  <Button variant="secondary" title="Back to Clients" onClick={() => navigate('/clients')} />
                </div>
              </div>
            </div>

            {/* Client Profile */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} color="#64748B" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Client Profile</h3>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                {/* Row 1 */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Contact Person</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} color="#94A3B8" />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                      {editingClient.contactPerson}
                    </p>
                  </div>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Contact Number</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={14} color="#94A3B8" />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{editingClient.phone}</p>
                  </div>
                </div>

                {/* Row 2 */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Email</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={14} color="#94A3B8" />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{editingClient.email}</p>
                  </div>
                </div>


                {/* Row 3 */}
                <div style={{ gridColumn: '1 / -1' }}>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Address</p>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={14} color="#94A3B8" style={{ marginTop: '2px' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>{editingClient.address}</p>
                  </div>
                </div>

                {/* Row 4 */}
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>Registered</p>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                    {new Date(editingClient.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Billing History Card */}
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#F59E0B" />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Billing History</h3>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <CalendarPicker
                    label="From:"
                    placeholder="Start date..."
                    value={billingDateFrom}
                    onChange={date => setBillingDateFrom(date)}
                    maxDate={billingDateTo || "2026-12-31"}
                    variant="toolbar"
                  />
                  <CalendarPicker
                    label="To:"
                    placeholder="End date..."
                    value={billingDateTo}
                    onChange={date => setBillingDateTo(date)}
                    minDate={billingDateFrom}
                    maxDate="2026-12-31"
                    variant="toolbar"
                  />
                </div>
              </div>
              <div style={{ borderRadius: '8px', overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderTop: '1px solid #E2E8F0' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Invoice No.</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Invoice Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Billing Period</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Waybill Count</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Total Amount</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBilledInvoices.length > 0 ? (
                      filteredBilledInvoices.map(inv => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #E2E8F0', background: 'transparent' }}>
                          <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>
                            {inv.invoiceNumber}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>{inv.billingPeriod}</td>
                          <td style={{ padding: '12px 16px', color: '#475569' }}>
                            {(() => {
                              let count = waybills.filter(w => w.invoiceId === inv.id || w.invoiceId === inv.invoiceNumber || inv.waybillIds?.includes(w.id)).length;
                              if (count === 0) count = waybills.filter(w => w.clientCode === inv.clientId).length;
                              return count > 0 ? count : (inv.waybillIds?.length || 0);
                            })()}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>₱ {inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: '12px 16px' }}><StatusBadge status={inv.status} /></td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <Dropdown
                              items={[
                                {
                                  key: 'view-details',
                                  label: 'View Details',
                                  icon: 'ti-eye',
                                  onClick: () => setSelectedInvoiceForModal(inv)
                                }
                              ]}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No billing history found for this client.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Records Card */}
            {user?.role === 'ACCOUNTANT' && (
              <div style={{ background: '#fff', border: '1px solid #E2E8F0', padding: '24px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} color="#10B981" />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>Payment Records</h3>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <CalendarPicker
                      label="From:"
                      placeholder="Start date..."
                      value={paymentDateFrom}
                      onChange={date => setPaymentDateFrom(date)}
                      maxDate={paymentDateTo || "2026-12-31"}
                      variant="toolbar"
                    />
                    <CalendarPicker
                      label="To:"
                      placeholder="End date..."
                      value={paymentDateTo}
                      onChange={date => setPaymentDateTo(date)}
                      minDate={paymentDateFrom}
                      maxDate="2026-12-31"
                      variant="toolbar"
                    />
                  </div>
                </div>
                <div style={{ borderRadius: '8px', overflow: 'visible' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', borderTop: '1px solid #E2E8F0' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Payment ID / OR No.</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Payment Date</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Invoice No.</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Payment Method</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Amount Paid</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Status</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', color: '#475569', fontWeight: 600 }}>Action / Receipt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientPayments.length > 0 ? (
                        filteredClientPayments.map(pay => (
                          <tr key={pay.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {pay.orNumber || pay.referenceNumber || pay.id} <FileText size={14} color="#94A3B8" />
                            </td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>{new Date(pay.recordedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>{pay.invoiceNumber || pay.invoiceId || 'N/A'}</td>
                            <td style={{ padding: '12px 16px', color: '#475569' }}>{pay.paymentMethod}</td>
                            <td style={{ padding: '12px 16px', color: '#0F172A', fontWeight: 600 }}>₱ {pay.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td style={{ padding: '12px 16px' }}><StatusBadge status="Paid" /></td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Dropdown
                                items={[
                                  {
                                    key: 'view-details',
                                    label: 'View Details',
                                    icon: 'ti-eye',
                                    onClick: () => setSelectedReceiptForModal(pay)
                                  }
                                ]}
                              />
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} style={{ padding: '20px', textAlign: 'center', color: '#94A3B8' }}>No payment records found for this client.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal for Invoice Details */}
            {selectedInvoiceForModal && createPortal(
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={() => setSelectedInvoiceForModal(null)}>
                <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', color: '#334155', boxShadow: '0 10px 25px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                    {(() => {
                      let invoiceWaybills = waybills.filter((w: Waybill) => w.invoiceId === selectedInvoiceForModal.id || w.invoiceId === selectedInvoiceForModal.invoiceNumber || selectedInvoiceForModal.waybillIds?.includes(w.id));
                      if (invoiceWaybills.length === 0) {
                        invoiceWaybills = waybills.filter((w: Waybill) => w.clientCode === selectedInvoiceForModal.clientId);
                      }
                      
                      const earliestDate = invoiceWaybills.length > 0 
                        ? new Date(Math.min(...invoiceWaybills.map((w: Waybill) => new Date(w.deliveryDate).getTime()))) 
                        : new Date();
                        
                      return (
                        <>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Invoice details</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', fontWeight: 600 }}>{invoiceWaybills.length} waybill{invoiceWaybills.length !== 1 ? 's' : ''} - Delivered {earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          </div>
                          <button onClick={() => setSelectedInvoiceForModal(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center' }}><i className="ti ti-x" /></button>
                        </>
                      );
                    })()}
                  </div>

                  {(() => {
                    let invoiceWaybills = waybills.filter((w: Waybill) => w.invoiceId === selectedInvoiceForModal.id || w.invoiceId === selectedInvoiceForModal.invoiceNumber || selectedInvoiceForModal.waybillIds?.includes(w.id));
                    if (invoiceWaybills.length === 0) {
                      invoiceWaybills = waybills.filter((w: Waybill) => w.clientCode === selectedInvoiceForModal.clientId);
                    }
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {invoiceWaybills.map((wb: Waybill, i: number) => {
                          let fd = null;
                          let errorMsg = null;
                          let freightAmount = 0;
                          try {
                            const br = computeFreightCost(wb, billingRates);
                            fd = {
                              area: br.area || 'Unknown',
                              chargeableWeight: br.chargeableWeight,
                              weightBasis: br.volumeWeight > br.actualWeight ? 'volume weight' : 'actual weight',
                              freightCost: br.freightCost,
                              vat: br.vat || 0,
                              fuelSurcharge: br.fuelSurcharge || 0,
                            };
                            freightAmount = br.grandTotal;
                          } catch (e) {
                            errorMsg = 'No Rate config';
                          }

                          return (
                            <div key={wb.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', background: '#fff' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '0.95rem' }}>{wb.waybillNumber}</span>
                                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>Validated</span>
                                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>{fd?.area || 'NCR'}</span>
                                </div>
                                <span style={{ fontWeight: 800, color: '#0F172A', fontSize: '1rem' }}>₱{freightAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                              </div>
                              
                              <div style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontWeight: 600 }}>
                                <i className="ti ti-paperclip" style={{ fontSize: '14px', color: '#94A3B8' }}></i>
                                {wb.hasOriginalPOD ? 'Orig POD' : (wb.hasApprovedCTC ? 'CTC' : 'Missing')} - {fd ? `${fd.chargeableWeight.toFixed(2)} kg ${fd.weightBasis}` : 'Unknown weight'}
                              </div>
                              
                              <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                  <span style={{ color: '#475569', fontWeight: 600 }}>Freight</span>
                                  <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{fd?.freightCost.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                  <span style={{ color: '#475569', fontWeight: 600 }}>VAT 12%</span>
                                  <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{fd?.vat.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                                  <span style={{ color: '#475569', fontWeight: 600 }}>Fuel surcharge 15%</span>
                                  <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{fd?.fuelSurcharge.toLocaleString('en-PH', { minimumFractionDigits: 2 }) || '0.00'}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Grand Totals Card */}
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px', marginTop: '8px', background: '#FAFAFA' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: '#475569', fontWeight: 600 }}>Freight</span>
                              <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{selectedInvoiceForModal.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: '#475569', fontWeight: 600 }}>VAT 12%</span>
                              <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{selectedInvoiceForModal.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                              <span style={{ color: '#475569', fontWeight: 600 }}>Fuel surcharge 15%</span>
                              <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{selectedInvoiceForModal.surchargeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                          
                          <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>Grand total</span>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#16A34A' }}>₱{selectedInvoiceForModal.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* SHIPMENT DETAILS */}

                </div>
              </div>,
              document.body
            )}

            {/* Modal for Official Receipt */}
            {selectedReceiptForModal && createPortal(
              <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={() => setSelectedReceiptForModal(null)}>
                <div style={{ background: '#ffffff', borderRadius: '12px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', color: '#334155', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>

                  {/* Top Bar with Download Button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0F172A' }}>Official Receipt</h3>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button 
                        onClick={handleDownloadReceipt}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#10B981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }} 
                        onMouseOver={e => e.currentTarget.style.background = '#059669'} 
                        onMouseOut={e => e.currentTarget.style.background = '#10B981'}
                      >
                        <i className="ti ti-download" /> Download
                      </button>
                      <button onClick={() => setSelectedReceiptForModal(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}><i className="ti ti-x" /></button>
                    </div>
                  </div>

                  {/* Receipt Content */}
                  <div style={{ border: '2px solid #E2E8F0', padding: '40px', borderRadius: '8px', position: 'relative', background: '#F8FAFC' }}>
                    <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                      <h2 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.5px' }}>FOMS COURIER & FORWARDER, INC.</h2>
                      <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>123 Logistics Way, Transport City, Metro Manila</p>
                      <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>VAT Reg. TIN: 000-123-456-000</p>
                      <h3 style={{ marginTop: '32px', color: '#2563EB', letterSpacing: '3px', textTransform: 'uppercase', fontSize: '1.3rem', fontWeight: 800 }}>Official Receipt</h3>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', borderBottom: '1px dashed #CBD5E1', paddingBottom: '24px' }}>
                      <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.95rem' }}><strong style={{ color: '#0F172A' }}>Received From:</strong> {selectedReceiptForModal.clientName || editingClient.name}</p>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.95rem' }}><strong style={{ color: '#0F172A' }}>Address:</strong> {editingClient.address}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.95rem' }}><strong style={{ color: '#0F172A' }}>Date:</strong> {new Date(selectedReceiptForModal.recordedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.95rem' }}><strong style={{ color: '#0F172A' }}>O.R. No.:</strong> <span style={{ color: '#EF4444', fontWeight: 700, fontSize: '1.1rem' }}>{selectedReceiptForModal.orNumber || selectedReceiptForModal.referenceNumber || selectedReceiptForModal.id}</span></p>
                        <p style={{ margin: '0 0 6px 0', fontSize: '0.95rem' }}><strong style={{ color: '#0F172A' }}>Method:</strong> {selectedReceiptForModal.paymentMethod}</p>
                      </div>
                    </div>

                    <div style={{ marginBottom: '40px' }}>
                      <p style={{ fontSize: '1.1rem', lineHeight: '1.8', color: '#334155' }}>
                        Received the sum of <strong style={{ color: '#0F172A', fontSize: '1.2rem', textDecoration: 'underline' }}>PHP {selectedReceiptForModal.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> in partial/full payment of <strong style={{ color: '#0F172A' }}>Invoice No. {selectedReceiptForModal.invoiceNumber || selectedReceiptForModal.invoiceId || 'N/A'}</strong>.
                      </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '64px' }}>
                      <div style={{ width: '250px', textAlign: 'center' }}>
                        <div style={{ borderBottom: '1px solid #0F172A', marginBottom: '8px', paddingBottom: '4px' }}>
                          <strong style={{ color: '#0F172A' }}>Crystalyn Joyce C. Fajardo</strong>
                        </div>
                        <span style={{ fontSize: '0.85rem', color: '#64748B', textTransform: 'uppercase', letterSpacing: '1px' }}>Authorized Representative</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>,
              document.body
            )}

        {/* Edit Client Modal */}
        {isEditMode && createPortal(
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 99999, padding: '20px'
          }}>
            <Card style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#64748B', letterSpacing: '0.05em' }}>EDIT CLIENT</h2>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>{editingClient.id}</h3>
                </div>
                <button onClick={() => setIsEditMode(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
              </div>

              <div style={{ padding: '24px' }}>
                <form onSubmit={handleEditSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Client Name <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required type="text" name="name" value={formData.name} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Contact Person <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required type="text" name="contactPerson" value={formData.contactPerson} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Contact Number <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required type="text" name="contactNumber" value={formData.contactNumber} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Rate Type <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required type="text" name="rateType" value={formData.rateType} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Address <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required type="text" name="address" value={formData.address} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Billing Cycle</label>
                    <select name="billingSchedule" value={formData.billingSchedule} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      <option value="Monthly">Monthly</option>
                      <option value="Semi-monthly">Semi-monthly</option>
                      <option value="Weekly">Weekly</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status</label>
                    <select name="status" value={formData.status} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <Button variant="secondary" title="Cancel" type="button" onClick={() => setIsEditMode(false)} />
                    <Button variant="primary" title="Save Changes" type="submit" />
                  </div>
                </form>
              </div>
            </Card>
          </div>,
          document.body
        )}
        {renderRecommendationModal()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Modal for ADD NEW CLIENT */}
      {isAddingNew && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 99999, padding: '20px'
        }}>
          <Card style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#64748B', letterSpacing: '0.05em' }}>NEW CLIENT</h2>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>Create New Client</h3>
              </div>
              <button onClick={() => setIsAddingNew(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
            </div>

            <div style={{ padding: '24px' }}>
              <form onSubmit={handleAddNewSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Client Name <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required type="text" name="name" value={formData.name} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Contact Person <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required type="text" name="contactPerson" value={formData.contactPerson} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Contact Number <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required type="text" name="contactNumber" value={formData.contactNumber} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Rate Type <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required type="text" name="rateType" value={formData.rateType} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Address <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required type="text" name="address" value={formData.address} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Billing Cycle</label>
                  <select name="billingSchedule" value={formData.billingSchedule} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <option value="Monthly">Monthly</option>
                    <option value="Semi-monthly">Semi-monthly</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status</label>
                  <select name="status" value={formData.status} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <Button variant="secondary" title="Cancel" type="button" onClick={() => setIsAddingNew(false)} />
                  <Button variant="primary" title="Create Client" type="submit" />
                </div>
              </form>
            </div>
          </Card>
        </div>,
        document.body
      )}

      {/* Main Container Styled Matching Picture 1 */}
      <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header & Filter Bar matching Picture 1 */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>
              Client Accounts
            </h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* Add Client Button */}
              <button
                type="button"
                onClick={handleAddNew}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#0D9488',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#0F766E'}
                onMouseLeave={e => e.currentTarget.style.background = '#0D9488'}
              >
                <i className="ti ti-plus" style={{ fontSize: 15 }} />
                New Client
              </button>
            </div>
          </div>

          {/* Search Input & Status Dropdown matching Picture 1 */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <i className="ti ti-search" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#0D9488', zIndex: 2, fontSize: 18, pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 16px 10px 42px',
                  border: '1px solid #0D9488',
                  borderRadius: '9999px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  color: '#111827',
                  boxSizing: 'border-box'
                }}
              />
              {isSearchFocused && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  left: 0,
                  right: 0,
                  background: '#fff',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                  zIndex: 10,
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', fontSize: '11px', fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em', borderBottom: '1px solid #F1F5F9' }}>
                    RECENT SEARCHES
                  </div>
                  {recentSearches.map((term, idx) => (
                    <div
                      key={idx}
                      onClick={() => { setSearchQuery(term); setIsSearchFocused(false); }}
                      style={{
                        padding: '10px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        color: '#111827',
                        fontSize: '13px'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <i className="ti ti-history" style={{ color: '#64748B', fontSize: 15 }} />
                        <span style={{ fontWeight: 600 }}>{term}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>Select</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                fontSize: '0.9rem',
                outline: 'none',
                background: '#fff',
                cursor: 'pointer',
                color: '#111827'
              }}
            >
              <option value="All">Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Content View: Card Grid */}
        <div style={{ padding: 24 }}>
          {filteredClients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#9CA3AF', fontSize: 14 }}>
                <i className="ti ti-search" style={{ fontSize: 40, display: 'block', marginBottom: 12 }} />
                No matching client accounts found.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {filteredClients.map((client) => {
                  const metrics = clientMetrics.get(client.id);
                  const balance = metrics?.balance ?? 0;
                  const overdueDays = metrics?.maxOverdueDays ?? 0;
                  const dueDateDisplay = metrics?.displayDueDate || client.billingSchedule || 'Monthly';

                  return (
                    <div
                      key={client.id}
                      style={{
                        background: '#fff',
                        border: `1px solid ${metrics?.cardBorder || '#E2E8F0'}`,
                        borderRadius: 12,
                        padding: 24,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Top Row: Status (Active / Inactive) & Client ID */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {client.status === 'Active' ? (
                          <span
                            style={{
                              background: '#DCFCE7',
                              color: '#16A34A',
                              border: '1px solid #BBF7D0',
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A' }} />
                            Active
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#F1F5F9',
                              color: '#64748B',
                              border: '1px solid #E2E8F0',
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '12px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#94A3B8' }} />
                            Inactive
                          </span>
                        )}

                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '14px',
                            color: client.status === 'Active' ? '#0D9488' : '#64748B',
                            letterSpacing: '0.02em'
                          }}
                        >
                          {formatClientId(client.id)}
                        </span>
                      </div>

                      {/* Title & Contact Subtitle */}
                      <div>
                        <div
                          onClick={() => navigate(`/clients/${client.id}`)}
                          style={{ fontWeight: 800, fontSize: 18, color: '#111827', lineHeight: 1.3, cursor: 'pointer' }}
                          title="View Client Profile"
                        >
                          {client.name || 'Unknown Account'}
                        </div>
                        <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>
                          {client.contactPerson ? client.contactPerson : (client.phone || '—')}
                        </div>
                      </div>

                      {/* Details Row: 2 columns (matching OUTSTANDING BALANCE / DUE DATE in Picture 1) */}
                      <div style={{ display: 'flex', gap: 40, marginTop: 4 }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em' }}>
                            OUTSTANDING BALANCE
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 16, color: '#111827', marginTop: 4 }}>
                            ₱{balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', letterSpacing: '0.05em' }}>
                            {metrics?.displayDueDate ? 'DUE DATE' : 'BILLING CYCLE'}
                          </div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: '#111827', marginTop: 4 }}>
                            {dueDateDisplay}
                          </div>
                        </div>
                      </div>

                      {/* Overdue / Good Standing Badge */}
                      {overdueDays > 0 ? (
                        <div style={{ marginTop: 4 }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              color: '#DC2626',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            <i className="ti ti-clock" style={{ fontSize: 14 }} />
                            {overdueDays} Days Overdue
                          </div>
                        </div>
                      ) : client.status === 'Active' ? (
                        <div style={{ marginTop: 4 }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#F0FDF4',
                              border: '1px solid #BBF7D0',
                              color: '#16A34A',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            <i className="ti ti-circle-check" style={{ fontSize: 14 }} />
                            Good Standing
                          </div>
                        </div>
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#F8FAFC',
                              border: '1px solid #E2E8F0',
                              color: '#64748B',
                              padding: '6px 12px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 700
                            }}
                          >
                            <i className="ti ti-ban" style={{ fontSize: 14 }} />
                            Inactive Account
                          </div>
                        </div>
                      )}

                      {/* Client Details Preview */}
                      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#64748B' }}>
                        {client.phone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <i className="ti ti-phone" style={{ fontSize: 14, color: '#0D9488' }} />
                            <span>{client.phone}</span>
                          </div>
                        )}
                        {client.address && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <i className="ti ti-map-pin" style={{ fontSize: 14, color: '#0D9488', flexShrink: 0 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.address}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Button (solid teal matching Picture 1) */}
                      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenRecommendation(client, metrics)}
                          style={{
                            width: '100%',
                            padding: '12px 0',
                            background: '#0D9488',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                            transition: 'background 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = '#0F766E'}
                          onMouseLeave={e => e.currentTarget.style.background = '#0D9488'}
                        >
                          VIEW
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
      {renderRecommendationModal()}
    </div>
  );
};

export default ClientManagement;
