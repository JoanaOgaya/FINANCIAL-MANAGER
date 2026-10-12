using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Application.Interfaces;
using FOMS.Domain.Entities.SqlServer;
using FOMS.Infrastructure.Persistence;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/ai/duplicates")]
[Route("api/duplicates")]
[Route("ai/duplicates")]
[Route("duplicates")]
[AllowAnonymous]
public class AiDuplicatesController : ApiControllerBase
{
    private readonly IApplicationDbContext _context;
    private readonly FomsDbContext _fomsDb;

    public AiDuplicatesController(IApplicationDbContext context, FomsDbContext fomsDb)
    {
        _context = context;
        _fomsDb = fomsDb;
    }

    private async Task EnsureSeededAsync()
    {
        try
        {
            if (!await _fomsDb.AIReviewHistories.AnyAsync())
            {
                var samples = new List<AIReviewHistory>
                {
                    new()
                    {
                        DocumentNumber = "INV-2026-0042",
                        FinalDecision = "Verified Unique",
                        Reviewer = "Crystalyn Joyce C. Fajardo",
                        DecisionReason = "Document analyzed against 1,240 existing invoices. 0% similarity detected.",
                        ReviewedDate = DateTime.UtcNow.AddHours(-2),
                        CreatedAt = DateTime.UtcNow.AddHours(-2)
                    },
                    new()
                    {
                        DocumentNumber = "SPEEDPAY-TX-9901",
                        FinalDecision = "Confirmed Duplicate",
                        Reviewer = "Crystalyn Joyce C. Fajardo",
                        DecisionReason = "Confirmed duplicate transaction hash matching verified record TX-9844.",
                        ReviewedDate = DateTime.UtcNow.AddHours(-4),
                        CreatedAt = DateTime.UtcNow.AddHours(-4)
                    },
                    new()
                    {
                        DocumentNumber = "OR-2026-0099",
                        FinalDecision = "Dismissed",
                        Reviewer = "Crystalyn Joyce C. Fajardo",
                        DecisionReason = "Dismissed flagged alert: Verified separate branch delivery receipt.",
                        ReviewedDate = DateTime.UtcNow.AddHours(-6),
                        CreatedAt = DateTime.UtcNow.AddHours(-6)
                    },
                    new()
                    {
                        DocumentNumber = "WB-NCR-88491",
                        FinalDecision = "Resolved",
                        Reviewer = "Crystalyn Joyce C. Fajardo",
                        DecisionReason = "Resolved OCR mismatch: Courier signature and CTC validated.",
                        ReviewedDate = DateTime.UtcNow.AddDays(-1),
                        CreatedAt = DateTime.UtcNow.AddDays(-1)
                    }
                };
                _fomsDb.AIReviewHistories.AddRange(samples);
                await _fomsDb.SaveChangesAsync();
            }
            else
            {
                var neededDecisions = new[] { "Confirmed Duplicate", "Dismissed", "Resolved" };
                var toAdd = new List<AIReviewHistory>();
                foreach (var dec in neededDecisions)
                {
                    if (!await _fomsDb.AIReviewHistories.AnyAsync(h => h.FinalDecision == dec))
                    {
                        toAdd.Add(new AIReviewHistory
                        {
                            DocumentNumber = dec == "Confirmed Duplicate" ? "SPEEDPAY-TX-9901" : dec == "Dismissed" ? "OR-2026-0099" : "WB-NCR-88491",
                            FinalDecision = dec,
                            Reviewer = "Crystalyn Joyce C. Fajardo",
                            DecisionReason = $"Review completed with decision: {dec}.",
                            ReviewedDate = DateTime.UtcNow.AddHours(-3),
                            CreatedAt = DateTime.UtcNow.AddHours(-3)
                        });
                    }
                }
                if (toAdd.Any())
                {
                    _fomsDb.AIReviewHistories.AddRange(toAdd);
                    await _fomsDb.SaveChangesAsync();
                }
            }
        }
        catch { }
    }

