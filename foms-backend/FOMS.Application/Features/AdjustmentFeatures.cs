using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using FOMS.Application.Interfaces;
using FOMS.Application.Services;
using FOMS.Domain.Entities;

namespace FOMS.Application.Features;

public static class AdjustmentFeatures
{
    // ─────────────────────────────────────────────────────────────────
    // GET ADJUSTMENTS — newest first
    // ─────────────────────────────────────────────────────────────────
    public record GetAdjustmentsQuery : IRequest<List<PaymentAdjustment>>;

    public class GetAdjustmentsQueryHandler : IRequestHandler<GetAdjustmentsQuery, List<PaymentAdjustment>>
    {
        private readonly IApplicationDbContext _context;

        public GetAdjustmentsQueryHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<List<PaymentAdjustment>> Handle(GetAdjustmentsQuery request, CancellationToken cancellationToken)
        {
            if (!await _context.PaymentAdjustments.AnyAsync(cancellationToken))
            {
                var samples = new List<PaymentAdjustment>
                {
                    new()
                    {
                        Id = "ADJ-001",
                        InvoiceNo = "LZD-2026-0001",
                        AdjustmentType = "Credit",
                        Amount = 2500m,
                        Reason = "Volume tier discount correction for Q3 shipments",
                        AdjustedBy = "Bookkeeper",
                        ApprovedBy = "Crystalyn Joyce C. Fajardo",
                        DateRequested = DateTime.UtcNow.AddDays(-1).ToString("yyyy-MM-dd"),
                        Status = "Pending"
                    },
                    new()
                    {
                        Id = "ADJ-002",
                        InvoiceNo = "BI-2026-0001",
                        AdjustmentType = "Debit",
                        Amount = 1200m,
                        Reason = "Special delivery surcharge addition",
                        AdjustedBy = "Bookkeeper",
                        ApprovedBy = "Crystalyn Joyce C. Fajardo",
                        DateRequested = DateTime.UtcNow.AddDays(-3).ToString("yyyy-MM-dd"),
                        DateApproved = DateTime.UtcNow.AddDays(-2).ToString("yyyy-MM-dd"),
                        Status = "Approved"
                    }
                };
                _context.PaymentAdjustments.AddRange(samples);
                await _context.SaveChangesAsync(cancellationToken);
            }

            // Return newest first so the list is always up-to-date on screen
            return await _context.PaymentAdjustments
                .OrderByDescending(a => a.DateRequested)
                .ThenByDescending(a => a.Id)
                .ToListAsync(cancellationToken);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CREATE ADJUSTMENT REQUEST — stays Pending until Accountant approves
    // ─────────────────────────────────────────────────────────────────
    public record CreateAdjustmentCommand(
        string InvoiceNo,
        string AdjustmentType,   // "Credit" | "Debit" | "Write-Off"
        decimal Amount,
        string Reason,
        string AdjustedBy,       // Bookkeeper who submits the request
        string ApprovedBy        // Accountant name (pre-filled; stored for reference)
    ) : IRequest<PaymentAdjustment?>;

    public class CreateAdjustmentCommandHandler : IRequestHandler<CreateAdjustmentCommand, PaymentAdjustment?>
    {
        private readonly IApplicationDbContext _context;

        public CreateAdjustmentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaymentAdjustment?> Handle(CreateAdjustmentCommand request, CancellationToken cancellationToken)
        {
            // Guard: amount must be positive
            if (request.Amount <= 0m)
                throw new InvalidOperationException("Adjustment amount must be greater than zero.");

            // Validate adjustment type
            var validTypes = new[] { "Credit", "Debit", "Write-Off" };
            if (!validTypes.Contains(request.AdjustmentType, StringComparer.OrdinalIgnoreCase))
                throw new InvalidOperationException($"Invalid adjustment type '{request.AdjustmentType}'. Allowed types: Credit, Debit, Write-Off.");

            // Find the invoice
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.InvoiceNo == request.InvoiceNo, cancellationToken);
            if (invoice == null)
                return null;

            // Guard: Credit / Write-Off cannot exceed the current invoice balance
            var adjTypeLower = request.AdjustmentType.ToLower();
            if ((adjTypeLower == "credit" || adjTypeLower == "write-off") && request.Amount > invoice.Balance)
                throw new InvalidOperationException(
                    $"Adjustment amount ({request.Amount:N2}) cannot exceed the current invoice balance ({invoice.Balance:N2}).");

            var adjustment = new PaymentAdjustment
            {
                InvoiceNo    = request.InvoiceNo,
                AdjustmentType = request.AdjustmentType,
                Amount       = request.Amount,
                Reason       = request.Reason,
                AdjustedBy   = request.AdjustedBy,
                ApprovedBy   = string.Empty,   // Not yet approved — populated on Approve
                DateRequested = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                DateApproved = string.Empty,   // Not yet approved
                Status       = "Pending"
            };

            var audit = new AuditLog
            {
                UserId     = request.AdjustedBy,
                EntityName = "PaymentAdjustment",
                EntityId   = adjustment.Id,
                Action     = "Create Payment Adjustment Request",
                Details    = $"Created pending {request.AdjustmentType} adjustment of {request.Amount:N2} " +
                             $"for invoice {request.InvoiceNo}. Reason: {request.Reason}.",
                BeforeValue = $"Balance: {invoice.Balance:N2} | Status: {invoice.PaymentStatus}",
                AfterValue  = "Status: Pending — awaiting Accountant approval"
            };
            await _context.AuditLogs.AddAsync(audit, cancellationToken);

            _context.PaymentAdjustments.Add(adjustment);
            await _context.SaveChangesAsync(cancellationToken);

            return adjustment;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // APPROVE ADJUSTMENT — applies balance change and syncs downstream
    // ─────────────────────────────────────────────────────────────────
    public record ApproveAdjustmentCommand(
        string Id,
        string ApprovedBy
    ) : IRequest<PaymentAdjustment?>;

    public class ApproveAdjustmentCommandHandler : IRequestHandler<ApproveAdjustmentCommand, PaymentAdjustment?>
    {
        private readonly IApplicationDbContext _context;

        public ApproveAdjustmentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaymentAdjustment?> Handle(ApproveAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var adjustment = await _context.PaymentAdjustments
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (adjustment == null || adjustment.Status != "Pending")
                return null;

            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.InvoiceNo == adjustment.InvoiceNo, cancellationToken);
            if (invoice == null)
                return null;

            var beforeBalance = invoice.Balance;
            var beforeStatus  = invoice.PaymentStatus;
            var beforeTotal   = invoice.TotalAmount;

            // Mark adjustment as approved
            adjustment.Status       = "Approved";
            adjustment.ApprovedBy   = request.ApprovedBy;
            adjustment.DateApproved = DateTime.UtcNow.ToString("yyyy-MM-dd");

            var adjType = adjustment.AdjustmentType.ToLower();

            // ── Apply the adjustment to the invoice ──────────────────────────────
            if (adjType == "credit" || adjType == "write-off")
            {
                // Credit / Write-Off: reduces the outstanding balance by
                // increasing AmountPaid (capped at TotalAmount to avoid negatives)
                var applied = Math.Min(adjustment.Amount, invoice.Balance);
                invoice.AmountPaid = Math.Min(invoice.AmountPaid + applied, invoice.TotalAmount);
            }
            else if (adjType == "debit")
            {
                // Debit: increases the outstanding balance by adding to TotalAmount
                // (i.e. additional charges added to the invoice)
                invoice.TotalAmount += adjustment.Amount;
            }

            // Fully recalculate all derived fields using the authoritative service
            BillingComputationService.RecalculateInvoice(invoice);
            invoice.UpdatedBy   = request.ApprovedBy;
            invoice.LastUpdated = DateTime.UtcNow.ToString("yyyy-MM-dd");

            var audit = new AuditLog
            {
                UserId     = request.ApprovedBy,
                EntityName = "PaymentAdjustment",
                EntityId   = adjustment.Id,
                Action     = "Approve Payment Adjustment",
                Details    = $"Approved {adjustment.AdjustmentType} adjustment of {adjustment.Amount:N2} " +
                             $"for invoice {adjustment.InvoiceNo}. Reason: {adjustment.Reason}.",
                BeforeValue = $"Total: {beforeTotal:N2} | Balance: {beforeBalance:N2} | Status: {beforeStatus}",
                AfterValue  = $"Total: {invoice.TotalAmount:N2} | Balance: {invoice.Balance:N2} | Status: {invoice.PaymentStatus}"
            };
            await _context.AuditLogs.AddAsync(audit, cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);

            // Sync the Billing Invoice mirror and ReceivableBalance
            await BillingComputationService.SyncBillingInvoiceAndReceivableAsync(invoice, _context, cancellationToken);

            // Sync the client's outstanding balance
            await BillingComputationService.SyncClientBalanceAsync(invoice.ClientId, _context, cancellationToken);
            await _context.SaveChangesAsync(cancellationToken);

            return adjustment;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // REJECT ADJUSTMENT — marks as rejected; NO balance change
    // ─────────────────────────────────────────────────────────────────
    public record RejectAdjustmentCommand(
        string Id,
        string RejectedBy
    ) : IRequest<PaymentAdjustment?>;

    public class RejectAdjustmentCommandHandler : IRequestHandler<RejectAdjustmentCommand, PaymentAdjustment?>
    {
        private readonly IApplicationDbContext _context;

        public RejectAdjustmentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<PaymentAdjustment?> Handle(RejectAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var adjustment = await _context.PaymentAdjustments
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            if (adjustment == null || adjustment.Status != "Pending")
                return null;

            adjustment.Status       = "Rejected";
            adjustment.ApprovedBy   = request.RejectedBy; // Records who rejected it
            adjustment.DateApproved = DateTime.UtcNow.ToString("yyyy-MM-dd");

            var audit = new AuditLog
            {
                UserId     = request.RejectedBy,
                EntityName = "PaymentAdjustment",
                EntityId   = adjustment.Id,
                Action     = "Reject Payment Adjustment",
                Details    = $"Rejected {adjustment.AdjustmentType} adjustment of {adjustment.Amount:N2} " +
                             $"for invoice {adjustment.InvoiceNo}. Reason: {adjustment.Reason}.",
                BeforeValue = "Status: Pending",
                AfterValue  = $"Status: Rejected by {request.RejectedBy}"
            };
            await _context.AuditLogs.AddAsync(audit, cancellationToken);

            await _context.SaveChangesAsync(cancellationToken);
            return adjustment;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // DELETE ADJUSTMENT — only if still Pending (Bookkeeper or Accountant)
    // ─────────────────────────────────────────────────────────────────
    public record DeleteAdjustmentCommand(string Id, string DeletedBy) : IRequest<bool>;

    public class DeleteAdjustmentCommandHandler : IRequestHandler<DeleteAdjustmentCommand, bool>
    {
        private readonly IApplicationDbContext _context;

        public DeleteAdjustmentCommandHandler(IApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<bool> Handle(DeleteAdjustmentCommand request, CancellationToken cancellationToken)
        {
            var adjustment = await _context.PaymentAdjustments
                .FirstOrDefaultAsync(a => a.Id == request.Id, cancellationToken);

            // Only Pending adjustments can be deleted
            if (adjustment == null || adjustment.Status != "Pending")
                return false;

            var audit = new AuditLog
            {
                UserId     = request.DeletedBy,
                EntityName = "PaymentAdjustment",
                EntityId   = adjustment.Id,
                Action     = "Delete Payment Adjustment",
                Details    = $"Deleted pending {adjustment.AdjustmentType} adjustment of {adjustment.Amount:N2} " +
                             $"for invoice {adjustment.InvoiceNo}.",
                BeforeValue = "Status: Pending",
                AfterValue  = "Deleted"
            };
            await _context.AuditLogs.AddAsync(audit, cancellationToken);

            _context.PaymentAdjustments.Remove(adjustment);
            await _context.SaveChangesAsync(cancellationToken);
            return true;
        }
    }
}
