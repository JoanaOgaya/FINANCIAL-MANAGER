using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Application.Features;
using FOMS.Application.Interfaces;
using FOMS.Application.Services;
using FOMS.Domain.Entities;
using FOMS.Infrastructure.Persistence;

namespace FOMS.Api.Controllers;

public class InvoiceSubmissionDto
{
    public string? Id { get; set; }
    public string? InvoiceNumber { get; set; }
    public string? InvoiceNo { get; set; }
    public string? ClientId { get; set; }
    public string? ClientName { get; set; }
    public List<string>? WaybillIds { get; set; }
    public decimal? Amount { get; set; }
    public decimal? FreightCharges { get; set; }
    public decimal? OtherCharges { get; set; }
    public decimal? Subtotal { get; set; }
    public decimal? VatAmount { get; set; }
    public decimal? SurchargeAmount { get; set; }
    public decimal? Surcharge { get; set; }
    public decimal? TotalAmount { get; set; }
    public string? BillingSchedule { get; set; }
    public string? BillingPeriod { get; set; }
    public string? Status { get; set; }
    public string? PaymentStatus { get; set; }
    public string? CreatedBy { get; set; }
    public string? CreatedAt { get; set; }
    public string? BillingDate { get; set; }
    public string? DueDate { get; set; }
    public string? Notes { get; set; }
    public string? Description { get; set; }
    public object? AppliedRates { get; set; }
    public string? Remarks { get; set; }
}

public class InvoiceTransitionRequest
{
    public string? Remarks { get; set; }
}

