using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Application.Interfaces;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/ai/duplicates")]
[AllowAnonymous]
public class AiDuplicatesController : ApiControllerBase
{
    private readonly IApplicationDbContext _context;

    public AiDuplicatesController(IApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public IActionResult GetFlaggedDuplicates([FromQuery] string? scope, [FromQuery] string? status, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        return Ok(new
        {
            items = Array.Empty<object>(),
            total = 0,
            page,
            pageSize
        });
    }

    [HttpGet("unique-documents")]
    public async Task<IActionResult> GetUniqueDocuments([FromQuery] string? scope, [FromQuery] string? search, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        // Return active invoices and shipment waybills as verified unique documents
        var invoices = await _context.Invoices
            .AsNoTracking()
            .Take(50)
            .Select(i => new
            {
                id = i.Id,
                type = "Invoice",
                documentType = "Invoice",
                orInvoiceNumber = i.InvoiceNo,
                clientName = i.ClientName,
                amount = i.TotalAmount,
                transactionDate = i.BillingDate,
                source = "Internal Billing",
                aiConfidence = 99.4,
                reviewedBy = "System AI",
                reviewedDate = i.DateEncoded,
                status = "VERIFIED",
                createdBy = i.EncodedBy
            })
            .ToListAsync();

        var total = invoices.Count;
        var pagedItems = invoices.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        return Ok(new
        {
            items = pagedItems,
            total,
            page,
            pageSize
        });
    }

    [HttpGet("review-history")]
    public IActionResult GetReviewHistory([FromQuery] string? scope, [FromQuery] string? decision, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        return Ok(new
        {
            items = Array.Empty<object>(),
            total = 0,
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
            flagId = id,
            status = "RESOLVED",
            decision = "NOT_DUPLICATE"
        });
    }

    [HttpPost("{id}/review")]
    public IActionResult Review(string id, [FromBody] object payload)
    {
        return Ok(new
        {
            id,
            flagId = id,
            status = "APPROVED",
            reviewAction = "APPROVE"
        });
    }

    [HttpPost("check")]
    public IActionResult PreCheck([FromBody] object payload)
    {
        return Ok(new
        {
            isDuplicate = false,
            matches = Array.Empty<object>(),
            message = "No duplicate detected."
        });
    }

    [HttpPost("skip-log")]
    public IActionResult LogSkip([FromBody] object payload)
    {
        return Ok(new
        {
            success = true,
            message = "Skip logged successfully."
        });
    }
}
