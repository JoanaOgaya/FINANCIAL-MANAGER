import React, { Component, ErrorInfo, useState } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { TableContainer } from '../components/TableContainer';
import { KpiCard } from '../components/shared/KpiCard';
import { DataTable } from '../components/DataTable';
import { CustomDatePicker } from '../components/CustomDatePicker';
import { StatusBadge } from '../components/shared/StatusBadge';
import { ClientInfoCard } from '../components/ClientInfoCard';
import { Card } from '../components/Card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, ComposedChart } from 'recharts';
import { useToast } from '../components/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import { invoicesService } from '../services/invoicesService';
import { clientsService } from '../services/clientsService';
import { arService } from '../services/arService';
import { paymentsService } from '../services/paymentsService';
import { auditLogsService } from '../services/auditLogsService';
import { Role } from '../types/auth';
import type { Invoice, Client, AccountsReceivableRecord, Payment, AuditLog } from '../types/entities';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 8 }}>
          <h2>Something went wrong in Reports.tsx.</h2>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const BRACKET_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  '0-30 days': { bg: '#F0FDF4', color: '#10B981', border: '#BBF7D0' },
  '31-60 days': { bg: '#FFFBEB', color: '#F59E0B', border: '#FDE68A' },
  '61-90 days': { bg: '#FFF7ED', color: '#F97316', border: '#FED7AA' },
  '90+ days': { bg: '#FEF2F2', color: '#EF4444', border: '#FECACA' },
};

type ReportTab = 'aging' | 'invoices' | 'collections';

