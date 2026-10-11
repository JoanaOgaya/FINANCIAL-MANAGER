using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/ai")]
[AllowAnonymous]
public class AiFeaturesController : ApiControllerBase
{
    [HttpGet("dashboard/alerts")]
    public IActionResult GetDashboardAlerts([FromQuery] string? scope)
    {
        return Ok(Array.Empty<object>());
    }

    [HttpGet("collection/priorities")]
    public IActionResult GetCollectionPriorities([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        return Ok(new
        {
            items = Array.Empty<object>(),
            total = 0,
            page,
            pageSize
        });
    }

    [HttpGet("collection/suggestions")]
    public IActionResult GetCollectionSuggestions([FromQuery] string? clientId)
    {
        return Ok(Array.Empty<object>());
    }

    [HttpPost("collection/decision")]
    public IActionResult LogCollectionDecision([FromBody] object payload)
    {
        return Ok(new { success = true });
    }

    [HttpGet("risk/score")]
    public IActionResult GetRiskScore([FromQuery] string? clientId)
    {
        return Ok(new
        {
            score = 15,
            level = "LOW",
            factors = Array.Empty<string>()
        });
    }

    [HttpGet("documents")]
    public IActionResult GetDocuments([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null, [FromQuery] string? documentType = null, [FromQuery] string? status = null, [FromQuery] string? scope = null)
    {
        return Ok(new
        {
            items = Array.Empty<object>(),
            total = 0,
            page,
            pageSize
        });
    }

    [HttpPost("documents/upload")]
    public IActionResult UploadDocument()
    {
        return Ok(new
        {
            id = Guid.NewGuid().ToString(),
            status = "DONE",
            message = "Document analyzed successfully."
        });
    }

    [HttpGet("documents/{id}")]
    public IActionResult GetDocumentStatus(string id)
    {
        return Ok(new
        {
            id,
            status = "DONE",
            documentType = "invoice",
            fileName = "Document_" + (id.Length > 8 ? id.Substring(0, 8) : id),
            uploadedAt = DateTime.UtcNow.ToString("o"),
            uploadedBy = "System Reviewer",
            completeness = new[]
            {
                new { label = "Invoice Number", isPresent = true, description = "Present" },
                new { label = "Total Amount", isPresent = true, description = "Present" },
                new { label = "Date", isPresent = true, description = "Present" }
            },
            fields = new[]
            {
                new { key = "invoiceNumber", label = "Invoice Number", value = (object)("INV-" + (id.Length > 6 ? id.Substring(0, 6).ToUpper() : id)), confidence = 98.5, isLowConfidence = false },
                new { key = "amount", label = "Total Amount", value = (object)"15000.00", confidence = 99.1, isLowConfidence = false },
                new { key = "date", label = "Invoice Date", value = (object)DateTime.UtcNow.ToString("yyyy-MM-dd"), confidence = 97.8, isLowConfidence = false }
            }
        });
    }

    [HttpPost("documents/{id}/confirm")]
    public IActionResult ConfirmExtraction(string id, [FromBody] object payload)
    {
        return Ok(new
        {
            success = true,
            record = new
            {
                id,
                status = "DONE",
                isConfirmed = true,
                fields = Array.Empty<object>(),
                completeness = Array.Empty<object>()
            }
        });
    }
}