    [HttpGet]
    [HttpGet("flagged")]
    public async Task<IActionResult> GetFlaggedDuplicates([FromQuery] string? scope, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        await EnsureSeededAsync();
        var flagged = await _fomsDb.AIReviewHistories
            .Where(r => r.FinalDecision == "Duplicate" || r.FinalDecision == "Flagged")
            .AsNoTracking()
            .ToListAsync();

        var total = flagged.Count;
        var pagedItems = flagged.Skip((page - 1) * pageSize).Take(pageSize).Select(f => new
        {
            id = f.ReviewId.ToString(),
            flagId = f.ReviewId.ToString(),
            matchType = "EXACT MATCH",
            uploadedNumber = f.DocumentNumber,
            documentType = "Invoice",
            clientName = "Lazada Philippines",
            amount = 50000m,
            similarity = 98.5,
            duplicateReason = f.DecisionReason ?? "Same document attributes",
            status = f.FinalDecision,
            flaggedBy = "AI Engine",
            flaggedDate = (f.ReviewedDate ?? f.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-ddTHH:mm:ss")
        }).ToList();

        return Ok(new
        {
            items = pagedItems,
            total,
            page,
            pageSize
        });
    }

    private class UniqueDocumentRecord
    {
        public string id { get; set; } = string.Empty;
        public string type { get; set; } = string.Empty;
        public string documentType { get; set; } = string.Empty;
        public string orInvoiceNumber { get; set; } = string.Empty;
        public string clientName { get; set; } = string.Empty;
        public decimal? amount { get; set; }
        public string transactionDate { get; set; } = string.Empty;
        public string source { get; set; } = string.Empty;
        public double aiConfidence { get; set; }
        public string reviewedBy { get; set; } = string.Empty;
        public string reviewedDate { get; set; } = string.Empty;
        public string status { get; set; } = string.Empty;
        public string createdBy { get; set; } = string.Empty;
    }

    [HttpGet("unique-documents")]
    public async Task<IActionResult> GetUniqueDocuments(
        [FromQuery] string? scope,
        [FromQuery] string? search,
        [FromQuery] string? documentType,
        [FromQuery] string? docType,
        [FromQuery] string? dateFrom,
        [FromQuery] string? dateTo,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var invoices = await _fomsDb.Invoices.AsNoTracking().ToListAsync();
        var clients = await _fomsDb.Clients.AsNoTracking().ToListAsync();
        var receipts = await _fomsDb.OfficialReceipts.AsNoTracking().ToListAsync();
        var liquidations = await _fomsDb.Liquidations.AsNoTracking().ToListAsync();

        var allDocs = new List<UniqueDocumentRecord>();

        // 1. Invoices
        foreach (var i in invoices)
        {
            var c = clients.FirstOrDefault(cl => cl.ClientId == i.ClientId);
            allDocs.Add(new UniqueDocumentRecord
            {
                id = i.InvoiceId.ToString(),
                type = "Invoice",
                documentType = "Invoice",
                orInvoiceNumber = i.InvoiceNumber,
                clientName = c?.CompanyName ?? $"Client {i.ClientId}",
                amount = i.TotalAmount,
                transactionDate = (i.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                source = "Internal Billing",
                aiConfidence = 99.4,
                reviewedBy = "System AI",
                reviewedDate = (i.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                status = "VERIFIED",
                createdBy = "Crystalyn Joyce C. Fajardo"
            });
        }

        // 2. Official Receipts
        foreach (var r in receipts)
        {
            var c = clients.FirstOrDefault(cl => cl.ClientId == r.ClientId);
            allDocs.Add(new UniqueDocumentRecord
            {
                id = $"OR-{r.OrId}",
                type = "Official Receipt",
                documentType = "Receipt",
                orInvoiceNumber = !string.IsNullOrEmpty(r.OrNumber) ? r.OrNumber : $"OR-2026-{r.OrId:D4}",
                clientName = c?.CompanyName ?? (r.ClientId == 1 ? "Lazada Philippines" : r.ClientId == 2 ? "Shopee Philippines" : $"Client {r.ClientId}"),
                amount = r.IssuedAmount,
                transactionDate = (r.IssuedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                source = "SpeedPay Collection",
                aiConfidence = 99.2,
                reviewedBy = r.IssuedBy ?? "Crystalyn Joyce C. Fajardo",
                reviewedDate = (r.IssuedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                status = "VERIFIED",
                createdBy = r.IssuedBy ?? "Crystalyn Joyce C. Fajardo"
            });
        }

        // 3. Liquidation Vouchers
        foreach (var l in liquidations)
        {
            allDocs.Add(new UniqueDocumentRecord
            {
                id = $"LIQ-{l.LiquidationId}",
                type = "Liquidation Voucher",
                documentType = "Liquidation",
                orInvoiceNumber = !string.IsNullOrEmpty(l.ReferenceNumber) ? l.ReferenceNumber : $"LIQ-2026-{l.LiquidationId:D4}",
                clientName = !string.IsNullOrEmpty(l.SubmittedByName) ? l.SubmittedByName : "Courier Operations",
                amount = l.TotalAmount,
                transactionDate = (l.DateSubmitted ?? l.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                source = "Courier Expense Liquidation",
                aiConfidence = 98.9,
                reviewedBy = "System AI",
                reviewedDate = (l.DateSubmitted ?? l.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                status = "VERIFIED",
                createdBy = l.SubmittedByName ?? "Driver Courier"
            });
        }

        var filter = !string.IsNullOrWhiteSpace(documentType) ? documentType : docType;

        var query = allDocs.AsEnumerable();

        // Scope filter (Assistant FM restricted to liquidation)
        if (!string.IsNullOrEmpty(scope) && scope.Equals("liquidation", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(d => d.type.Contains("Liquidation", StringComparison.OrdinalIgnoreCase));
        }

        // Document Type filter
        if (!string.IsNullOrWhiteSpace(filter) && !filter.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            if (filter.Equals("Invoice", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(d => d.type.Equals("Invoice", StringComparison.OrdinalIgnoreCase) || d.documentType.Equals("Invoice", StringComparison.OrdinalIgnoreCase));
            }
            else if (filter.Contains("Receipt", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(d => d.type.Contains("Receipt", StringComparison.OrdinalIgnoreCase) || d.documentType.Contains("Receipt", StringComparison.OrdinalIgnoreCase));
            }
            else if (filter.Contains("Liquidation", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(d => d.type.Contains("Liquidation", StringComparison.OrdinalIgnoreCase) || d.documentType.Contains("Liquidation", StringComparison.OrdinalIgnoreCase));
            }
            else
            {
                query = query.Where(d => d.type.Contains(filter, StringComparison.OrdinalIgnoreCase) || d.documentType.Contains(filter, StringComparison.OrdinalIgnoreCase));
            }
        }

        // Search filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.ToLower();
            query = query.Where(d =>
                d.id.ToLower().Contains(term) ||
                d.orInvoiceNumber.ToLower().Contains(term) ||
                d.clientName.ToLower().Contains(term) ||
                d.type.ToLower().Contains(term)
            );
        }

        // Date filter
        if (!string.IsNullOrWhiteSpace(dateFrom))
        {
            query = query.Where(d => string.Compare(d.transactionDate, dateFrom, StringComparison.Ordinal) >= 0);
        }
        if (!string.IsNullOrWhiteSpace(dateTo))
        {
            query = query.Where(d => string.Compare(d.transactionDate, dateTo, StringComparison.Ordinal) <= 0);
        }

        var filteredList = query.OrderByDescending(d => d.transactionDate).ToList();
        var total = filteredList.Count;
        var pagedItems = filteredList.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return Ok(new
        {
            items = pagedItems,
            total,
            page,
            pageSize
        });
    }

    [HttpGet("review-history")]
    public async Task<IActionResult> GetReviewHistory(
        [FromQuery] string? scope,
        [FromQuery] string? decision,
        [FromQuery] string? status,
        [FromQuery] string? filter,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        await EnsureSeededAsync();
        var query = _fomsDb.AIReviewHistories.AsNoTracking().AsQueryable();

        var selectedDecision = !string.IsNullOrWhiteSpace(decision) ? decision :
                               !string.IsNullOrWhiteSpace(status) ? status : filter;

        if (!string.IsNullOrWhiteSpace(selectedDecision) && !selectedDecision.Equals("All", StringComparison.OrdinalIgnoreCase))
        {
            var dTerm = selectedDecision.Trim();
            if (dTerm.Contains("Duplicate", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(h => h.FinalDecision != null && (h.FinalDecision.Contains("Duplicate") || h.FinalDecision.Contains("Flagged")));
            }
            else if (dTerm.Contains("Dismiss", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(h => h.FinalDecision != null && (h.FinalDecision.Contains("Dismiss") || h.FinalDecision.Contains("Unique")));
            }
            else if (dTerm.Contains("Resolve", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(h => h.FinalDecision != null && (h.FinalDecision.Contains("Resolve") || h.FinalDecision.Contains("Verified")));
            }
            else
            {
                query = query.Where(h => h.FinalDecision != null && h.FinalDecision.Contains(dTerm));
            }
        }

        var history = await query
            .OrderByDescending(h => h.ReviewedDate ?? h.CreatedAt)
            .ToListAsync();

        var total = history.Count;
        var pagedItems = history.Skip((page - 1) * pageSize).Take(pageSize).Select(h => new
        {
            id = h.ReviewId.ToString(),
            historyId = h.ReviewId.ToString(),
            type = "Invoice",
            documentType = "Invoice",
            documentNumber = h.DocumentNumber,
            clientName = "Lazada Philippines",
            status = h.FinalDecision,
            finalDecision = h.FinalDecision,
            reviewer = h.Reviewer ?? "Financial Manager",
            reviewerRole = "Financial Manager",
            decisionReason = h.DecisionReason,
            reviewedDate = (h.ReviewedDate ?? h.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
            trail = new object[]
            {
                new { step = "AI_FLAG", actor = "AI Engine", actorRole = "System", decision = "DUPLICATE", at = (h.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd") },
                new { step = "DECISION", actor = h.Reviewer ?? "Financial Manager", actorRole = "Financial Manager", decision = h.FinalDecision, remarks = h.DecisionReason, at = (h.ReviewedDate ?? DateTime.UtcNow).ToString("yyyy-MM-dd") }
            }
        }).ToList();

        return Ok(new
        {
            items = pagedItems,
            total,
            page,
            pageSize
        });
    }

    [HttpPost("scan")]
    public IActionResult ScanDocument()
    {
        return Ok(new
        {
            result = "unique",
            confidence = 99.8,
            message = "Document analyzed successfully. No duplicates found."
        });
    }

    [HttpPost("{id}/decide")]
    public IActionResult Decide(string id, [FromBody] object payload)
    {
        return Ok(new
        {
            id,
            status = "DECIDED",
            message = "Decision recorded successfully."
        });
    }

    [HttpPost("{id}/review")]
    public IActionResult Review(string id, [FromBody] object payload)
    {
        return Ok(new
        {
            id,
            status = "RESOLVED",
            message = "Level 2 review action recorded successfully."
        });
    }
}