const ReportsContent: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: invData } = useQuery('reports:invoices', () => invoicesService.list({ pageSize: 100 }));
  const { data: clientData } = useQuery('reports:clients', () => clientsService.list({ pageSize: 100 }));
  const { data: arData } = useQuery('reports:ar', () => arService.records({ pageSize: 100 }));
  const { data: pmtData } = useQuery('reports:payments', () => paymentsService.list({ pageSize: 100 }));

  const invoices: Invoice[] = invData?.items || [];
  const clients: Client[] = clientData?.items || [];
  const arRecords: AccountsReceivableRecord[] = arData?.items || [];
  const payments: Payment[] = pmtData?.items || [];

  const addAuditLog = (data: Partial<AuditLog>) => {
    auditLogsService.create(data).catch(() => {});
  };

  const { id } = useParams();
  const selectedClientId = id;
  const [reportType, setReportType] = useState(searchParams.get('tab') || 'aging');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const activeTab = reportType;
  const { toast } = useToast();
  const [scheduleFilter, setScheduleFilter] = useState<'Weekly' | 'Semi-monthly' | 'Monthly' | ''>('');
  const [hoveredReportType, setHoveredReportType] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

  const defaultLedger = (user?.role === 'ACCOUNTANT') ? 'Aging of Accounts' : 'Duplicate Alert Summary';
  const [compileLedgerType, setCompileLedgerType] = useState(defaultLedger);
  const [compileSearch, setCompileSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [compileDateRange, setCompileDateRange] = useState('All Time');
  const [compileStatus, setCompileStatus] = useState('All Statuses');

  const applyScheduleDates = (schedule: 'Weekly' | 'Semi-monthly' | 'Monthly' | '') => {
    setScheduleFilter(schedule);
    setIsGenerated(false);
    if (!schedule) return;

    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    if (schedule === 'Weekly') {
      const day = start.getDay();
      start.setDate(start.getDate() - day + (day === 0 ? -6 : 1)); // start on Monday
      end = new Date(start);
      end.setDate(end.getDate() + 6); // end on Sunday
    } else if (schedule === 'Semi-monthly') {
      if (start.getDate() <= 15) {
        start.setDate(1);
        end.setDate(15);
      } else {
        start.setDate(16);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      }
    } else if (schedule === 'Monthly') {
      start.setDate(1);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    }

    setDateFrom(start.toISOString().split('T')[0]);
    setDateTo(end.toISOString().split('T')[0]);
  };

  const handleGenerateReport = () => {
    const now = new Date();
    let start = new Date(now);
    
    if (compileDateRange === 'Last 7 Days') {
      start.setDate(now.getDate() - 7);
    } else if (compileDateRange === 'Last 30 Days') {
      start.setDate(now.getDate() - 30);
    } else if (compileDateRange === 'Last 90 Days') {
      start.setDate(now.getDate() - 90);
    } else if (compileDateRange === 'This Month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (compileDateRange === 'This Year') {
      start = new Date(now.getFullYear(), 0, 1);
    } else if (compileDateRange === 'All Time') {
      start = new Date(2000, 0, 1);
    }

    const newDateFrom = start.toISOString().split('T')[0];
    const newDateTo = now.toISOString().split('T')[0];

    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    setActiveSearch(compileSearch);
    setIsGenerated(true);

    addAuditLog({
      id: `AL-${Date.now()}`,
      userId: user?.employeeId || 'U-000',
      userFullName: user?.fullName || 'System',
      userRole: user?.role || 'Finance Manager',
      action: 'GENERATE_REPORT',
      module: 'Reports',
      recordId: 'N/A',
      recordType: 'Report',
      ipAddress: '127.0.0.1',
      details: `Generated ${reportType} report for ${compileDateRange}`,
      timestamp: new Date().toISOString()
    });
    
    toast.success('Report generated successfully.');
  };

  const handleExportCSV = () => {
    let dataToExport = [];
    let headers = [];
    let filename = '';

    if (activeTab === 'aging') {
      dataToExport = agingRecords.map(r => [
        r.clientName,
        r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-PH') : 'N/A',
        r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-PH') : 'N/A',
        r.amount,
        r.agingDays
      ]);
      headers = ['CLIENT', 'INVOICE DATE', 'DUE DATE', 'AMOUNT', 'DAYS OUTSTANDING'];
      filename = 'aging_report.csv';
    } else if (activeTab === 'invoices') {
      dataToExport = allInvoices.map(r => [
        r.invoiceNumber,
        r.clientName,
        new Date(r.createdAt).toLocaleDateString('en-PH'),
        new Date(r.dueDate).toLocaleDateString('en-PH'),
        r.totalAmount,
        r.status
      ]);
      headers = ['INVOICE NO.', 'CLIENT', 'ISSUE DATE', 'DUE DATE', 'TOTAL AMOUNT', 'STATUS'];
      filename = 'invoice_report.csv';
    } else if (activeTab === 'collections') {
      dataToExport = collections.map(r => [
        r.id,
        r.invoiceNumber,
        r.clientName,
        r.amount,
        r.paymentMethod,
        new Date(r.recordedAt).toLocaleDateString('en-PH')
      ]);
      headers = ['PAYMENT ID', 'INVOICE NO.', 'CLIENT', 'AMOUNT PAID', 'PAYMENT METHOD', 'DATE COLLECTED'];
      filename = 'collection_report.csv';
    } else {
      toast.error('Export not supported for this report type yet.');
      return;
    }

    const csvContent = [
      headers.join(','),
      ...dataToExport.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success('Report exported to CSV successfully.');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    let bodyData: string[][] = [];
    let headers: string[][] = [];
    let title = '';

    if (activeTab === 'aging') {
      title = 'Aging of Accounts Report';
      headers = [['Client', 'Invoice Date', 'Due Date', 'Amount', 'Days Outstanding']];
      bodyData = agingRecords.map(r => [
        r.clientName,
        r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-PH') : 'N/A',
        r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-PH') : 'N/A',
        `PHP ${r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        r.agingDays.toString()
      ]);
    } else if (activeTab === 'invoices') {
      title = 'Invoice Summary Report';
      headers = [['Invoice No.', 'Client', 'Issue Date', 'Due Date', 'Total Amount', 'Status']];
      bodyData = allInvoices.map(r => [
        r.invoiceNumber,
        r.clientName,
        new Date(r.createdAt).toLocaleDateString('en-PH'),
        new Date(r.dueDate).toLocaleDateString('en-PH'),
        `PHP ${r.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        r.status
      ]);
    } else if (activeTab === 'collections') {
      title = 'Collection Summary Report';
      headers = [['Payment ID', 'Invoice No.', 'Client', 'Amount Paid', 'Payment Method', 'Date Collected']];
      bodyData = collections.map(r => [
        r.id,
        r.invoiceNumber,
        r.clientName,
        `PHP ${r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`,
        r.paymentMethod,
        new Date(r.recordedAt).toLocaleDateString('en-PH')
      ]);
    } else {
      toast.error('Export not supported for this report type yet.');
      return;
    }

    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 14, 22);

    autoTable(doc, {
      startY: 30,
      head: headers,
      body: bodyData,
      theme: 'striped',
      headStyles: { fillColor: [13, 148, 136] }, // #0D9488
    });

    doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
    toast.success('Report exported to PDF successfully.');
  };

  const getFilteredAR = () => {
    if (!isGenerated || !dateFrom || !dateTo) return arRecords;
    return arRecords.filter((ar: AccountsReceivableRecord) => {
      const d = ar.invoiceDate.split('T')[0];
      const matchDate = d >= dateFrom && d <= dateTo;
      if (!matchDate) return false;
      if (activeSearch) {
        const term = activeSearch.toLowerCase();
        const client = clients.find((c: Client) => c.id === ar.clientId);
        const cName = client?.name?.toLowerCase() || '';
        return cName.includes(term) || ar.invoiceId.toLowerCase().includes(term);
      }
      return true;
    });
  };

  const getFilteredInvoices = () => {
    if (!isGenerated || !dateFrom || !dateTo) return invoices;
    return invoices.filter((inv: Invoice) => {
      const d = inv.createdAt.split('T')[0];
      const matchDate = d >= dateFrom && d <= dateTo;
      if (!matchDate) return false;
      if (activeSearch) {
        const term = activeSearch.toLowerCase();
        const client = clients.find((c: Client) => c.id === inv.clientId);
        const cName = client?.name?.toLowerCase() || '';
        return cName.includes(term) || inv.invoiceNumber.toLowerCase().includes(term);
      }
      return true;
    });
  };

  const getFilteredPayments = () => {
    if (!isGenerated || !dateFrom || !dateTo) return payments;
    return payments.filter((p: Payment) => {
      const d = p.recordedAt.split('T')[0];
      const matchDate = d >= dateFrom && d <= dateTo;
      if (!matchDate) return false;
      if (activeSearch) {
        const term = activeSearch.toLowerCase();
        const client = clients.find((c: Client) => c.id === p.clientId);
        const cName = client?.name?.toLowerCase() || '';
        return cName.includes(term) || p.invoiceNumber?.toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
      }
      return true;
    });
  };

  const filteredClientsForDropdown = Array.from(new Map(clients.map((c: Client) => [c.name, c])).values())
    .filter((c: Client) => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  let agingRecords: any[] = [];
  if (selectedClientId) {
    agingRecords = getFilteredAR().filter((ar: AccountsReceivableRecord) => ar.clientId === selectedClientId).map((ar: AccountsReceivableRecord) => {
      const client = clients.find((c: Client) => c.id === ar.clientId);
      const invoice = getFilteredInvoices().find((i: Invoice) => i.id === ar.invoiceId);
      return {
        ...ar,
        clientName: client?.name ?? 'Unknown',
        invoiceNumber: invoice?.invoiceNumber ?? ar.invoiceId,
        amount: ar.outstandingBalance,
        status: ar.status
      };
    });
  } else {
    const grouped = new Map<string, AccountsReceivableRecord[]>();
    getFilteredAR().forEach((ar: AccountsReceivableRecord) => {
      if (!grouped.has(ar.clientId)) grouped.set(ar.clientId, []);
      grouped.get(ar.clientId)!.push(ar);
    });
    agingRecords = Array.from(grouped.entries()).map(([clientId, recs]) => {
      const client = clients.find((c: Client) => c.id === clientId);
      const statuses = Array.from(new Set(recs.map((r: AccountsReceivableRecord) => r.status)));
      const status = statuses.length === 1 ? statuses[0] : 'Mixed';
      const validTimes = recs.map((r: AccountsReceivableRecord) => new Date(r.invoiceDate).getTime()).filter(t => !isNaN(t));
      const maxDate = new Date(validTimes.length > 0 ? Math.max(...validTimes) : Date.now());

      return {
        id: clientId,
        clientId,
        invoiceNumber: recs.length === 1 ? recs[0].invoiceNumber : '[Multiple]',
        clientName: client?.name ?? 'Unknown',
        invoiceDate: maxDate.toISOString(),
        dueDate: maxDate.toISOString(),
        amount: recs.reduce((sum: number, r: AccountsReceivableRecord) => sum + r.outstandingBalance, 0),
        agingDays: Math.max(...recs.map((r: AccountsReceivableRecord) => r.agingDays)),
        agingBracket: 'Mixed',
        status: status,
        isGrouped: true
      };
    });
  }

  // Filter aging records to only show those with 31+ days outstanding
  agingRecords = agingRecords.filter((r: any) => r.agingDays >= 31);

  // For bracket cards always count from ALL AR records (not grouped)
  const getAgingBracketData = (bracket: string) => {
    const base = selectedClientId
      ? getFilteredAR().filter((r: AccountsReceivableRecord) => r.clientId === selectedClientId)
      : getFilteredAR();
    const recs = base.filter((r: AccountsReceivableRecord) => r.agingBracket === bracket);
    return {
      count: recs.length,
      total: recs.reduce((sum: number, r: AccountsReceivableRecord) => sum + r.outstandingBalance, 0)
    };
  };

  const agingChartData = ['0-30 days', '31-60 days', '61-90 days', '90+ days'].map(bracket => {
    const data = getAgingBracketData(bracket);
    return {
      name: bracket,
      value: data.total,
      color: BRACKET_COLORS[bracket].color
    };
  });

  const agingColumns = [
    {
      key: 'clientName', label: 'CLIENT', sortable: true, render: (row: any) => (
        <span style={{ color: '#0F172A', fontWeight: 700 }}>
          {row.clientName}
        </span>
      )
    },
    { key: 'invoiceDate', label: 'INVOICE DATE', render: (row: any) => row.invoiceDate ? new Date(row.invoiceDate).toLocaleDateString('en-PH') : 'N/A' },
    { key: 'dueDate', label: 'DUE DATE', render: (row: any) => row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-PH') : 'N/A' },
    { key: 'amount', label: 'AMOUNT', render: (row: any) => `₱${row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` },
    { key: 'agingDays', label: 'DAYS OUTSTANDING', sortable: true, render: (row: any) => <span style={{ color: row.agingDays >= 31 ? '#EF4444' : 'inherit', fontWeight: row.agingDays >= 31 ? 700 : 'inherit' }}>{row.agingDays}</span> }
  ];

  // ── 2. Invoice Summary Tab Data ────────────────────────────────
  let allInvoices: any[] = [];
  if (selectedClientId) {
    allInvoices = getFilteredInvoices().filter((i: Invoice) => i.clientId === selectedClientId).map((i: Invoice) => {
      const client = clients.find((c: Client) => c.id === i.clientId);
      return {
        ...i,
        clientName: client?.name ?? 'Unknown'
      };
    });
  } else {
    const grouped = new Map<string, Invoice[]>();
    getFilteredInvoices().forEach((inv: Invoice) => {
      if (!grouped.has(inv.clientId)) grouped.set(inv.clientId, []);
      grouped.get(inv.clientId)!.push(inv);
    });
    allInvoices = Array.from(grouped.entries()).map(([clientId, recs]) => {
      const client = clients.find((c: Client) => c.id === clientId);
      const statuses = Array.from(new Set(recs.map((r: Invoice) => r.status)));
      const status = statuses.length === 1 ? statuses[0] : 'Mixed';
      const validTimes = recs.map((r: Invoice) => new Date(r.createdAt).getTime()).filter(t => !isNaN(t));
      const maxDate = new Date(validTimes.length > 0 ? Math.max(...validTimes) : Date.now());

      return {
        id: clientId,
        clientId,
        invoiceNumber: recs.length === 1 ? recs[0].invoiceNumber : '[Multiple]',
        clientName: client?.name ?? 'Unknown',
        createdAt: maxDate.toISOString(),
        dueDate: maxDate.toISOString(),
        totalAmount: recs.reduce((sum: number, r: Invoice) => sum + r.totalAmount, 0),
        status: status,
        isGrouped: true
      };
    });
  }

  const totalInvoiced = allInvoices.reduce((sum: number, i: any) => sum + i.totalAmount, 0);
  const totalPaid = allInvoices.filter((i: any) => i.status === 'Paid').reduce((sum: number, i: any) => sum + i.totalAmount, 0);
  const totalOutstanding = allInvoices.filter((i: any) => ['Sent', 'Overdue'].includes(i.status)).reduce((sum: number, i: any) => sum + i.totalAmount, 0);

  const invoiceMonthlyData = allInvoices.reduce((acc: Record<string, any>, inv: any) => {
    const date = new Date(inv.createdAt);
    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = { name: month, Invoiced: 0, Paid: 0, Outstanding: 0 };
    acc[month].Invoiced += inv.totalAmount;
    if (inv.status === 'Paid') acc[month].Paid += inv.totalAmount;
    else if (['Sent', 'Overdue'].includes(inv.status)) acc[month].Outstanding += inv.totalAmount;
    return acc;
  }, {} as Record<string, any>);
  const invoiceChartData = Object.values(invoiceMonthlyData).sort((a: any, b: any) => new Date(`1 ${a.name}`).getTime() - new Date(`1 ${b.name}`).getTime());

  const invoiceColumns = [
    { key: 'invoiceNumber', label: 'INVOICE NO.', sortable: true },
    {
      key: 'clientName', label: 'CLIENT', sortable: true, render: (row: any) => (
        <span style={{ color: '#0F172A', fontWeight: 700 }}>
          {row.clientName}
        </span>
      )
    },
    { key: 'createdAt', label: 'ISSUE DATE', render: (row: any) => new Date(row.createdAt).toLocaleDateString('en-PH') },
    { key: 'dueDate', label: 'DUE DATE', render: (row: any) => new Date(row.dueDate).toLocaleDateString('en-PH') },
    { key: 'totalAmount', label: 'TOTAL AMOUNT', render: (row: any) => `₱${row.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` }
  ];

  // ── 3. Collection Report Tab Data ──────────────────────────────
  let collections: any[] = [];
  const baseCollections = getFilteredPayments().filter((p: Payment) => p.status === 'Validated' || p.status === 'Approved');
  if (selectedClientId) {
    collections = baseCollections.filter((p: Payment) => p.clientId === selectedClientId).map((p: Payment) => {
      const client = clients.find((c: Client) => c.id === p.clientId);
      const invoice = getFilteredInvoices().find((i: Invoice) => i.id === p.invoiceId);
      return {
        ...p,
        clientName: client?.name ?? 'Unknown',
        invoiceNumber: invoice?.invoiceNumber ?? p.invoiceId
      };
    });
  } else {
    const grouped = new Map<string, Payment[]>();
    baseCollections.forEach((col: Payment) => {
      if (!grouped.has(col.clientId)) grouped.set(col.clientId, []);
      grouped.get(col.clientId)!.push(col);
    });
    collections = Array.from(grouped.entries()).map(([clientId, recs]) => {
      const client = clients.find((c: Client) => c.id === clientId);
      const validTimes = recs.map((r: Payment) => new Date(r.recordedAt).getTime()).filter(t => !isNaN(t));
      const maxDate = new Date(validTimes.length > 0 ? Math.max(...validTimes) : Date.now());

      return {
        id: clientId,
        clientId,
        invoiceNumber: recs.length === 1 ? recs[0].invoiceNumber : '[Multiple]',
        clientName: client?.name ?? 'Unknown',
        paymentMethod: 'Mixed',
        amount: recs.reduce((sum: number, r: Payment) => sum + r.amount, 0),
        recordedAt: maxDate.toISOString(),
        isGrouped: true
      };
    });
  }

  const totalCollected = getFilteredPayments().filter((p: Payment) => p.status === 'Validated' || p.status === 'Approved').reduce((sum: number, c: Payment) => sum + c.amount, 0);
  // Breakdown by method from individual (non-grouped) payments
  const methodBreakdown = getFilteredPayments()
    .filter((p: Payment) => p.status === 'Validated' || p.status === 'Approved')
    .reduce((acc: Record<string, number>, p: Payment) => {
      acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + p.amount;
      return acc;
    }, {} as Record<string, number>);

  const collectionMonthlyData = baseCollections.reduce((acc: Record<string, any>, col: Payment) => {
    if (selectedClientId && col.clientId !== selectedClientId) return acc;
    const date = new Date(col.recordedAt);
    const month = date.toLocaleString('default', { month: 'short', year: 'numeric' });
    if (!acc[month]) acc[month] = { name: month, Collected: 0 };
    acc[month].Collected += col.amount;
    return acc;
  }, {} as Record<string, any>);
  const collectionChartData = Object.values(collectionMonthlyData).sort((a: any, b: any) => new Date(`1 ${a.name}`).getTime() - new Date(`1 ${b.name}`).getTime());

  const breakdownString = Object.entries(methodBreakdown)
    .map(([method, amount]: [string, any]) => `${method}: ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`)
    .join(' | ');

  const collectionColumns = [
    { key: 'id', label: 'PAYMENT ID', sortable: true },
    { key: 'invoiceNumber', label: 'INVOICE NO.' },
    {
      key: 'clientName', label: 'CLIENT', sortable: true, render: (row: any) => (
        <span style={{ color: '#0F172A', fontWeight: 700 }}>
          {row.clientName}
        </span>
      )
    },
    { key: 'amount', label: 'AMOUNT PAID', render: (row: any) => <span style={{ fontWeight: 700, color: '#10B981' }}>₱{row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span> },
    { key: 'paymentMethod', label: 'PAYMENT' },
    { key: 'recordedAt', label: 'DATE COLLECTED', render: (row: any) => new Date(row.recordedAt).toLocaleDateString('en-PH') }
  ];

  const BillingScheduleFilter = () => (
    <div style={{
      position: 'absolute',
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '16px',
      background: '#fff',
      border: '1px solid #10B981',
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
      zIndex: 50,
      width: 'max-content',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    }}>
      <div style={{ position: 'absolute', left: '-6px', top: '50%', marginTop: '-5px', width: '10px', height: '10px', background: '#fff', borderLeft: '1px solid #10B981', borderBottom: '1px solid #10B981', transform: 'rotate(45deg)' }}></div>

      <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Filter by Schedule</label>
      {['Weekly', 'Semi-monthly', 'Monthly'].map((opt) => (
        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isGenerated ? 'not-allowed' : 'pointer', opacity: isGenerated ? 0.6 : 1 }}>
          <input
            type="radio"
            name="billingSchedule"
            value={opt}
            checked={scheduleFilter === opt}
            onChange={() => !isGenerated && applyScheduleDates(opt as any)}
            disabled={isGenerated}
            style={{ margin: 0, cursor: isGenerated ? 'not-allowed' : 'pointer', accentColor: '#10B981' }}
          />
          <span style={{ fontSize: '0.85rem', color: scheduleFilter === opt ? '#0F172A' : '#475569', fontWeight: scheduleFilter === opt ? 700 : 500 }}>{opt}</span>
        </label>
      ))}
    </div>
  );

  const ReportTypeOption = ({ value, label, subLabel, current, onChange, disabled }: any) => {
    const isActive = current === value;
    return (
      <div
        onClick={() => !disabled && onChange(value)}
        style={{
          padding: '12px 14px',
          borderRadius: 12,
          border: isActive ? '1.5px solid #10B981' : '1px solid #E2E8F0',
          background: isActive ? '#F0FDF4' : '#fff',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled && !isActive ? 0.6 : 1,
          transition: 'all 0.2s'
        }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: isActive ? '#065F46' : '#1E293B', marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: '0.7rem', color: isActive ? '#047857' : '#64748B', lineHeight: 1.2 }}>{subLabel}</div>
        </div>
        <div style={{ width: 16, height: 16, borderRadius: '50%', border: isActive ? '5px solid #10B981' : '1.5px solid #CBD5E1', background: '#fff', flexShrink: 0 }} />
      </div>
    );
  };

  const MetricCard = ({ label, value, icon, color, bg }: any) => (
    <div style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', lineHeight: 1.2, maxWidth: '70%' }}>{label}</div>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: bg, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`ti ${icon}`} style={{ fontSize: '1.1rem' }}></i>
        </div>
      </div>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0F172A' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ══ Compile Parameters (single full-width card) ══ */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>

        {/* Header row: title left, export buttons right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-filter" style={{ fontSize: '15px', color: '#0D9488' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>Compile Parameters</span>
          </div>
          {/* Export & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            <button
              onClick={() => window.print()}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              <i className="ti ti-printer" style={{ fontSize: '15px' }} /> Print
            </button>
            <button
              onClick={handleExportCSV}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
              <i className="ti ti-download" style={{ fontSize: '15px' }} /> Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 18px', background: '#0D9488', border: 'none', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700, color: '#fff', cursor: 'pointer', transition: 'background 0.15s', whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(13,148,136,0.25)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0F766E')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0D9488')}>
              <i className="ti ti-file-description" style={{ fontSize: '15px' }} /> Export Formal PDF
            </button>
          </div>
        </div>

        {/* Fields row */}
        <div style={{ padding: '18px 24px', display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>

          {/* Report Ledger Type — now includes all report types */}
          <div style={{ flex: '1 1 220px', minWidth: 200 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Report Ledger Type</label>
            <div style={{ position: 'relative' }}>
              <select value={compileLedgerType} onChange={e => { setCompileLedgerType(e.target.value); setReportType(e.target.value === 'Aging of Accounts' ? 'aging' : e.target.value === 'Invoice Summary' ? 'invoices' : e.target.value === 'Collection Summary' ? 'collections' : 'duplicate'); }}
                style={{ width: '100%', appearance: 'none', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 32px 9px 12px', fontSize: '0.85rem', color: '#0F172A', cursor: 'pointer', outline: 'none' }}>
                {(user?.role === Role.FINANCIAL_MANAGER || user?.role === Role.HEAD_ACCOUNTANT || user?.role === Role.ACCOUNTANT) && (
                  <optgroup label="── Financial Reports ──">
                    <option value="Aging of Accounts">Aging of Accounts</option>
                    <option value="Invoice Summary">Invoice Summary</option>
                    <option value="Collection Summary">Collection Summary</option>
                  </optgroup>
                )}
                {(user?.role === Role.FINANCIAL_MANAGER || user?.role === Role.HEAD_ACCOUNTANT || user?.role === Role.ASSISTANT_FM) && (
                  <optgroup label="── Duplicate Detection ──">
                    <option value="Duplicate Alert Summary">Duplicate Alert Summary</option>
                    <option value="Unique Document Ledger">Unique Document Ledger</option>
                    <option value="Flagged Duplicates Log">Flagged Duplicates Log</option>
                    <option value="Review History Audit">Review History Audit</option>
                  </optgroup>
                )}
              </select>
              <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '13px', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Search Keyword */}
          <div style={{ flex: '1 1 200px', minWidth: 180 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Search Keyword (e.g. Client, Key)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 12px' }}>
              <i className="ti ti-search" style={{ color: '#94A3B8', fontSize: '14px', flexShrink: 0 }} />
              <input value={compileSearch} onChange={e => setCompileSearch(e.target.value)} placeholder="Type to filter results..."
                style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.85rem', color: '#0F172A', width: '100%' }} />
            </div>
          </div>

          {/* Date Range Snapshot */}
          <div style={{ flex: '1 1 160px', minWidth: 150 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date Range Snapshot</label>
            <div style={{ position: 'relative' }}>
              <i className="ti ti-calendar" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '14px', pointerEvents: 'none' }} />
              <select value={compileDateRange} onChange={e => setCompileDateRange(e.target.value)}
                style={{ width: '100%', appearance: 'none', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 32px 9px 34px', fontSize: '0.85rem', color: '#0F172A', cursor: 'pointer', outline: 'none' }}>
                <option>Last 7 Days</option>
                <option>Last 30 Days</option>
                <option>Last 90 Days</option>
                <option>This Month</option>
                <option>This Year</option>
                <option>All Time</option>
              </select>
              <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '13px', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Status Filter */}
          {(user?.role === Role.HEAD_ACCOUNTANT || user?.role === Role.FINANCIAL_MANAGER) && (
            <div style={{ flex: '1 1 140px', minWidth: 130 }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Status Filter</label>
              <div style={{ position: 'relative' }}>
                <select value={compileStatus} onChange={e => setCompileStatus(e.target.value)}
                  style={{ width: '100%', appearance: 'none', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 32px 9px 12px', fontSize: '0.85rem', color: '#0F172A', cursor: 'pointer', outline: 'none' }}>
                  <option>All Statuses</option>
                  <option>Pending Review</option>
                  <option>Resolved</option>
                  <option>Dismissed</option>
                  <option>Flagged</option>
                </select>
                <i className="ti ti-chevron-down" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748B', fontSize: '13px', pointerEvents: 'none' }} />
              </div>
            </div>
          )}

          {/* Generate Report */}
          <div style={{ flexShrink: 0 }}>
            <button onClick={handleGenerateReport}
              style={{ background: '#0D9488', color: '#ffffff', padding: '9px 18px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'background 0.15s', boxShadow: '0 2px 6px rgba(13,148,136,0.25)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#0F766E')}
              onMouseLeave={e => (e.currentTarget.style.background = '#0D9488')}>
              <i className="ti ti-chart-pie" style={{ fontSize: '15px' }} />
              Generate Report
            </button>
          </div>
        </div>
      </div>


      {/* ══ ROW 3: Main Content (full-width) ══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
        {selectedClientId && clients.find((c: Client) => c.id === selectedClientId) && (
          <div style={{ marginBottom: -8 }}>
            <ClientInfoCard client={clients.find((c: Client) => c.id === selectedClientId)!} />
          </div>
        )}

        {!isGenerated ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 64, textAlign: 'center', border: '1px dashed #CBD5E1', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <i className="ti ti-chart-bar" style={{ fontSize: 36, color: '#94A3B8' }}></i>
            </div>
            <h3 style={{ margin: '0 0 8px', color: '#0F172A', fontSize: '1.2rem', fontWeight: 700 }}>Ready to Generate</h3>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.95rem', maxWidth: 300, lineHeight: 1.5 }}>Configure your report criteria on the left panel to fetch insights and analytics.</p>
          </div>
        ) : (
          <>
            {/* Dynamic Report Header */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
              <p style={{ margin: '0 0 6px', fontSize: '0.75rem', fontWeight: 800, color: '#0EA5E9', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DYNAMIC REPORT</p>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.5rem', fontWeight: 800, color: '#0F172A' }}>
                {reportType === 'aging' ? 'Aging of Accounts Report' : reportType === 'invoices' ? 'Invoice Summary Report' : 'Collection Summary Report'}
              </h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B', fontWeight: 500 }}>
                Generated {new Date().toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })} &bull; Date Bound: {new Date(dateFrom).toLocaleDateString()} to {new Date(dateTo).toLocaleDateString()} &bull; Client Filter: {selectedClientId ? clients.find(c => c.id === selectedClientId)?.name : 'All Clients'}
              </p>
            </div>

            {/* ── Tab 1: Aging of Accounts ── */}
            {activeTab === 'aging' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                  {['0-30 days', '31-60 days', '61-90 days', '90+ days'].map(bracket => {
                    const data = getAgingBracketData(bracket);
                    const { color, border, bg } = BRACKET_COLORS[bracket];
                    return (
                      <MetricCard key={bracket} label={bracket + ' UNPAID'} value={data.count} icon="ti-clock" color={color} bg={bg} />
                    );
                  })}
                </div>

                <TableContainer>
                  <DataTable
                    data={agingRecords}
                    columns={agingColumns}
                    rowKey="id"
                    exportable={false}
                    hideSearch={true}
                  />
                </TableContainer>
              </>
            )}

            {/* ── Tab 2: Invoice Summary ── */}
            {activeTab === 'invoices' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <MetricCard label="TOTAL INVOICED" value={`₱${(totalInvoiced / 1000).toFixed(1)}k`} icon="ti-file-invoice" color="#0EA5E9" bg="#E0F2FE" />
                  <MetricCard label="PAID AMOUNT" value={`₱${(totalPaid / 1000).toFixed(1)}k`} icon="ti-check" color="#10B981" bg="#D1FAE5" />
                  <MetricCard label="OUTSTANDING" value={`₱${(totalOutstanding / 1000).toFixed(1)}k`} icon="ti-alert-circle" color="#F59E0B" bg="#FEF3C7" />
                  <MetricCard label="INVOICE COUNT" value={allInvoices.length} icon="ti-file-description" color="#8B5CF6" bg="#EDE9FE" />
                </div>

                <div className="kpi-anim-wrapper" style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <p style={{ margin: '0 0 20px', fontSize: '0.85rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoicing Timeline</p>
                  <div style={{ height: 280, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={invoiceChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                        <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `₱${val >= 1000 ? (val / 1000).toFixed(1).replace('.0', '') + 'k' : val}`} width={60} />
                        <Tooltip formatter={(val: any) => `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} iconType="circle" />
                        <Bar yAxisId="left" dataKey="Invoiced" fill="#0EA5E9" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar yAxisId="left" dataKey="Paid" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar yAxisId="left" dataKey="Outstanding" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <TableContainer>
                  <DataTable
                    data={allInvoices}
                    columns={invoiceColumns}
                    rowKey="id"
                    exportable={false}
                    hideSearch={true}
                  />
                </TableContainer>
              </>
            )}

            {/* ── Tab 3: Collection Report ── */}
            {activeTab === 'collections' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                  <MetricCard label="TOTAL COLLECTED" value={`₱${(totalCollected / 1000).toFixed(1)}k`} icon="ti-cash" color="#10B981" bg="#D1FAE5" />
                  <MetricCard label="TRANSACTIONS" value={collections.length} icon="ti-receipt" color="#8B5CF6" bg="#EDE9FE" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                  {/* Timeline Chart */}
                  <div className="kpi-anim-wrapper" style={{ background: '#fff', borderRadius: 12, padding: '24px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Collection Trend</p>
                      <i className="ti ti-chart-line" style={{ color: '#10B981', fontSize: '1.2rem' }}></i>
                    </div>
                    <div style={{ height: 220, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={collectionChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(val) => `₱${val >= 1000 ? (val / 1000).toFixed(1).replace('.0', '') + 'k' : val}`} width={60} />
                          <Tooltip formatter={(val: any) => `₱${Number(val).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                          <Line type="monotone" dataKey="Collected" stroke="#10B981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <TableContainer>
                  <DataTable
                    data={collections}
                    columns={selectedClientId ? collectionColumns : collectionColumns.filter(c => !['id', 'invoiceNumber'].includes(c.key))}
                    rowKey="id"
                    exportable={false}
                    hideSearch={true}
                  />
                </TableContainer>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const Reports: React.FC = () => (
  <ErrorBoundary>
    <ReportsContent />
  </ErrorBoundary>
);

export default Reports;
