import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/shared/StatusBadge';
import { Card } from '../components/Card';
import { Button } from '../components/Buttons';
import { TableContainer } from '../components/TableContainer';
import { ClientInfoCard } from '../components/ClientInfoCard';
import { useToast } from '../components/ToastContext';
import { useQuery } from '../hooks/useQuery';
import { paymentsService } from '../services/paymentsService';
import { clientsService } from '../services/clientsService';
import { invoicesService } from '../services/invoicesService';
import { speedpayService } from '../services/speedpayService';
import type { Receipt, Client, Invoice, Payment, SpeedPaySubmission } from '../types/entities';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export const Receipts: React.FC = () => {
  const { id: clientIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const receiptIdParam = searchParams.get('receiptId');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [receiptsSearch, setReceiptsSearch] = useState('');
  const [clientReceiptsSearch, setClientReceiptsSearch] = useState('');

  const { data: receiptsData } = useQuery('receipts', () => paymentsService.receipts.list({ pageSize: 100 }));
  const { data: clientsData } = useQuery('clients', () => clientsService.list({ pageSize: 100 }));
  const { data: invoicesData } = useQuery('invoices', () => invoicesService.list({ pageSize: 100 }));
  const { data: paymentsData } = useQuery('payments', () => paymentsService.list({ pageSize: 100 }));
  const { data: speedPayData } = useQuery('speedPay', () => speedpayService.list({ pageSize: 100 }));

  const receipts: Receipt[] = receiptsData?.items || [];
  const clients: Client[] = clientsData?.items || [];
  const invoices: Invoice[] = invoicesData?.items || [];
  const payments: Payment[] = paymentsData?.items || [];
  const speedPay: SpeedPaySubmission[] = speedPayData?.items || [];

  const safeFormatDate = (dateVal: string | Date | undefined | null, options?: Intl.DateTimeFormatOptions) => {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-PH', options || { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ─────────────────────────────────────────────────────────────
  // DETAIL VIEW — card form with Print/PDF popup
  // ─────────────────────────────────────────────────────────────
  const renderReceiptModal = () => {
    if (!receiptIdParam) return null;
    const cleanReceiptId = receiptIdParam.replace(/^SP-(SP-)+/, 'SP-');
    const baseId = cleanReceiptId.replace(/^SP-/, '');

    const initialRaw = receipts.find((r: Receipt) =>
      r.id === receiptIdParam ||
      r.id === cleanReceiptId ||
      r.id === baseId ||
      r.paymentId === receiptIdParam ||
      r.paymentId === cleanReceiptId ||
      r.paymentId === baseId ||
      r.receiptNumber === receiptIdParam ||
      r.referenceNumber === receiptIdParam
    );
    let raw: Receipt | undefined = initialRaw;
    let client = initialRaw ? clients.find((c: Client) => c.id === initialRaw.clientId) : undefined;
    let invoice = initialRaw ? invoices.find((i: Invoice) => i.id === initialRaw.invoiceId) : undefined;
    let payment = initialRaw ? payments.find((p: Payment) => p.id === initialRaw.paymentId) : undefined;

    if (!raw) {
      const pmt = payments.find((p: Payment) =>
        p.id === receiptIdParam ||
        p.id === cleanReceiptId ||
        p.id === baseId ||
        `OR-${p.id}` === receiptIdParam ||
        p.referenceNumber === receiptIdParam ||
        (p.orNumber && p.orNumber === receiptIdParam)
      );
      if (pmt) {
        invoice = invoices.find((i: Invoice) => i.id === pmt.invoiceId);
        client = clients.find((c: Client) => c.id === pmt.clientId);
        payment = pmt;
        raw = {
          id: pmt.id,
          receiptNumber: pmt.orNumber || `OR-2026-${pmt.id.slice(0, 8).toUpperCase()}`,
          referenceNumber: pmt.referenceNumber,
          paymentId: pmt.id,
          clientId: pmt.clientId,
          invoiceId: pmt.invoiceId,
          amount: pmt.amount,
          issuedAt: pmt.recordedAt || new Date().toISOString(),
          issuedBy: (pmt as any).validatedBy || user?.fullName || 'Finance Accountant',
          paymentMethod: pmt.paymentMethod,
          status: 'Issued OR',
        };
      } else {
        const sp = speedPay.find((s: SpeedPaySubmission) =>
          s.id === receiptIdParam ||
          s.id === cleanReceiptId ||
          s.id === baseId ||
          `SP-${s.id}` === receiptIdParam ||
          `SP-${s.id}` === cleanReceiptId ||
          `SP-SP-${s.id}` === receiptIdParam ||
          s.referenceNumber === receiptIdParam ||
          (s.invoiceNumber && s.invoiceNumber === receiptIdParam)
        );
        if (sp) {
          invoice = invoices.find((i: Invoice) => i.id === sp.invoiceId || (sp.invoiceNumber && i.invoiceNumber === sp.invoiceNumber));
          const targetClientId = (sp as any).clientId || invoice?.clientId || '';
          client = clients.find((c: Client) => c.id === targetClientId) || (sp.clientName ? clients.find((c: Client) => c.name.toLowerCase() === sp.clientName.toLowerCase()) : undefined);
          payment = {
            id: sp.id,
            clientId: targetClientId,
            invoiceId: sp.invoiceId,
            amount: sp.amountPaid,
            paymentMethod: sp.paymentMethod,
            referenceNumber: sp.referenceNumber,
            recordedAt: sp.submittedAt,
            status: 'Validated',
            proofOfPaymentUrl: sp.proofFileUrl,
          } as any;
          raw = {
            id: sp.id,
            receiptNumber: (sp as any).orNumber || `OR-2026-${sp.id.replace(/^SP-/, '').slice(0, 8).toUpperCase()}`,
            referenceNumber: sp.referenceNumber,
            paymentId: sp.id,
            clientId: targetClientId,
            invoiceId: sp.invoiceId,
            amount: sp.amountPaid,
            issuedAt: sp.submittedAt || new Date().toISOString(),
            issuedBy: (sp as any).validatedBy || user?.fullName || 'Finance Accountant',
            paymentMethod: sp.paymentMethod,
            status: 'Issued OR',
          };
        } else {
          return null;
        }
      }
    }

    const or = {
      ...raw,
      clientName: client?.name ?? (raw as any).clientName ?? 'Unknown',
      clientCode: raw.clientId || client?.id || '—',
      invoiceNumber: invoice?.invoiceNumber ?? raw.invoiceId,
      paymentMethod: payment?.paymentMethod ?? raw.paymentMethod ?? 'N/A',
      referenceNumber: payment?.referenceNumber ?? raw.referenceNumber ?? 'N/A',
    };

    const issuedByName = user?.fullName || 'Finance Accountant';

    // ── Number → words ──────────────────────────────────────────
    function numberToWords(amount: number): string {
      if (amount === 0) return 'Zero Pesos Only';
      const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
      const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
      function conv(n: number): string {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + conv(n % 100) : '');
        if (n < 1000000) return conv(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + conv(n % 1000) : '');
        return conv(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + conv(n % 1000000) : '');
      }
      const pesos = Math.floor(amount);
      const centavos = Math.round((amount - pesos) * 100);
      let result = conv(pesos) + ' Pesos';
      if (centavos > 0) result += ' and ' + conv(centavos) + '/100 Centavos';
      return result + ' Only';
    }

    // ── Print handler: opens a new popup window with the formal OR document ──
    const handlePrint = () => {
      const issuedDate = new Date(or.issuedAt).toLocaleDateString('en-PH', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      const amountFormatted = `&#8369;${or.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
      const amountWords = numberToWords(or.amount);

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Official Receipt &mdash; ${or.receiptNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', Arial, sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 40px 48px;
      max-width: 820px;
      margin: 0 auto;
    }
    h1 {
      text-align: center;
      font-size: 30px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .subtitle {
      text-align: center;
      color: #DC2626;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.04em;
      margin-bottom: 28px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .company-name { font-size: 17px; font-weight: 800; }
    .company-info { font-size: 12px; color: #374151; line-height: 1.7; margin-top: 4px; }
    .or-meta      { text-align: right; font-size: 13px; line-height: 2; }
    .or-meta strong { font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    td { padding: 9px 14px; border: 1px solid #D1D5DB; vertical-align: top; line-height: 1.5; }
    td:first-child { font-weight: 700; width: 38%; background: #F9FAFB; white-space: nowrap; }
    .box {
      border: 1px solid #D1D5DB;
      border-radius: 4px;
      padding: 14px 16px;
      margin-bottom: 20px;
      background: #F9FAFB;
    }
    .box-label { font-weight: 700; margin-bottom: 6px; }
    .box-body   { color: #374151; line-height: 1.6; }
    .vrow { display: flex; gap: 8px; margin-bottom: 5px; }
    .vrow .vl { font-weight: 700; min-width: 170px; }
    .vrow .vv { color: #374151; }
    .sigs {
      display: flex;
      justify-content: space-between;
      margin-top: 48px;
      margin-bottom: 16px;
    }
    .sig { text-align: center; width: 42%; }
    .sig-line { border-top: 1.5px solid #111; margin-bottom: 6px; }
    .sig-label { font-weight: 700; font-size: 12px; letter-spacing: 0.03em; }
    .footer {
      text-align: center;
      font-weight: 700;
      font-size: 11px;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #6B7280;
      border-top: 1px solid #E5E7EB;
      padding-top: 12px;
      margin-top: 8px;
    }
    @media print {
      body { padding: 20px 32px; }
      @page { margin: 0.5in; size: A4; }
    }
  </style>
</head>
<body>
  <h1>Official Receipt</h1>
  <div class="subtitle">FOR SYSTEM TESTING ONLY &mdash; NOT A VALID RECEIPT</div>

  <div class="header">
    <div>
      <div class="company-name">SPEEDEX Logistics Services</div>
      <div class="company-info">
        123 Finance Avenue, Quezon City, Philippines<br/>
        TIN: 123-456-789-000<br/>
        Contact: (02) 8123-4567
      </div>
    </div>
    <div class="or-meta">
      <div>Official Receipt No.:&nbsp;&nbsp;<strong>${or.receiptNumber}</strong></div>
      <div>Date:&nbsp;&nbsp;<strong>${issuedDate}</strong></div>
    </div>
  </div>

  <table>
    <tbody>
      <tr><td>Received From:</td><td>${or.clientName}</td></tr>
      <tr><td>Client Code:</td><td>${or.clientCode}</td></tr>
      <tr><td>Invoice No.:</td><td>${or.invoiceNumber}</td></tr>
      <tr><td>Amount Received:</td><td>${amountFormatted}</td></tr>
      <tr><td>Amount in Words:</td><td>${amountWords}</td></tr>
      <tr><td>Payment Method:</td><td>${or.paymentMethod}</td></tr>
      <tr><td>Payment Reference No.:</td><td>${or.referenceNumber}</td></tr>
      <tr><td>Payment Status:</td><td>Issued OR</td></tr>
      <tr><td>Invoice Status:</td><td>Paid</td></tr>
      <tr><td>Outstanding Balance:</td><td>&#8369;0.00</td></tr>
    </tbody>
  </table>

  <div class="box">
    <div class="box-label">Purpose of Payment:</div>
    <div class="box-body">Full payment for logistics and delivery services covered by Invoice No. ${or.invoiceNumber}.</div>
  </div>

  <div class="box" style="background:#fff;">
    <div class="vrow"><span class="vl">Received / Validated By:</span><span class="vv">${issuedByName}</span></div>
    <div class="vrow"><span class="vl">Validation Date:</span><span class="vv">${issuedDate}</span></div>
    <div class="vrow"><span class="vl">Remarks:</span><span class="vv">Payment successfully validated and linked to the corresponding invoice and Accounts Receivable record.</span></div>
  </div>

  <div class="sigs">
    <div class="sig"><div class="sig-line"></div><div class="sig-label">Received By</div></div>
    <div class="sig"><div class="sig-line"></div><div class="sig-label">Authorized Signature</div></div>
  </div>

  <div class="footer">System-Generated Test Receipt</div>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

      toast.info(`Generating PDF for receipt ${or.receiptNumber}...`, 'Please wait');

      const opt = {
        margin: 0,
        filename: `${or.receiptNumber}.pdf`,
        image: { type: 'jpeg' as 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 820 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as 'portrait' }
      };

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Remove the print script so it doesn't trigger in the iframe html2pdf creates
      const scriptTags = tempDiv.getElementsByTagName('script');
      for (let i = scriptTags.length - 1; i >= 0; i--) {
        scriptTags[i].remove();
      }

      document.body.appendChild(tempDiv);

      html2pdf().from(tempDiv).set(opt).save().then(() => {
        document.body.removeChild(tempDiv);
        toast.success('Receipt PDF Downloaded successfully!', 'Success');
      }).catch((err: any) => {
        document.body.removeChild(tempDiv);
        toast.error('Failed to generate PDF.', 'Error');
        console.error('PDF Generation Error:', err);
      });
    };

    // ── Card form layout (same as original) ─────────────────────
    const inputStyle = (accent?: string): React.CSSProperties => ({
      padding: '12px 16px',
      border: `1px solid ${accent ?? '#E2E8F0'}`,
      borderRadius: '8px',
      fontSize: '14px',
      color: accent === '#FCD34D' ? '#92400E' : accent === '#10B981' ? '#10B981' : '#0F172A',
      background: accent === '#FCD34D' ? '#FFFBEB' : accent === '#10B981' ? '#F0FDF4' : '#F8FAFC',
      fontWeight: (accent === '#FCD34D' || accent === '#10B981') ? 700 : 400,
      outline: 'none',
    });

    const labelStyle: React.CSSProperties = {
      fontSize: '11px', fontWeight: 800, color: '#64748B',
      textTransform: 'uppercase', letterSpacing: '0.05em',
    };

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '24px', backdropFilter: 'blur(4px)' }} onClick={() => navigate(clientIdParam ? `/receipts/${clientIdParam}` : '/receipts')}>
        <div style={{ background: '#F8FAFC', width: '100%', maxWidth: '850px', maxHeight: '100%', overflowY: 'auto', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
          
          {/* STICKY HEADER */}
          <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', zIndex: 10, borderTopLeftRadius: '12px', borderTopRightRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              <button 
                onClick={() => navigate(clientIdParam ? `/receipts/${clientIdParam}` : '/receipts')} 
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%', color: '#64748B', transition: 'background 0.2s', marginRight: '-8px' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F5F9'} 
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Go Back"
              >
                <i className="ti ti-arrow-left" style={{ fontSize: '20px' }} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em' }}>PAYMENT STATUS</span>
                <span style={{ color: '#D97706', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: '#FEF3C7', display: 'flex', padding: '2px', borderRadius: '50%' }}><i className="ti ti-alert-circle" style={{ color: '#D97706', fontSize: '14px' }} /></span> Issued OR
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em' }}>INVOICE STATUS</span>
                <span style={{ color: '#059669', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ background: '#D1FAE5', display: 'flex', padding: '2px', borderRadius: '50%' }}><i className="ti ti-check" style={{ color: '#059669', fontSize: '14px' }} /></span> Paid
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, color: '#94A3B8', letterSpacing: '0.05em' }}>DATE ISSUED</span>
                <span style={{ color: '#0F172A', fontWeight: 700, fontSize: '13px' }}>{new Date(or.issuedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={(e) => { e.stopPropagation(); handlePrint(); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0D9488', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer' }}>
                <i className="ti ti-printer" style={{ fontSize: '16px' }} /> Print / PDF
              </button>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
        <Card>
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* ── PAID Stamp ── */}
            <div style={{
              position: 'absolute', top: '35%', left: '50%',
              transform: 'translate(-50%, -50%) rotate(-20deg)', pointerEvents: 'none',
              border: '6px solid rgba(220, 38, 38, 0.15)', color: 'rgba(220, 38, 38, 0.15)',
              padding: '10px 30px', fontSize: '5rem', fontWeight: 900,
              textTransform: 'uppercase', letterSpacing: '0.1em', zIndex: 0
            }}>
              PAID
            </div>

            {/* ── Header ── */}
            <div style={{ textAlign: 'center', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '1.3rem', fontWeight: 800, color: '#0F172A' }}>Speedex Courier & Forwarder, Inc.</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748B' }}>123 Rizal St, Brgy. Poblacion, Cebu City</p>
              <h1 style={{ margin: '24px 0 16px', fontSize: '1.8rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#0F172A' }}>
                RECEIPT
              </h1>
            </div>

            {/* ── Details ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px', fontSize: '0.85rem', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', color: '#0F172A' }}>
                <span style={{ color: '#64748B' }}>Receipt #:</span> <strong>{or.receiptNumber}</strong>
                <span style={{ color: '#64748B' }}>Issue Date:</span> <strong>{new Date(or.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</strong>
                <span style={{ color: '#64748B' }}>Payment Method:</span> <strong>{or.paymentMethod}</strong>
                <span style={{ color: '#64748B' }}>Reference #:</span> <strong>{or.referenceNumber}</strong>
              </div>
              <div style={{ textAlign: 'right', color: '#0F172A' }}>
                <span style={{ color: '#64748B', display: 'block', marginBottom: '4px' }}>Received From:</span>
                <strong style={{ fontSize: '1rem' }}>{or.clientName}</strong>
                <p style={{ margin: '4px 0 0', color: '#475569' }}>Code: {or.clientCode}</p>
                <p style={{ margin: '4px 0 0', color: '#475569' }}>Invoice No: {or.invoiceNumber}</p>
              </div>
            </div>

            {/* ── Table ── */}
            <div style={{ marginBottom: '32px', position: 'relative', zIndex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 6px', borderTop: '2px dashed #CBD5E1', borderBottom: '2px dashed #CBD5E1', fontSize: '0.8rem', color: '#0F172A', fontWeight: 700 }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '12px 6px', borderTop: '2px dashed #CBD5E1', borderBottom: '2px dashed #CBD5E1', fontSize: '0.8rem', color: '#0F172A', fontWeight: 700 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '10px 6px', fontSize: '0.85rem', color: '#0F172A', fontWeight: 600 }}>Payment for Invoice {or.invoiceNumber}</td>
                    <td style={{ padding: '10px 6px', fontSize: '0.9rem', color: '#0F172A', textAlign: 'right', fontWeight: 700 }}>₱{or.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ borderTop: '2px dashed #CBD5E1', marginTop: '4px' }}></div>
            </div>

            {/* ── Summary Totals ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', position: 'relative', zIndex: 1 }}>
              <div style={{ width: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 8px', marginTop: '4px', borderTop: '2px dashed #CBD5E1' }}>
                  <span style={{ fontSize: '0.95rem', color: '#0F172A', fontWeight: 800 }}>Amount Received</span>
                  <span style={{ fontSize: '1.1rem', color: '#0F172A', fontWeight: 900 }}>₱{or.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            {/* ── Amount in Words ── */}
            <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 8, marginTop: '16px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <span style={{ color: '#64748B', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>AMOUNT IN WORDS</span>
              <strong style={{ color: '#0F172A', fontSize: '0.9rem' }}>{numberToWords(or.amount)}</strong>
            </div>

            {/* ── Footer ── */}
            <div style={{ marginTop: '48px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
              <p style={{ margin: '0 0 24px', fontSize: '1rem', color: '#0F172A', fontWeight: 600 }}>Thank you!</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #E2E8F0', paddingTop: '16px' }}>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>System-generated receipt from Speedex FOMS.</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ borderTop: '1px solid #0F172A', paddingTop: 6, minWidth: 140 }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#0F172A', fontWeight: 700, textAlign: 'center', marginBottom: 2 }}>{issuedByName}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569', fontWeight: 600, textAlign: 'center' }}>Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>


          </div>
        </Card>
        </div>
        </div>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // CLIENT DETAIL VIEW — OR History cards
  // ─────────────────────────────────────────────────────────────
  if (clientIdParam) {
    const client = clients.find((c: Client) => c.id === clientIdParam);
    if (!client) return <div>Client not found</div>;

    const dbClientReceipts = receipts
      .filter((r: Receipt) => r.clientId === clientIdParam)
      .map((r: Receipt) => {
        const inv = invoices.find((i: Invoice) => i.id === r.invoiceId);
        const pmt = payments.find((p: Payment) => p.id === r.paymentId);
        return {
          ...r,
          invoiceNumber: inv?.invoiceNumber ?? r.invoiceId,
          paymentMethod: pmt?.paymentMethod ?? 'N/A',
          referenceNumber: pmt?.referenceNumber ?? 'N/A',
        };
      });

    const pmtClientReceipts = payments
      .filter((p: Payment) => p.clientId === clientIdParam && (p.status === 'Validated' || p.status === 'Approved' || (p.status as string) === 'Issued OR'))
      .filter((p: Payment) => !dbClientReceipts.some(r => r.paymentId === p.id || r.id === p.id))
      .map((p: Payment) => {
        const inv = invoices.find((i: Invoice) => i.id === p.invoiceId);
        return {
          id: p.id,
          receiptNumber: p.orNumber || `OR-2026-${p.id.slice(0, 8).toUpperCase()}`,
          referenceNumber: p.referenceNumber || 'N/A',
          paymentId: p.id,
          clientId: p.clientId,
          invoiceId: p.invoiceId,
          invoiceNumber: inv?.invoiceNumber ?? p.invoiceId,
          amount: p.amount,
          issuedAt: p.recordedAt || new Date().toISOString(),
          issuedBy: (p as any).validatedBy || user?.fullName || 'Finance Accountant',
          paymentMethod: p.paymentMethod || 'Direct Payment',
          status: 'Issued OR' as const,
        };
      });

    const spClientReceipts = speedPay
      .filter((s: SpeedPaySubmission) => {
        if (s.status !== 'Validated') return false;
        const targetClientId = (s as any).clientId || invoices.find((i: Invoice) => i.id === s.invoiceId)?.clientId;
        return targetClientId === clientIdParam || (client?.name && s.clientName && s.clientName.toLowerCase() === client.name.toLowerCase());
      })
      .filter((s: SpeedPaySubmission) => !dbClientReceipts.some(r => r.id === s.id || r.paymentId === s.id) && !pmtClientReceipts.some(p => p.id === s.id))
      .map((s: SpeedPaySubmission) => {
        const inv = invoices.find((i: Invoice) => i.id === s.invoiceId || (s.invoiceNumber && i.invoiceNumber === s.invoiceNumber));
        return {
          id: s.id,
          receiptNumber: (s as any).orNumber || `OR-2026-${s.id.replace(/^SP-/, '').slice(0, 8).toUpperCase()}`,
          referenceNumber: s.referenceNumber || 'N/A',
          paymentId: s.id,
          clientId: clientIdParam,
          invoiceId: s.invoiceId,
          invoiceNumber: s.invoiceNumber ?? inv?.invoiceNumber ?? s.invoiceId,
          amount: s.amountPaid,
          issuedAt: s.submittedAt || new Date().toISOString(),
          issuedBy: (s as any).validatedBy || user?.fullName || 'Finance Accountant',
          paymentMethod: s.paymentMethod || 'SpeedPay',
          status: 'Issued OR' as const,
        };
      });

    const clientReceipts = [...dbClientReceipts, ...pmtClientReceipts, ...spClientReceipts];

    const filteredClientReceipts = clientReceipts.filter((row: any) => {
      if (!clientReceiptsSearch.trim()) return true;
      const q = clientReceiptsSearch.toLowerCase().trim();
      return (
        (row.receiptNumber || '').toLowerCase().includes(q) ||
        (row.invoiceNumber || '').toLowerCase().includes(q) ||
        (row.referenceNumber || '').toLowerCase().includes(q) ||
        (row.paymentMethod || '').toLowerCase().includes(q)
      );
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <ClientInfoCard client={client} onBack={() => navigate('/receipts')} />

        {/* Official Receipts History - Modern Responsive Card Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header & Search Toolbar */}
          <div style={{
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '18px 24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0F172A', fontWeight: 800, letterSpacing: '-0.01em' }}>
                Official Receipt History
              </h3>
              <span style={{
                padding: '2px 10px',
                borderRadius: 9999,
                background: '#F1F5F9',
                color: '#475569',
                fontSize: '0.78rem',
                fontWeight: 700
              }}>
                {filteredClientReceipts.length} record{filteredClientReceipts.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', minWidth: 260, flex: '0 1 320px' }}>
              <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 16 }} />
              <input
                type="text"
                placeholder="Search by OR, invoice, or ref..."
                value={clientReceiptsSearch}
                onChange={e => setClientReceiptsSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 36px',
                  borderRadius: 8,
                  border: '1px solid #CBD5E1',
                  background: '#F8FAFC',
                  fontSize: '0.875rem',
                  color: '#0F172A',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              {clientReceiptsSearch && (
                <button
                  type="button"
                  onClick={() => setClientReceiptsSearch('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
                >
                  <i className="ti ti-x" style={{ fontSize: 14 }} />
                </button>
              )}
            </div>
          </div>

          {/* Card Grid or Empty State */}
          {filteredClientReceipts.length === 0 ? (
            <div style={{
              background: '#fff',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              padding: '60px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12
            }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 28 }}>
                <i className="ti ti-receipt-off" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>No official receipts found</div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748B', maxWidth: 420 }}>
                {clientReceiptsSearch ? 'No receipts match your search filter. Try clearing the search.' : 'No official receipts issued for this client yet. Once payments or SpeedPay submissions are validated, official receipts will be issued here.'}
              </p>
              {clientReceiptsSearch && (
                <button
                  type="button"
                  onClick={() => setClientReceiptsSearch('')}
                  style={{ marginTop: 8, padding: '8px 18px', borderRadius: 8, background: '#0F172A', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  Clear Search
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
              {filteredClientReceipts.map((row: any) => (
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
                    transition: 'all 0.2s ease',
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
                  {/* Top Row: OR Number + Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      background: '#F1F5F9',
                      color: '#0F172A',
                      fontFamily: 'monospace',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <i className="ti ti-receipt" style={{ color: '#0D9488' }} />
                      {row.receiptNumber}
                    </span>
                    <StatusBadge status={row.status || 'Issued OR'} />
                  </div>

                  {/* Linked Invoice & Client */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="ti ti-file-invoice" style={{ color: '#2563EB', fontSize: 16 }} />
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>
                        {row.invoiceNumber}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                      Official Receipt · {client.name}
                    </div>
                  </div>

                  {/* Amount Highlight Box */}
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    background: '#F0FDF4',
                    border: '1px solid #BBF7D0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        AMOUNT COLLECTED
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                        +₱{Number(row.amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        background: '#fff',
                        borderRadius: 6,
                        border: '1px solid #E2E8F0',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#334155'
                      }}>
                        {row.paymentMethod || 'Direct'}
                      </span>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10,
                    padding: '10px 14px',
                    background: '#F8FAFC',
                    borderRadius: 8,
                    border: '1px solid #F1F5F9'
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>REFERENCE NO.</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', fontFamily: 'monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.referenceNumber}>
                        {row.referenceNumber || '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>DATE ISSUED</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                        {safeFormatDate(row.issuedAt)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>ISSUED BY</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.issuedBy || 'Finance Accountant'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>COMPLIANCE</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                        BIR Form 2307 & OR
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/receipts/${clientIdParam}?receiptId=${row.id}`)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: '#0D9488',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        fontSize: 12.5,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        boxShadow: '0 2px 4px rgba(13,148,136,0.2)'
                      }}
                    >
                      <i className="ti ti-receipt" /> View Official Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {renderReceiptModal()}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LIST VIEW — all clients
  // ─────────────────────────────────────────────────────────────
  const relevantClientIds = new Set<string>();
  receipts.forEach((r: Receipt) => relevantClientIds.add(r.clientId));
  payments
    .filter((p: Payment) => p.status === 'Validated' || p.status === 'Approved' || (p.status as string) === 'Issued OR')
    .forEach((p: Payment) => relevantClientIds.add(p.clientId));
  speedPay
    .filter((s: SpeedPaySubmission) => s.status === 'Validated')
    .forEach((s: SpeedPaySubmission) => {
      const cId = (s as any).clientId || invoices.find((i: Invoice) => i.id === s.invoiceId)?.clientId;
      if (cId) relevantClientIds.add(cId);
    });

  const listData = Array.from(relevantClientIds).map(clientId => {
    const client = clients.find((c: Client) => c.id === clientId);
    const clientPayments = payments.filter((p: Payment) => p.clientId === clientId && (p.status === 'Validated' || p.status === 'Approved' || (p.status as string) === 'Issued OR'));
    const clientSpeedPay = speedPay.filter((s: SpeedPaySubmission) => s.status === 'Validated' && ((s as any).clientId === clientId || invoices.find((i: Invoice) => i.id === s.invoiceId)?.clientId === clientId));
    const totalCollected = clientPayments.reduce((sum, p) => sum + p.amount, 0) + clientSpeedPay.reduce((sum, s) => sum + (s.amountPaid || 0), 0);
    const receiptCount = clientPayments.length + clientSpeedPay.length;
    return {
      id: clientId,
      clientName: client?.name ?? 'Unknown',
      receiptCount,
      totalCollected,
      status: 'Issued OR',
    };
  });

  const filteredListData = listData.filter(r => {
    if (!receiptsSearch.trim()) return true;
    const q = receiptsSearch.toLowerCase().trim();
    return (r.clientName || '').toLowerCase().includes(q) || (r.id || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Informative Explanation Banner */}
      <div style={{
        background: '#F0FDF4',
        border: '1px solid #BBF7D0',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', fontSize: 20 }}>
            <i className="ti ti-receipt" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D' }}>
              Official Receipts Registry (BIR Form 2307 & OR Compliant)
            </div>
            <div style={{ fontSize: 12.5, color: '#166534', marginTop: 2 }}>
              Official Receipts are generated from validated payments and collections. Select any client or receipt to view, print, or download official PDF receipts.
            </div>
          </div>
        </div>
      </div>

      {/* Receipts Toolbar & Card Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Search Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: '#fff',
          padding: '16px 20px',
          borderRadius: 14,
          border: '1px solid #E2E8F0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
        }}>
          <div style={{ position: 'relative', minWidth: 280, flex: '1 1 280px' }}>
            <i className="ti ti-search" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: 16 }} />
            <input
              type="text"
              placeholder="Search by client name or ID..."
              value={receiptsSearch}
              onChange={e => setReceiptsSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 36px 9px 36px',
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                fontSize: '0.875rem',
                color: '#0F172A',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {receiptsSearch && (
              <button
                type="button"
                onClick={() => setReceiptsSearch('')}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}
              >
                <i className="ti ti-x" style={{ fontSize: 14 }} />
              </button>
            )}
          </div>

          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B' }}>
            Showing <strong style={{ color: '#0F172A' }}>{filteredListData.length}</strong> client record{filteredListData.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Cards Grid */}
        {filteredListData.length === 0 ? (
          <div style={{
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #E2E8F0',
            padding: '60px 20px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 28 }}>
              <i className="ti ti-receipt-off" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>No official receipts found</div>
            <p style={{ margin: 0, fontSize: 13, color: '#64748B', maxWidth: 400 }}>
              No client collections match your search. Validated collections will automatically appear here.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
            {filteredListData.map((row: any) => (
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
                  transition: 'all 0.2s ease',
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
                {/* Top Row: Client ID + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    background: '#F1F5F9',
                    color: '#475569',
                    fontFamily: 'monospace'
                  }}>
                    {row.id}
                  </span>
                  <StatusBadge status={row.status} />
                </div>

                {/* Client Name */}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#0F172A', lineHeight: 1.3 }}>
                    {row.clientName}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                    {row.receiptCount || 1} Official Receipt(s) Issued
                  </div>
                </div>

                {/* Total Collections Box */}
                <div style={{
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: '#166534', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      TOTAL VALIDATED COLLECTIONS
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                      ₱{Number(row.totalCollected || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16A34A', fontSize: 18 }}>
                    <i className="ti ti-receipt" />
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  padding: '10px 14px',
                  background: '#F8FAFC',
                  borderRadius: 8,
                  border: '1px solid #F1F5F9'
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>COMPLIANCE</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', marginTop: 2 }}>
                      BIR Form 2307 & OR
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em' }}>STATUS</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginTop: 2 }}>
                      Active Validated
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={() => navigate(`/receipts/${row.id}`)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: '#0D9488',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      boxShadow: '0 2px 4px rgba(13,148,136,0.2)'
                    }}
                  >
                    <i className="ti ti-receipt" /> View Official Receipts
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {renderReceiptModal()}
    </div>
  );


};

export default Receipts;
