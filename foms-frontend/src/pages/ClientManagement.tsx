import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Button } from '../components/Buttons';
import { Card } from '../components/Card';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { ConfirmModal } from '../components/shared/ConfirmModal';
import { ErrorState } from '../components/shared/ErrorState';
import { getCachedQuery, useQuery } from '../hooks/useQuery';
import { useApiMutation } from '../hooks/useApiMutation';
import { queryKeys } from '../services/queryKeys';
import { invalidateForMutation } from '../services/invalidation';
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
import { getApiStatus, getRecordErrorMessage, getValidationErrors } from '../utils/apiErrors';

type ClientEditForm = {
  name: string;
  contactPerson: string;
  contactNumber: string;
  address: string;
  rateType: string;
  billingSchedule: string;
  status: string;
};

const clientFormFromRecord = (client: Client): ClientEditForm => ({
  name: client.name ?? '',
  contactPerson: client.contactPerson ?? '',
  contactNumber: client.phone ?? '',
  address: client.address ?? '',
  rateType: client.rateType ?? '',
  billingSchedule: client.billingSchedule ?? '',
  status: client.status ?? '',
});

export const ClientManagement: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: clientsData, refetch: refetchClients } = useQuery(queryKeys.clients.list({ pageSize: 100 }), () => clientsService.list({ pageSize: 100 }));
  const { data: invoicesData } = useQuery(queryKeys.invoices.list({ pageSize: 100 }), () => invoicesService.list({ pageSize: 100 }));
  const { data: paymentsData } = useQuery(queryKeys.payments.list({ pageSize: 100 }), () => paymentsService.list({ pageSize: 100 }));
  const { data: waybillsData } = useQuery(queryKeys.waybills.list({ pageSize: 100 }), () => waybillsService.list({ pageSize: 100 }));
  const { data: ratesData } = useQuery(queryKeys.rates.list({ pageSize: 100 }), () => ratesService.list({ pageSize: 100 }));
  const { data: directClient, isLoading: isDirectLoading, isFetching: isDirectFetching, error: directError, refetch: refetchDirectClient } = useQuery(
    id ? queryKeys.clients.detail(id) : null,
    () => clientsService.get(id!)
  );

  const clients: Client[] = clientsData?.items || [];
  const invoices: Invoice[] = invoicesData?.items || [];
  const payments: Payment[] = paymentsData?.items || [];
  const waybills: Waybill[] = waybillsData?.items || [];
  const billingRates: BillingRate[] = ratesData?.items || [];

  // List view state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Form State (used for both Edit and Add)
  const [formData, setFormData] = useState<ClientEditForm>({
    name: '',
    contactPerson: '',
    contactNumber: '',
    address: '',
    rateType: '',
    billingSchedule: '',
    status: ''
  });
  const [originalEditForm, setOriginalEditForm] = useState<ClientEditForm | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editConflict, setEditConflict] = useState(false);
  const [editConfirmation, setEditConfirmation] = useState<'discard' | null>(null);
  const updateClientMutation = useApiMutation(
    (clientId: string, payload: object) => clientsService.update(clientId, payload),
    { mutation: 'updateClient' },
  );
  const editIsDirty = Boolean(originalEditForm && (
    formData.name !== originalEditForm.name ||
    formData.contactPerson !== originalEditForm.contactPerson ||
    formData.contactNumber !== originalEditForm.contactNumber ||
    formData.address !== originalEditForm.address
  ));
  const billingCycleOptions = Array.from(new Set(clients.map(client => client.billingSchedule).filter(Boolean)));
  const statusOptions = Array.from(new Set(clients.map(client => client.status).filter(Boolean)));
  const rateTypeOptions = Array.from(new Set(clients.map(client => client.rateType).filter((value): value is string => Boolean(value))));

  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any | null>(null);
  const [selectedReceiptForModal, setSelectedReceiptForModal] = useState<any | null>(null);
  const [modalWaybillSearch, setModalWaybillSearch] = useState('');
  const [copiedInvoiceNumber, setCopiedInvoiceNumber] = useState(false);
  const [billingDateFrom, setBillingDateFrom] = useState('');
  const [billingDateTo, setBillingDateTo] = useState('');
  const [paymentDateFrom, setPaymentDateFrom] = useState('');
  const [paymentDateTo, setPaymentDateTo] = useState('');

  // Sync form data when editing client changes (for Detail View)
  useEffect(() => {
    if (id) {
      const client = directClient || clients.find(c => c.id === id);
      if (client && !isEditMode) {
        setFormData(clientFormFromRecord(client));
      }
    }
  }, [id, clients, directClient, isEditMode]);

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

  const handleDownloadInvoice = (inv: any, invoiceWaybills: any[]) => {
    if (!inv) return;
    const editingClient = clients.find(c => c.id === id);

    const itemsHtml = invoiceWaybills.map((wb: any, index: number) => {
      let fd: any = null;
      let freightAmount = 0;
      try {
        const br = computeFreightCost(wb, billingRates);
        fd = {
          area: br.area || 'NCR',
          chargeableWeight: br.chargeableWeight,
          freightCost: br.freightCost,
          vat: br.vat || 0,
          fuelSurcharge: br.fuelSurcharge || 0,
        };
        freightAmount = br.grandTotal;
      } catch {
        fd = { area: 'NCR', chargeableWeight: 0, freightCost: 0, vat: 0, fuelSurcharge: 0 };
      }
      return `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: center;">${index + 1}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; font-weight: 700; color: #0F172A;">${wb.waybillNumber}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${fd.area}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0;">${wb.hasOriginalPOD ? 'Orig POD' : (wb.hasApprovedCTC ? 'Approved CTC' : 'Pending')}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">${fd.chargeableWeight?.toFixed(2)} kg</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">PHP ${fd.freightCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">PHP ${fd.vat.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right;">PHP ${fd.fuelSurcharge.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
          <td style="padding: 10px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 700; color: #059669;">PHP ${freightAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
        </tr>
      `;
    }).join('');

    const invoiceHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice - ${inv.invoiceNumber || inv.id}</title>
          <style>
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 40px; color: #334155; background: #fff; line-height: 1.5; }
            .invoice-box { max-width: 900px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px; padding: 36px; background: #fff; }
            .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0F172A; padding-bottom: 20px; margin-bottom: 24px; }
            .company-info h2 { margin: 0 0 6px 0; color: #0F172A; font-size: 1.4rem; font-weight: 800; }
            .company-info p { margin: 2px 0; color: #64748B; font-size: 0.85rem; }
            .invoice-meta { text-align: right; }
            .invoice-meta h3 { margin: 0 0 6px 0; color: #0D9488; font-size: 1.4rem; font-weight: 800; }
            .meta-p { margin: 2px 0; font-size: 0.85rem; color: #475569; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 24px; }
            th { background: #0F172A; color: #fff; padding: 10px; font-weight: 600; text-align: left; }
            th.right { text-align: right; }
            .totals-table { width: 340px; margin-left: auto; margin-bottom: 24px; }
            .totals-table td { padding: 6px 10px; }
            .grand-total { font-size: 1.15rem; font-weight: 800; color: #059669; border-top: 2px solid #CBD5E1; }
          </style>
        </head>
        <body>
          <div class="invoice-box">
            <div class="header-row">
              <div class="company-info">
                <h2>FOMS COURIER & FORWARDER, INC.</h2>
                <p>123 Logistics Way, Transport City, Metro Manila</p>
                <p>VAT Reg. TIN: 000-123-456-000</p>
              </div>
              <div class="invoice-meta">
                <h3>BILLING STATEMENT</h3>
                <p class="meta-p"><strong>Invoice #:</strong> ${inv.invoiceNumber || inv.id}</p>
                <p class="meta-p"><strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</p>
                <p class="meta-p"><strong>Status:</strong> ${inv.status}</p>
              </div>
            </div>

            <div class="info-grid">
              <div>
                <p style="margin: 0 0 4px; font-weight: 700; color: #0F172A; font-size: 0.9rem;">Billed To:</p>
                <p style="margin: 0; font-size: 0.85rem; color: #334155;"><strong>${editingClient?.name || inv.clientId}</strong></p>
                <p style="margin: 2px 0 0; font-size: 0.85rem; color: #64748B;">${editingClient?.address || 'N/A'}</p>
                <p style="margin: 2px 0 0; font-size: 0.85rem; color: #64748B;">Contact: ${editingClient?.contactPerson || 'N/A'}</p>
              </div>
              <div>
                <p style="margin: 0 0 4px; font-weight: 700; color: #0F172A; font-size: 0.9rem;">Payment Terms & Dates:</p>
                <p style="margin: 0; font-size: 0.85rem; color: #475569;">Billing Period: <strong>${inv.billingPeriod || 'N/A'}</strong></p>
                <p style="margin: 2px 0 0; font-size: 0.85rem; color: #475569;">Due Date: <strong>${inv.dueDate ? formatDate(inv.dueDate) : 'Net 30 Days'}</strong></p>
                <p style="margin: 2px 0 0; font-size: 0.85rem; color: #475569;">Schedule: <strong>${inv.billingSchedule || 'Monthly'}</strong></p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 40px; text-align: center;">#</th>
                  <th>Waybill Number</th>
                  <th>Area</th>
                  <th>POD</th>
                  <th class="right">Weight</th>
                  <th class="right">Base Freight</th>
                  <th class="right">VAT (12%)</th>
                  <th class="right">Fuel (15%)</th>
                  <th class="right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>

            <table class="totals-table">
              <tr>
                <td style="color: #64748B;">Subtotal (Base Freight):</td>
                <td style="text-align: right; font-weight: 600;">PHP ${inv.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="color: #64748B;">VAT (12%):</td>
                <td style="text-align: right; font-weight: 600;">PHP ${inv.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td style="color: #64748B;">Fuel Surcharge (15%):</td>
                <td style="text-align: right; font-weight: 600;">PHP ${inv.surchargeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
              <tr class="grand-total">
                <td style="padding-top: 10px;">TOTAL DUE:</td>
                <td style="padding-top: 10px; text-align: right;">PHP ${inv.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([invoiceHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Invoice_${inv.invoiceNumber || inv.id}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Invoice exported successfully!');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updateClientMutation.isPending || !id) return;
    const editingClient = directClient || clients.find(client => client.id === id);
    if (!editingClient) {
      setEditError('Client details are unavailable. Retry loading the record before saving.');
      return;
    }

    const nextForm: ClientEditForm = {
      ...formData,
      name: formData.name.trim(),
      contactPerson: formData.contactPerson.trim(),
      contactNumber: formData.contactNumber.trim(),
      address: formData.address.trim(),
    };
    const errors: Record<string, string> = {};
    if (!nextForm.name) errors.name = 'Client name is required.';
    else if (nextForm.name.length > 200) errors.name = 'Client name cannot exceed 200 characters.';
    if (!nextForm.contactPerson) errors.contactPerson = 'Contact person is required.';
    else if (nextForm.contactPerson.length > 100) errors.contactPerson = 'Contact person cannot exceed 100 characters.';
    if (!nextForm.contactNumber) errors.contactNumber = 'Contact number is required.';
    else if (nextForm.contactNumber.length > 50 || !/^[+()\d\s.-]+$/.test(nextForm.contactNumber) || nextForm.contactNumber.replace(/\D/g, '').length < 7) {
      errors.contactNumber = 'Enter a valid contact number.';
    }
    if (!nextForm.address) errors.address = 'Address is required.';
    else if (nextForm.address.length > 500) errors.address = 'Address cannot exceed 500 characters.';
    if (Object.keys(errors).length > 0) {
      setEditFieldErrors(errors);
      return;
    }

    if (!editIsDirty) return;
    const clientId = editingClient.clientId || editingClient.id;
    const clientCode = editingClient.clientCode || editingClient.id;
    if (!editingClient.businessName || !editingClient.email || typeof editingClient.creditLimit !== 'number') {
      setEditError('The client API did not return all required update fields. No changes were sent.');
      return;
    }

    setIsSubmittingClient(true);
    setEditError(null);
    setEditFieldErrors({});
    setEditConflict(false);
    try {
      const updated = await updateClientMutation.mutateAsync(clientId, {
        id: clientId,
        clientCode,
        name: nextForm.name,
        businessName: editingClient.businessName,
        contactPerson: nextForm.contactPerson,
        contactNumber: nextForm.contactNumber,
        email: editingClient.email,
        address: nextForm.address,
        tin: editingClient.tin ?? null,
        creditLimit: editingClient.creditLimit,
      });
      if (!updated) return;
      setFormData(nextForm);
      setOriginalEditForm(nextForm);
      toast.success(`Client ${id} successfully updated.`);
      setIsEditMode(false);
      try {
        await auditLogsService.create({
          action: 'UPDATE_CLIENT',
          module: 'ClientManagement',
          recordId: clientId,
          recordType: 'Client',
          details: `Updated client profile: ${clientId}`,
        });
      } catch {
        toast.warning('Client updated, but the audit log could not be recorded.');
      }
    } catch (err: unknown) {
      const status = getApiStatus(err);
      setEditError(getRecordErrorMessage(err));
      setEditFieldErrors(getValidationErrors(err));
      if (status === 409) {
        setEditConflict(true);
        await refetchDirectClient();
        const latest = getCachedQuery<Client>(queryKeys.clients.detail(id));
        if (latest) {
          const latestForm = clientFormFromRecord(latest);
          setFormData(latestForm);
          setOriginalEditForm(latestForm);
        }
      }
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleCancelEdit = () => {
    if (editIsDirty) {
      setEditConfirmation('discard');
      return;
    }
    setIsEditMode(false);
    setEditError(null);
    setEditFieldErrors({});
  };

  const beginClientEdit = (client: Client) => {
    const saved = clientFormFromRecord(client);
    setFormData(saved);
    setOriginalEditForm(saved);
    setEditFieldErrors({});
    setEditError(null);
    setEditConflict(false);
    setIsEditMode(true);
    void refetchDirectClient();
  };

  const handleAddNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingClient) return;

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      const msg = 'Client name must be at least 2 characters.';
      setServerError(msg);
      toast.error(msg);
      return;
    }
    if (!formData.contactPerson.trim()) {
      const msg = 'Contact person is required.';
      setServerError(msg);
      toast.error(msg);
      return;
    }
    if (!formData.address.trim()) {
      const msg = 'Address is required.';
      setServerError(msg);
      toast.error(msg);
      return;
    }
    const isDup = clients.some(c => c.name.trim().toLowerCase() === formData.name.trim().toLowerCase());
    if (isDup) {
      const msg = 'A client with this name already exists.';
      setServerError(msg);
      toast.error(msg);
      return;
    }

    setIsSubmittingClient(true);
    setServerError(null);
    try {
      const payload: Partial<Client> = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim(),
        phone: formData.contactNumber.trim(),
        email: `${formData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@client.com`,
        address: formData.address.trim(),
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
      invalidateForMutation('createClient');
      refetchClients();
      toast.success('Client successfully created.');
      setIsAddingNew(false);
      setServerError(null);
      setFormData({
        name: '',
        contactPerson: '',
        contactNumber: '',
        address: '',
        rateType: '',
        billingSchedule: '',
        status: ''
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to create client.';
      setServerError(msg);
      toast.error(msg);
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const handleConfirmDeleteOrDeactivate = async () => {
    if (!id || isDeleting) return;
    setIsDeleting(true);
    const editingClient = clients.find(c => c.id === id) || directClient;
    if (!editingClient) return;

    try {
      if (editingClient.status === 'Active') {
        await clientsService.update(id, { status: 'Inactive' });
        await auditLogsService.create({
          action: 'DEACTIVATE_CLIENT',
          module: 'ClientManagement',
          recordId: id,
          recordType: 'Client',
          details: `Deactivated client profile: ${editingClient.name} (${id})`,
          ipAddress: '127.0.0.1',
        });
        toast.success(`Client ${editingClient.name} successfully deactivated.`);
      } else {
        try {
          await clientsService.remove(id);
          await auditLogsService.create({
            action: 'DELETE_CLIENT',
            module: 'ClientManagement',
            recordId: id,
            recordType: 'Client',
            details: `Deleted client profile: ${editingClient.name} (${id})`,
            ipAddress: '127.0.0.1',
          });
          toast.success(`Client ${editingClient.name} permanently deleted.`);
          invalidateForMutation('deleteClient');
          refetchClients();
          setShowDeleteModal(false);
          navigate('/clients');
          return;
        } catch (delErr: any) {
          if (delErr?.status === 409 || delErr?.response?.status === 409 || delErr?.message?.includes('in use')) {
            toast.error('Cannot delete, this record is in use. Client remains deactivated.');
          } else {
            throw delErr;
          }
        }
      }
      invalidateForMutation('deleteClient');
      refetchClients();
      refetchDirectClient?.();
      setShowDeleteModal(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to modify client status.');
    } finally {
      setIsDeleting(false);
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
  const recentSearches = useMemo(() => clients.slice(0, 4).map(c => c.name), [clients]);

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
      rateType: '',
      billingSchedule: '',
      status: ''
    });
    setServerError(null);
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
    const editingClient = clients.find(c => c.id === id) || directClient;

    if (!editingClient && isDirectLoading) {
      return (
        <div role="status" aria-live="polite" style={{ padding: 48, textAlign: 'center', color: '#64748B' }}>
          <i className="ti ti-loader-2 btn-spinner" style={{ fontSize: 24, display: 'inline-block', marginBottom: 12 }} />
          <div>Loading client profile details…</div>
        </div>
      );
    }

    if (!editingClient && directError) {
      return <ErrorState error={directError} onRetry={refetchDirectClient} />;
    }

    if (!editingClient) {
      return (
        <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', border: '1px solid #E2E8F0' }}>
          <i className="ti ti-user-x" style={{ fontSize: 36, color: '#94A3B8', display: 'block', marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px', color: '#0F172A' }}>Client Account Not Found</h3>
          <p style={{ color: '#64748B', margin: '0 0 20px' }}>The requested client account ID {id} does not exist or has been removed.</p>
          <Button variant="secondary" title="Back to Clients" onClick={() => navigate('/clients')} />
        </div>
      );
    }

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
                  <Button variant="secondary" title="Edit Profile" icon="ti ti-pencil" onClick={() => beginClientEdit(editingClient)} />
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
              <div>
                {filteredBilledInvoices.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {filteredBilledInvoices.map(inv => {
                      let count = waybills.filter(w => w.invoiceId === inv.id || w.invoiceId === inv.invoiceNumber || inv.waybillIds?.includes(w.id)).length;
                      if (count === 0) count = waybills.filter(w => w.clientCode === inv.clientId).length;
                      const waybillCount = count > 0 ? count : (inv.waybillIds?.length || 0);

                      return (
                        <div
                          key={inv.id}
                          style={{
                            background: '#fff',
                            border: '1px solid #E2E8F0',
                            borderRadius: '12px',
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)';
                            e.currentTarget.style.borderColor = '#CBD5E1';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                            e.currentTarget.style.borderColor = '#E2E8F0';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {/* Top Row: Region & Status Badges */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span
                              style={{
                                background: '#F1F5F9',
                                color: '#475569',
                                border: '1px solid #E2E8F0',
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 700,
                                letterSpacing: '0.04em'
                              }}
                            >
                              {editingClient.region || 'NCR'}
                            </span>
                            <StatusBadge status={inv.status} />
                          </div>

                          {/* Invoice Title & Dates */}
                          <div>
                            <h4
                              onClick={() => setSelectedInvoiceForModal(inv)}
                              style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: '#0F172A',
                                cursor: 'pointer',
                                letterSpacing: '-0.01em'
                              }}
                              title="Click to view invoice details"
                            >
                              {inv.invoiceNumber || inv.id}
                            </h4>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: '0.85rem', color: '#64748B' }}>
                              <i className="ti ti-calendar" style={{ fontSize: 14, color: '#94A3B8' }} />
                              <span>Delivered {new Date(inv.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                            </div>
                            {inv.billingPeriod && (
                              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginTop: 4 }}>
                                Period: {inv.billingPeriod}
                              </div>
                            )}
                          </div>

                          {/* Details Row: Waybill Count & Total Amount */}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 'auto', paddingTop: 8 }}>
                            <div>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                WAYBILL COUNT
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A' }}>
                                  {waybillCount} {waybillCount === 1 ? 'Waybill' : 'Waybills'}
                                </span>
                                <span style={{ fontSize: '10px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', padding: '1px 6px', borderRadius: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                                  ITEMS
                                </span>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                AMOUNT
                              </div>
                              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>
                                ₱{inv.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          </div>

                          {/* Footer Action Row */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 14, marginTop: 4 }}>
                            <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>
                              {inv.dueDate ? `Due: ${formatDate(inv.dueDate)}` : 'Net 30 Days'}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedInvoiceForModal(inv);
                                setModalWaybillSearch('');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#0D9488',
                                fontWeight: 700,
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: 0
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = '#0F766E'}
                              onMouseLeave={e => e.currentTarget.style.color = '#0D9488'}
                            >
                              <span>View Details</span>
                              <i className="ti ti-arrow-right" style={{ fontSize: 13 }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '48px 24px', color: '#94A3B8', border: '1px dashed #E2E8F0', borderRadius: '12px' }}>
                    <i className="ti ti-file-text" style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }} />
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 500 }}>No billing history found for this client.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Records Card */}
            {(user?.role === 'ACCOUNTANT' || user?.role === 'FINANCIAL_MANAGER') && (
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
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(15, 23, 42, 0.5)',
                  backdropFilter: 'blur(5px)',
                  zIndex: 99999,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: '20px'
                }}
                onClick={() => setSelectedInvoiceForModal(null)}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '960px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    padding: '28px 32px',
                    color: '#334155',
                    boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.3)',
                    border: '1px solid #E2E8F0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 20
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  {(() => {
                    let invoiceWaybills = waybills.filter((w: Waybill) => w.invoiceId === selectedInvoiceForModal.id || w.invoiceId === selectedInvoiceForModal.invoiceNumber || selectedInvoiceForModal.waybillIds?.includes(w.id));
                    if (invoiceWaybills.length === 0) {
                      invoiceWaybills = waybills.filter((w: Waybill) => w.clientCode === selectedInvoiceForModal.clientId);
                    }

                    const computedWaybills = invoiceWaybills.map((wb: Waybill) => {
                      let fd: any = null;
                      let freightAmount = 0;
                      try {
                        const br = computeFreightCost(wb, billingRates);
                        fd = {
                          area: br.area || 'NCR',
                          chargeableWeight: br.chargeableWeight,
                          weightBasis: br.volumeWeight > br.actualWeight ? 'volume' : 'actual',
                          actualWeight: br.actualWeight,
                          volumeWeight: br.volumeWeight,
                          freightCost: br.freightCost,
                          vat: br.vat || 0,
                          fuelSurcharge: br.fuelSurcharge || 0,
                        };
                        freightAmount = br.grandTotal;
                      } catch {
                        fd = {
                          area: 'NCR',
                          chargeableWeight: 0,
                          weightBasis: 'actual',
                          actualWeight: 0,
                          volumeWeight: 0,
                          freightCost: 0,
                          vat: 0,
                          fuelSurcharge: 0,
                        };
                      }
                      return { wb, fd, freightAmount };
                    });

                    const filteredWaybills = computedWaybills.filter(item => {
                      if (!modalWaybillSearch.trim()) return true;
                      const q = modalWaybillSearch.toLowerCase();
                      return (
                        item.wb.waybillNumber.toLowerCase().includes(q) ||
                        (item.fd.area && item.fd.area.toLowerCase().includes(q)) ||
                        (item.wb.hasOriginalPOD ? 'orig pod' : 'ctc').includes(q)
                      );
                    });

                    const sumFreight = filteredWaybills.reduce((acc, curr) => acc + (curr.fd?.freightCost || 0), 0);
                    const sumVat = filteredWaybills.reduce((acc, curr) => acc + (curr.fd?.vat || 0), 0);
                    const sumFuel = filteredWaybills.reduce((acc, curr) => acc + (curr.fd?.fuelSurcharge || 0), 0);
                    const sumTotal = filteredWaybills.reduce((acc, curr) => acc + curr.freightAmount, 0);

                    const earliestDate = invoiceWaybills.length > 0
                      ? new Date(Math.min(...invoiceWaybills.map((w: Waybill) => new Date(w.deliveryDate).getTime())))
                      : new Date();

                    return (
                      <>
                        {/* Header Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #F1F5F9', paddingBottom: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: '#F0FDFA', color: '#0D9488', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, border: '1px solid #CCFBF1' }}>
                              <i className="ti ti-file-invoice" />
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.3px' }}>
                                  {selectedInvoiceForModal.invoiceNumber || selectedInvoiceForModal.id}
                                </h3>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedInvoiceForModal.invoiceNumber || selectedInvoiceForModal.id);
                                    setCopiedInvoiceNumber(true);
                                    toast.success('Invoice number copied!');
                                    setTimeout(() => setCopiedInvoiceNumber(false), 2000);
                                  }}
                                  style={{
                                    background: copiedInvoiceNumber ? '#DCFCE7' : '#F1F5F9',
                                    border: '1px solid',
                                    borderColor: copiedInvoiceNumber ? '#86EFAC' : '#E2E8F0',
                                    borderRadius: 6,
                                    color: copiedInvoiceNumber ? '#166534' : '#64748B',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: '2px 7px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4
                                  }}
                                  title="Copy Invoice Number"
                                >
                                  <i className={copiedInvoiceNumber ? 'ti ti-check' : 'ti ti-copy'} style={{ fontSize: 11 }} />
                                  <span>{copiedInvoiceNumber ? 'Copied' : 'Copy'}</span>
                                </button>
                                <StatusBadge status={selectedInvoiceForModal.status} />
                              </div>
                              <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748B', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>{invoiceWaybills.length} waybill{invoiceWaybills.length !== 1 ? 's' : ''}</span>
                                <span>•</span>
                                <span>Delivered {earliestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(selectedInvoiceForModal, invoiceWaybills)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: 8,
                                color: '#0F172A',
                                fontWeight: 700,
                                fontSize: '12px',
                                padding: '8px 14px',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                              onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}
                              title="Export HTML / Print Invoice"
                            >
                              <FileText size={14} color="#0D9488" />
                              <span>Export / Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForModal(null)}
                              style={{
                                background: '#F8FAFC',
                                border: '1px solid #E2E8F0',
                                borderRadius: 8,
                                color: '#64748B',
                                cursor: 'pointer',
                                padding: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              title="Close"
                              onMouseEnter={e => {
                                e.currentTarget.style.background = '#FEE2E2';
                                e.currentTarget.style.color = '#DC2626';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = '#F8FAFC';
                                e.currentTarget.style.color = '#64748B';
                              }}
                            >
                              <i className="ti ti-x" style={{ fontSize: 18 }} />
                            </button>
                          </div>
                        </div>

                        {/* Top KPI Metrics Strip */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                          <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL AMOUNT DUE</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803D', marginTop: 4 }}>
                              ₱{selectedInvoiceForModal.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#166534', marginTop: 2, fontWeight: 500 }}>
                              Includes 12% VAT & Fuel
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL WAYBILLS</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                              {invoiceWaybills.length} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748B' }}>items</span>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                              Validated & Ready
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>BASE FREIGHT</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                              ₱{selectedInvoiceForModal.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                              Net freight subtotal
                            </div>
                          </div>

                          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px' }}>
                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TAX & SURCHARGES</div>
                            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0F172A', marginTop: 4 }}>
                              ₱{(selectedInvoiceForModal.vatAmount + selectedInvoiceForModal.surchargeAmount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: 2 }}>
                              ₱{selectedInvoiceForModal.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} VAT + ₱{selectedInvoiceForModal.surchargeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} Fuel
                            </div>
                          </div>
                        </div>

                        {/* Metadata Details Ribbon */}
                        <div
                          style={{
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            borderRadius: 10,
                            padding: '12px 18px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 12,
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>Client:</span>
                            <strong
                              style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                              title={editingClient?.name || selectedInvoiceForModal.clientId}
                            >
                              {editingClient?.name || selectedInvoiceForModal.clientId}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, borderLeft: '1px solid #E2E8F0', paddingLeft: 12 }}>
                            <span style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>Period:</span>
                            <strong style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {selectedInvoiceForModal.billingPeriod || 'N/A'}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, borderLeft: '1px solid #E2E8F0', paddingLeft: 12 }}>
                            <span style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>Due Date:</span>
                            <strong style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {selectedInvoiceForModal.dueDate ? formatDate(selectedInvoiceForModal.dueDate) : 'Net 30 Days'}
                            </strong>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, borderLeft: '1px solid #E2E8F0', paddingLeft: 12 }}>
                            <span style={{ color: '#64748B', fontSize: '0.8rem', fontWeight: 600 }}>Schedule:</span>
                            <strong style={{ color: '#0F172A', fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              {selectedInvoiceForModal.billingSchedule || editingClient?.billingSchedule || 'Monthly'}
                            </strong>
                          </div>
                        </div>

                        {/* Waybills Toolbar (Title + Search + Table Indicator) */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>Itemized Waybills</span>
                              <span style={{ fontSize: '11px', background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                                {filteredWaybills.length} of {invoiceWaybills.length}
                              </span>
                            </h4>
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              Individual weight, base freight, and surcharge breakdown
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Search Input */}
                            <div style={{ position: 'relative', width: 220 }}>
                              <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 13 }} />
                              <input
                                type="text"
                                value={modalWaybillSearch}
                                onChange={e => setModalWaybillSearch(e.target.value)}
                                placeholder="Search waybill # or area..."
                                style={{
                                  width: '100%',
                                  padding: '6px 28px 6px 30px',
                                  borderRadius: 8,
                                  border: '1px solid #CBD5E1',
                                  fontSize: '12px',
                                  outline: 'none',
                                  background: '#fff',
                                  color: '#0F172A'
                                }}
                              />
                              {modalWaybillSearch && (
                                <button
                                  type="button"
                                  onClick={() => setModalWaybillSearch('')}
                                  style={{
                                    position: 'absolute',
                                    right: 8,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    color: '#94A3B8',
                                    cursor: 'pointer',
                                    padding: 0
                                  }}
                                  title="Clear search"
                                >
                                  <i className="ti ti-x" style={{ fontSize: 12 }} />
                                </button>
                              )}
                            </div>

                            {/* Table Badge */}
                            <div style={{ display: 'flex', background: '#F1F5F9', padding: '3px', borderRadius: 8 }}>
                              <div
                                style={{
                                  padding: '5px 12px',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: '#0F172A',
                                  background: '#fff',
                                  borderRadius: 6,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5
                                }}
                              >
                                <i className="ti ti-table" style={{ fontSize: 13, color: '#0D9488' }} />
                                <span>Table</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Waybill Items: Table View */}
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflowX: 'auto', background: '#fff' }}>
                          <table style={{ width: '100%', minWidth: '760px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
                            <thead>
                              <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                <th style={{ padding: '10px 14px', width: 36, textAlign: 'center' }}>#</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Waybill Number</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700 }}>Area</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700 }}>POD Status</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Chargeable Wt.</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Base Freight</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>VAT (12%)</th>
                                <th style={{ padding: '10px 14px', fontWeight: 700, textAlign: 'right' }}>Fuel (15%)</th>
                                <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right' }}>Line Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredWaybills.length > 0 ? (
                                filteredWaybills.map((item, idx) => (
                                  <tr
                                    key={item.wb.id}
                                    style={{
                                      borderBottom: '1px solid #F1F5F9',
                                      transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94A3B8', fontSize: '11px', fontWeight: 600 }}>
                                      {idx + 1}
                                    </td>
                                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0F172A' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span>{item.wb.waybillNumber}</span>
                                        <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: 4, background: '#DCFCE7', color: '#166534', fontWeight: 700 }}>
                                          Validated
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 4, background: '#F1F5F9', color: '#475569', fontWeight: 700 }}>
                                        {item.fd?.area || 'NCR'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: '#1E40AF', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        <i className="ti ti-paperclip" style={{ fontSize: 10 }} />
                                        {item.wb.hasOriginalPOD ? 'Orig POD' : (item.wb.hasApprovedCTC ? 'Approved CTC' : 'Missing')}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.fd?.chargeableWeight?.toFixed(2) || '0.00'} kg</span>
                                      <span style={{ marginLeft: 4, fontSize: '9px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#64748B', padding: '1px 4px', borderRadius: 3, fontWeight: 700, textTransform: 'uppercase' }}>
                                        {item.fd?.weightBasis === 'volume' ? 'VOL' : 'ACT'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155', fontWeight: 600 }}>
                                      ₱{(item.fd?.freightCost ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>
                                      ₱{(item.fd?.vat ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>
                                      ₱{(item.fd?.fuelSurcharge ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#059669', fontSize: '0.92rem' }}>
                                      ₱{(item.freightAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={9} style={{ textAlign: 'center', padding: '36px 20px', color: '#94A3B8' }}>
                                    <p style={{ margin: 0, fontWeight: 500 }}>No waybills match "{modalWaybillSearch}"</p>
                                    <button
                                      type="button"
                                      onClick={() => setModalWaybillSearch('')}
                                      style={{ marginTop: 8, background: 'none', border: 'none', color: '#0D9488', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}
                                    >
                                      Clear search filter
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                            {filteredWaybills.length > 0 && (
                              <tfoot>
                                <tr style={{ background: '#F8FAFC', borderTop: '2px solid #CBD5E1', fontWeight: 700, fontSize: '0.82rem' }}>
                                  <td colSpan={5} style={{ padding: '10px 14px', color: '#0F172A' }}>
                                    Subtotal ({filteredWaybills.length} waybill{filteredWaybills.length !== 1 ? 's' : ''})
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0F172A' }}>
                                    ₱{sumFreight.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0F172A' }}>
                                    ₱{sumVat.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0F172A' }}>
                                    ₱{sumFuel.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ padding: '10px 16px', textAlign: 'right', color: '#059669', fontSize: '0.95rem', fontWeight: 800 }}>
                                    ₱{sumTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              </tfoot>
                            )}
                          </table>
                        </div>

                        {/* Grand Totals Reconciliation Card */}
                        <div style={{ border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', background: '#F8FAFC' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                                Financial Reconciliation
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                                  <span style={{ color: '#64748B' }}>Total Base Freight:</span>
                                  <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{selectedInvoiceForModal.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                                  <span style={{ color: '#64748B' }}>Value-Added Tax (12%):</span>
                                  <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{selectedInvoiceForModal.vatAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
                                  <span style={{ color: '#64748B' }}>Fuel Surcharge (15%):</span>
                                  <span style={{ color: '#0F172A', fontWeight: 700 }}>₱{selectedInvoiceForModal.surchargeAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                              <div style={{ marginTop: 8, fontSize: '0.74rem', color: '#94A3B8' }}>
                                Computed based on active client billing contracts and verified delivery receipts.
                              </div>
                            </div>

                            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                GRAND TOTAL DUE
                              </span>
                              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#15803D', marginTop: 4 }}>
                                ₱{selectedInvoiceForModal.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                              </div>
                              <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 6 }}>
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', background: '#DCFCE7', padding: '2px 8px', borderRadius: 9999 }}>
                                  {selectedInvoiceForModal.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                          <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>
                            Invoice Reference: <strong style={{ color: '#64748B' }}>{selectedInvoiceForModal.invoiceNumber || selectedInvoiceForModal.id}</strong>
                          </span>
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadInvoice(selectedInvoiceForModal, invoiceWaybills)}
                              style={{
                                padding: '8px 18px',
                                background: '#F0FDFA',
                                border: '1px solid #CCFBF1',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: '12px',
                                color: '#0D9488',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#CCFBF1'}
                              onMouseLeave={e => e.currentTarget.style.background = '#F0FDFA'}
                            >
                              <FileText size={14} color="#0D9488" />
                              <span>Download / Print</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedInvoiceForModal(null)}
                              style={{
                                padding: '8px 22px',
                                background: '#0F172A',
                                border: '1px solid #0F172A',
                                borderRadius: 8,
                                fontWeight: 700,
                                fontSize: '12px',
                                color: '#ffffff',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = '#1E293B'}
                              onMouseLeave={e => e.currentTarget.style.background = '#0F172A'}
                            >
                              Close
                            </button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
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
                <button aria-label="Close edit client" onClick={handleCancelEdit} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94A3B8' }}>×</button>
              </div>

              <div style={{ padding: '24px' }}>
                {isDirectLoading && !directClient ? (
                  <div role="status" aria-live="polite" style={{ padding: 24, color: '#64748B' }}>Loading client details…</div>
                ) : directError && !editingClient ? (
                  <div role="alert" style={{ color: '#B91C1C' }}>
                    <p>{getRecordErrorMessage(directError)}</p>
                    <Button title="Retry" variant="secondary" onClick={() => void refetchDirectClient()} />
                  </div>
                ) : (
                <form onSubmit={handleEditSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ gridColumn: '1 / -1', color: '#64748B', fontSize: '0.82rem' }}>
                    Client ID: <strong>{editingClient.id}</strong>
                    {editingClient.createdAt && <> · Created: <strong>{formatDate(editingClient.createdAt)}</strong></>}
                  </div>
                  {editError && (
                    <div role="alert" style={{ gridColumn: '1 / -1', color: '#B91C1C', background: '#FEF2F2', padding: 12, borderRadius: 8 }}>
                      {editError}
                      {editConflict && <span> Review the reloaded values before saving again.</span>}
                      {(getApiStatus(directError) === 0 || getApiStatus(directError) >= 500) && (
                        <Button title="Retry loading" variant="secondary" onClick={() => void refetchDirectClient()} />
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Client Name <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required maxLength={200} type="text" name="name" value={formData.name} onChange={e => { handleFormChange(e); setEditFieldErrors(prev => ({ ...prev, name: '' })); }} aria-invalid={Boolean(editFieldErrors.name)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                    {editFieldErrors.name && <span role="alert" style={{ color: '#B91C1C' }}>{editFieldErrors.name}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Contact Person <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required maxLength={100} type="text" name="contactPerson" value={formData.contactPerson} onChange={e => { handleFormChange(e); setEditFieldErrors(prev => ({ ...prev, contactPerson: '' })); }} aria-invalid={Boolean(editFieldErrors.contactPerson)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                    {editFieldErrors.contactPerson && <span role="alert" style={{ color: '#B91C1C' }}>{editFieldErrors.contactPerson}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Contact Number <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required maxLength={50} type="tel" name="contactNumber" value={formData.contactNumber} onChange={e => { handleFormChange(e); setEditFieldErrors(prev => ({ ...prev, contactNumber: '' })); }} aria-invalid={Boolean(editFieldErrors.contactNumber)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                    {editFieldErrors.contactNumber && <span role="alert" style={{ color: '#B91C1C' }}>{editFieldErrors.contactNumber}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Rate Type <span style={{ color: '#EF4444' }}>*</span></label>
                    <select name="rateType" value={formData.rateType} disabled style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      {!formData.rateType && <option value="">Unavailable from client API</option>}
                      {formData.rateType && !rateTypeOptions.includes(formData.rateType) && <option value={formData.rateType}>{formData.rateType} (not in current options)</option>}
                      {rateTypeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <span style={{ color: '#92400E', fontSize: '0.75rem' }}>Rate Type is not exposed by the client update API.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Address <span style={{ color: '#EF4444' }}>*</span></label>
                    <input required maxLength={500} type="text" name="address" value={formData.address} onChange={e => { handleFormChange(e); setEditFieldErrors(prev => ({ ...prev, address: '' })); }} aria-invalid={Boolean(editFieldErrors.address)} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                    {editFieldErrors.address && <span role="alert" style={{ color: '#B91C1C' }}>{editFieldErrors.address}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Billing Cycle</label>
                    <select name="billingSchedule" value={formData.billingSchedule} disabled style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      {!formData.billingSchedule && <option value="">Unavailable from client API</option>}
                      {formData.billingSchedule && !billingCycleOptions.includes(formData.billingSchedule as Client['billingSchedule']) && <option value={formData.billingSchedule}>{formData.billingSchedule} (not in current options)</option>}
                      {billingCycleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <span style={{ color: '#92400E', fontSize: '0.75rem' }}>Billing Cycle is currently read-only: the update API does not accept it.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status</label>
                    <select name="status" value={formData.status} disabled style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      {!formData.status && <option value="">Unavailable from client API</option>}
                      {formData.status && !statusOptions.includes(formData.status as Client['status']) && <option value={formData.status}>{formData.status} (not in current options)</option>}
                      {statusOptions.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <span style={{ color: '#92400E', fontSize: '0.75rem' }}>Status changes are not supported by the client update contract.</span>
                  </div>
                  <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                    <Button variant="secondary" title="Cancel" type="button" onClick={handleCancelEdit} />
                    <Button variant="primary" title={updateClientMutation.isPending ? 'Saving...' : 'Save Changes'} disabled={updateClientMutation.isPending || !editIsDirty} loading={updateClientMutation.isPending} type="submit" />
                  </div>
                </form>
                )}
              </div>
            </Card>
          </div>,
          document.body
        )}
        <ConfirmModal
          isOpen={showDeleteModal}
          title={editingClient.status === 'Active' ? 'Deactivate Client Account' : 'Manage Inactive Client Account'}
          message={
            editingClient.status === 'Active'
              ? `Are you sure you want to deactivate ${editingClient.name} (${editingClient.id})? Inactive accounts will be hidden from active invoice creation, payment dropdowns, and daily reports.`
              : `Choose an action for ${editingClient.name} (${editingClient.id}). You can reactivate this account, or delete it permanently if it has no associated invoices.`
          }
          variant={editingClient.status === 'Active' ? 'danger' : 'primary'}
          confirmLabel={editingClient.status === 'Active' ? 'Deactivate Client' : 'Reactivate Client'}
          cancelLabel="Cancel"
          onConfirm={handleConfirmDeleteOrDeactivate}
          onCancel={() => setShowDeleteModal(false)}
        />
        <ConfirmModal
          isOpen={editConfirmation === 'discard'}
          title="Discard changes?"
          message="Your unsaved client changes will be discarded."
          cancelLabel="Keep editing"
          confirmLabel="Discard changes"
          onCancel={() => setEditConfirmation(null)}
          onConfirm={() => {
            if (originalEditForm) setFormData(originalEditForm);
            setEditConfirmation(null);
            setEditError(null);
            setEditFieldErrors({});
            setIsEditMode(false);
          }}
        />
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
                {serverError && (
                  <div style={{ gridColumn: '1 / -1', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{serverError}</span>
                    <button type="button" onClick={() => setServerError(null)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                  </div>
                )}
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
                  <select name="rateType" value={formData.rateType} disabled style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <option value="">Unavailable from client API</option>
                    {formData.rateType && !rateTypeOptions.includes(formData.rateType) && <option value={formData.rateType}>{formData.rateType} (not in current options)</option>}
                    {rateTypeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <span style={{ color: '#92400E', fontSize: '0.75rem' }}>Rate Type cannot be assigned by the client creation API.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Address <span style={{ color: '#EF4444' }}>*</span></label>
                  <input required type="text" name="address" value={formData.address} onChange={handleFormChange} style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Billing Cycle</label>
                  <select name="billingSchedule" value={formData.billingSchedule} disabled style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <option value="">Unavailable from client API</option>
                    {billingCycleOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <span style={{ color: '#92400E', fontSize: '0.75rem' }}>Billing Cycle cannot be assigned by the client creation API.</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Status</label>
                  <select name="status" value={formData.status} disabled style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                    <option value="">Unavailable from client API</option>
                    {statusOptions.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  <span style={{ color: '#92400E', fontSize: '0.75rem' }}>Status is assigned by the server when a client is created.</span>
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <Button variant="secondary" title="Cancel" type="button" onClick={() => setIsAddingNew(false)} />
                  <Button variant="primary" title={isSubmittingClient ? 'Creating...' : 'Create Client'} disabled={isSubmittingClient} loading={isSubmittingClient} type="submit" />
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
              {statusOptions.map(option => <option key={option} value={option}>{option}</option>)}
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