[Route("api/invoices")]
[Route("api/v1/invoices")]
[Route("invoices")]
[Route("billing-invoices")]
[Route("api/billing-invoices")]
public class InvoicesController : ApiControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly FomsDbContext _fomsDb;

    public InvoicesController(IApplicationDbContext context, FomsDbContext fomsDb)
    {
        _context = context;
        _fomsDb = fomsDb;
    }

    private static object MapToFrontend(Invoice i)
    {
        var status = i.PaymentStatus == "Paid" ? "Approved" :
                     !string.IsNullOrEmpty(i.PaymentValidationStatus) ? 
                        (i.PaymentValidationStatus.Contains("Pending") || i.PaymentValidationStatus.Contains("Review") ? "Pending Approval" : 
                         i.PaymentValidationStatus.Contains("Correction") ? "Needs Revision" : "Approved") :
                     "Pending Approval";

        var isDueSoon = DateTime.TryParse(i.DueDate, out var dt) && (dt - DateTime.UtcNow).TotalDays <= 7 && (dt - DateTime.UtcNow).TotalDays >= 0;
        var pStatus = i.Balance <= 0 ? "Paid" :
                      i.DaysOverdue > 0 ? "Overdue" :
                      isDueSoon ? "Due Soon" : "Unpaid";

        return new
        {
            id = i.Id,
            invoiceNumber = i.InvoiceNo,
            invoiceNo = i.InvoiceNo,
            clientId = i.ClientId,
            clientName = i.ClientName,
            waybillIds = new List<string>(),
            amount = i.FreightCharges,
            freightCharges = i.FreightCharges,
            otherCharges = i.OtherCharges,
            subtotal = i.Subtotal,
            vatRate = i.VatRate,
            vatAmount = i.VatAmount,
            surchargeAmount = i.Surcharge,
            surcharge = i.Surcharge,
            totalAmount = i.TotalAmount,
            amountPaid = i.AmountPaid,
            balance = i.Balance,
            billingSchedule = "Monthly",
            billingPeriod = !string.IsNullOrEmpty(i.Description) ? i.Description : $"{i.BillingDate} - {i.DueDate}",
            status = status,
            paymentStatus = pStatus,
            paymentValidationStatus = i.PaymentValidationStatus,
            agingBucket = i.AgingBucket,
            daysOverdue = i.DaysOverdue,
            createdBy = i.EncodedBy,
            encodedBy = i.EncodedBy,
            createdAt = i.DateEncoded,
            dateEncoded = i.DateEncoded,
            dueDate = i.DueDate,
            billingDate = i.BillingDate,
            notes = i.Description,
            description = i.Description,
            archived = i.Archived
        };
    }

    [AllowAnonymous]
    [HttpGet("lookup/{invoiceNo}")]
    public async Task<IActionResult> LookupInvoice(string invoiceNo)
    {
        var normalized = invoiceNo;
        if (normalized != null && normalized.StartsWith("INV-"))
        {
            normalized = "BI-" + normalized.Substring(4);
        }

        var invoice = await _context.Invoices
            .FirstOrDefaultAsync(i => i.InvoiceNo == normalized || i.InvoiceNo == invoiceNo || i.Id == invoiceNo);

        if (invoice == null)
        {
            return NotFound(new { message = "Invoice not found. Please verify the invoice number." });
        }

        return Ok(MapToFrontend(invoice));
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetInvoices()
    {
        var invoices = await _context.Invoices.ToListAsync();

        foreach (var invoice in invoices)
        {
            BillingComputationService.RefreshInvoiceAging(invoice);
        }

        var mapped = invoices.Select(MapToFrontend).ToList();
        return Ok(mapped);
    }

    [Authorize]
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var inv = await _context.Invoices.FirstOrDefaultAsync(i => i.Id == id || i.InvoiceNo == id);
        if (inv == null)
            return NotFound(new { message = $"Invoice {id} not found." });

        BillingComputationService.RefreshInvoiceAging(inv);
        return Ok(MapToFrontend(inv));
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> CreateInvoice([FromBody] InvoiceSubmissionDto submission)
    {
        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? submission.CreatedBy ?? "User";
        var clientName = submission.ClientName;

        if (string.IsNullOrEmpty(clientName) && !string.IsNullOrEmpty(submission.ClientId))
        {
            var client = await _context.Clients.FirstOrDefaultAsync(c => c.Id == submission.ClientId || c.ClientCode == submission.ClientId);
            clientName = client?.Name ?? $"Client {submission.ClientId}";
        }

        var invNo = !string.IsNullOrEmpty(submission.InvoiceNumber) ? submission.InvoiceNumber :
                    !string.IsNullOrEmpty(submission.InvoiceNo) ? submission.InvoiceNo :
                    $"INV-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}";

        var freightCharges = submission.Amount ?? submission.FreightCharges ?? 0m;
        var otherCharges = submission.OtherCharges ?? 0m;
        var subtotal = submission.Subtotal ?? (freightCharges + otherCharges);
        var vatAmount = submission.VatAmount ?? Math.Round(subtotal * 0.12m, 2);
        var surcharge = submission.SurchargeAmount ?? submission.Surcharge ?? 0m;
        var totalAmount = submission.TotalAmount ?? (subtotal + vatAmount + surcharge);

        var invoice = new Invoice
        {
            Id = Guid.NewGuid().ToString(),
            InvoiceNo = invNo,
            ClientId = submission.ClientId ?? "1",
            ClientName = clientName ?? "Client",
            BillingDate = submission.BillingDate ?? submission.CreatedAt ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
            DueDate = submission.DueDate ?? DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"),
            FreightCharges = freightCharges,
            OtherCharges = otherCharges,
            Subtotal = subtotal,
            VatRate = 0.12,
            VatAmount = vatAmount,
            Surcharge = surcharge,
            TotalAmount = totalAmount,
            AmountPaid = 0m,
            Balance = totalAmount,
            PaymentStatus = "Unpaid",
            PaymentValidationStatus = submission.Status ?? "Pending Approval",
            AgingBucket = "Current",
            DaysOverdue = 0,
            Description = submission.Notes ?? submission.Description ?? submission.BillingPeriod ?? string.Empty,
            EncodedBy = user,
            DateEncoded = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            UpdatedBy = user,
            LastUpdated = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss"),
            Archived = false
        };

        BillingComputationService.RefreshInvoiceAging(invoice);
        _context.Invoices.Add(invoice);

        // Also add audit log
        var audit = new AuditLog
        {
            UserId = user,
            EntityName = "Invoice",
            EntityId = invoice.Id,
            Action = "Create Invoice",
            Details = $"Created invoice {invoice.InvoiceNo} for {invoice.ClientName}. Total: ₱{invoice.TotalAmount:N2}.",
            LoggedAt = DateTime.UtcNow
        };
        _context.AuditLogs.Add(audit);

        // Sync with MSSQL FomsDbContext Invoices table
        try
        {
            var mssqlInvoice = new FOMS.Domain.Entities.SqlServer.Invoice
            {
                InvoiceNumber = invoice.InvoiceNo,
                ClientId = int.TryParse(invoice.ClientId, out var cid) ? cid : 1,
                BillingPeriod = invoice.Description,
                DueDate = DateOnly.TryParse(invoice.DueDate, out var dDate) ? dDate : DateOnly.FromDateTime(DateTime.UtcNow.AddDays(30)),
                TotalAmount = invoice.TotalAmount,
                PaidAmount = 0m,
                OutstandingBalance = invoice.TotalAmount,
                InvoiceStatus = invoice.PaymentValidationStatus,
                ValidationStatus = invoice.PaymentValidationStatus,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _fomsDb.Invoices.Add(mssqlInvoice);
            _fomsDb.AuditLogs.Add(new FOMS.Domain.Entities.SqlServer.AuditLog
            {
                action = "CREATE_INVOICE",
                module = "Invoices",
                role = "Accountant",
                remarks = $"Created invoice {invoice.InvoiceNo} for Client {invoice.ClientId}. Total: ₱{invoice.TotalAmount:N2}.",
                created_at = DateTime.UtcNow
            });
            await _fomsDb.SaveChangesAsync();
        }
        catch
        {
            // fallback if MSSQL table has schema variations
        }

        await _context.SaveChangesAsync(default);

        return Ok(MapToFrontend(invoice));
    }

    [Authorize]
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateInvoice(string id, [FromBody] InvoiceSubmissionDto submission)
    {
        var invoice = await _context.Invoices.FirstOrDefaultAsync(i => i.Id == id || i.InvoiceNo == id);
        if (invoice == null) return NotFound(new { message = $"Invoice {id} not found." });

        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "User";

        if (!string.IsNullOrEmpty(submission.Status))
        {
            invoice.PaymentValidationStatus = submission.Status;
            if (submission.Status == "Paid")
            {
                invoice.PaymentStatus = "Paid";
                invoice.Balance = 0;
                invoice.AmountPaid = invoice.TotalAmount;
            }
        }

        if (submission.Amount.HasValue || submission.FreightCharges.HasValue)
            invoice.FreightCharges = submission.Amount ?? submission.FreightCharges!.Value;

        if (submission.TotalAmount.HasValue)
            invoice.TotalAmount = submission.TotalAmount.Value;

        if (!string.IsNullOrEmpty(submission.Notes) || !string.IsNullOrEmpty(submission.Description))
            invoice.Description = submission.Notes ?? submission.Description!;

        if (!string.IsNullOrEmpty(submission.DueDate))
            invoice.DueDate = submission.DueDate;

        invoice.UpdatedBy = user;
        invoice.LastUpdated = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss");

        BillingComputationService.RefreshInvoiceAging(invoice);
        await _context.SaveChangesAsync(default);

        // Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = user,
            EntityName = "Invoice",
            EntityId = invoice.Id,
            Action = "Update Invoice",
            Details = $"Updated invoice {invoice.InvoiceNo}. Status: {invoice.PaymentValidationStatus}.",
            LoggedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(default);

        return Ok(MapToFrontend(invoice));
    }

    [Authorize]
    [HttpPost("{id}/{actionName}")]
    public async Task<IActionResult> TransitionInvoice(string id, string actionName, [FromBody] InvoiceTransitionRequest? request)
    {
        var invoice = await _context.Invoices.FirstOrDefaultAsync(i => i.Id == id || i.InvoiceNo == id);
        if (invoice == null) return NotFound(new { message = $"Invoice {id} not found." });

        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "User";

        var newStatus = actionName.ToLower() switch
        {
            "approve" => "Approved",
            "reject" => "Needs Revision",
            "return" => "Needs Revision",
            "verify" => "Approved",
            "submit" => "Pending Approval",
            _ => invoice.PaymentValidationStatus ?? "Pending Approval"
        };

        invoice.PaymentValidationStatus = newStatus;
        invoice.UpdatedBy = user;
        invoice.LastUpdated = DateTime.UtcNow.ToString("yyyy-MM-ddTHH:mm:ss");

        if (actionName.ToLower() == "reject" && !string.IsNullOrEmpty(request?.Remarks))
        {
            invoice.Description = $"[Revision Note: {request.Remarks}] " + invoice.Description;
        }

        BillingComputationService.RefreshInvoiceAging(invoice);
        await _context.SaveChangesAsync(default);

        // Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            UserId = user,
            EntityName = "Invoice",
            EntityId = invoice.Id,
            Action = $"Invoice {actionName}",
            Details = $"{actionName.ToUpper()} invoice {invoice.InvoiceNo}. New Status: {newStatus}. Remarks: {request?.Remarks ?? "N/A"}",
            LoggedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync(default);

        try
        {
            var mssqlInv = await _fomsDb.Invoices.FirstOrDefaultAsync(i => i.InvoiceNumber == invoice.InvoiceNo);
            if (mssqlInv != null)
            {
                mssqlInv.ValidationStatus = newStatus;
                mssqlInv.InvoiceStatus = newStatus;
                mssqlInv.UpdatedAt = DateTime.UtcNow;
                _fomsDb.AuditLogs.Add(new FOMS.Domain.Entities.SqlServer.AuditLog
                {
                    action = $"INVOICE_{actionName.ToUpper()}",
                    module = "Invoices",
                    role = "Head Accountant",
                    remarks = $"Invoice {invoice.InvoiceNo} transitioned to {newStatus}",
                    created_at = DateTime.UtcNow
                });
                await _fomsDb.SaveChangesAsync();
            }
        }
        catch
        {
        }

        return Ok(MapToFrontend(invoice));
    }

    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteInvoice(string id)
    {
        var deletedBy = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "User";
        var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";
        var result = await Mediator.Send(new InvoiceFeatures.DeleteInvoiceCommand(id, deletedBy, userRole));
        if (!result) return NotFound();
        return Ok(new { success = true });
    }

    public record InvoiceArchiveRequest(bool Archived);

    [Authorize]
    [HttpPut("{id}/archive")]
    public async Task<IActionResult> ArchiveInvoice(string id, [FromBody] InvoiceArchiveRequest request)
    {
        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "User";
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "User";
        var result = await Mediator.Send(new InvoiceFeatures.ArchiveInvoiceCommand(id, request.Archived, user, role));
        if (!result) return NotFound();
        return Ok(new { success = true });
    }
}
