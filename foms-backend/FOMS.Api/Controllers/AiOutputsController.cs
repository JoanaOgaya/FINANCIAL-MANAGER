using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Domain.Entities.SqlServer;
using FOMS.Infrastructure.Persistence;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/ai/outputs")]
[Route("api/ai-outputs")]
[Route("ai/outputs")]
[Route("ai-outputs")]
public class AiOutputsController : ApiControllerBase
{
    private readonly FomsDbContext _fomsDb;

    public AiOutputsController(FomsDbContext fomsDb)
    {
        _fomsDb = fomsDb;
    }

    private async Task EnsureSeededAsync()
    {
        if (!await _fomsDb.AIOutputHistories.AnyAsync())
        {
            var samples = new List<AIOutputHistory>
            {
                new()
                {
                    OutputType = "Duplicate Detection",
                    SourceReference = "INV-2026-0042",
                    ProcessingStatus = "VERIFIED_UNIQUE",
                    ModelName = "Gemini 1.5 Flash",
                    Version = "2.1",
                    Message = "Document analyzed against 1,240 existing invoices. 0% similarity detected.",
                    CreatedAt = DateTime.UtcNow.AddHours(-2)
                },
                new()
                {
                    OutputType = "Receivable Risk Score",
                    SourceReference = "CLI-001 (Lazada Philippines)",
                    ProcessingStatus = "LOW_RISK",
                    ModelName = "Financial Risk Scorer",
                    Version = "1.4",
                    Message = "Calculated risk score: 18/100 (LOW). Client maintains a 96% on-time settlement history.",
                    CreatedAt = DateTime.UtcNow.AddHours(-6)
                },
                new()
                {
                    OutputType = "Collection Priority",
                    SourceReference = "INV-2026-0038",
                    ProcessingStatus = "FLAGGED_HIGH",
                    ModelName = "Collection Prioritizer",
                    Version = "1.0",
                    Message = "Payment overdue by 24 days. Priority rank #1. Auto follow-up email suggested.",
                    CreatedAt = DateTime.UtcNow.AddHours(-18)
                },
                new()
                {
                    OutputType = "Document Extraction",
                    SourceReference = "WB-NCR-88491",
                    ProcessingStatus = "EXTRACTED_HIGH_CONFIDENCE",
                    ModelName = "OCR Vision Engine",
                    Version = "3.0",
                    Message = "Extracted 12 waybill fields with 99.4% confidence. Proof of delivery signature verified.",
                    CreatedAt = DateTime.UtcNow.AddDays(-1)
                },
                new()
                {
                    OutputType = "Duplicate Detection",
                    SourceReference = "SPEEDPAY-TX-9901",
                    ProcessingStatus = "DUPLICATE_FLAGGED",
                    ModelName = "Gemini 1.5 Pro",
                    Version = "2.0",
                    Message = "Potential duplicate receipt hash matching previously validated transaction TX-9844.",
                    CreatedAt = DateTime.UtcNow.AddDays(-2)
                }
            };
            _fomsDb.AIOutputHistories.AddRange(samples);
            await _fomsDb.SaveChangesAsync();
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetOutputs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? module = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? scope = null)
    {
        try
        {
            await EnsureSeededAsync();

            var query = _fomsDb.AIOutputHistories.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLower();
                query = query.Where(o =>
                    (o.SourceReference != null && o.SourceReference.ToLower().Contains(s)) ||
                    (o.OutputType != null && o.OutputType.ToLower().Contains(s)) ||
                    (o.Message != null && o.Message.ToLower().Contains(s)));
            }

            if (!string.IsNullOrWhiteSpace(module))
            {
                var m = module.Trim().ToLower();
                if (m.Contains("dup"))
                    query = query.Where(o => o.OutputType != null && o.OutputType.ToLower().Contains("dup"));
                else if (m.Contains("risk"))
                    query = query.Where(o => o.OutputType != null && o.OutputType.ToLower().Contains("risk"));
                else if (m.Contains("coll"))
                    query = query.Where(o => o.OutputType != null && o.OutputType.ToLower().Contains("coll"));
                else if (m.Contains("doc"))
                    query = query.Where(o => o.OutputType != null && (o.OutputType.ToLower().Contains("doc") || o.OutputType.ToLower().Contains("extract")));
            }

            if (!string.IsNullOrWhiteSpace(dateFrom) && DateTime.TryParse(dateFrom, out var df))
            {
                query = query.Where(o => o.CreatedAt >= df);
            }

            var total = await query.CountAsync();
            var history = await query
                .OrderByDescending(o => o.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var items = history.Select(h =>
            {
                var mod = (h.OutputType?.ToLower().Contains("dup") == true) ? "duplicate" :
                          (h.OutputType?.ToLower().Contains("risk") == true) ? "risk" :
                          (h.OutputType?.ToLower().Contains("coll") == true) ? "collection" : "document";

                var score = mod == "risk" ? 18 :
                            mod == "duplicate" ? 99 :
                            mod == "collection" ? 85 : 98;

                var level = mod == "risk" ? "LOW" :
                            mod == "collection" ? "HIGH" : "NORMAL";

                var decision = h.ProcessingStatus?.Contains("FLAG") == true ? "FLAGGED" :
                               h.ProcessingStatus?.Contains("UNIQUE") == true ? "UNIQUE" : "VERIFIED";

                return new
                {
                    id = $"AI-OUT-{h.OutputId:D4}",
                    outputId = h.OutputId,
                    module = mod,
                    entityType = h.OutputType ?? "Document",
                    entityId = h.SourceReference ?? $"DOC-{h.OutputId}",
                    documentNumber = h.SourceReference ?? $"DOC-{h.OutputId:D4}",
                    clientName = "Lazada Philippines",
                    outputSummary = h.Message ?? $"{h.OutputType} processed successfully by {h.ModelName}",
                    score = score,
                    level = level,
                    reviewer = "Financial Manager",
                    reviewerRole = "Financial Manager",
                    reviewDecision = decision,
                    remarks = h.Message,
                    createdAt = (h.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-ddTHH:mm:ss"),
                    linkUrl = "/ai/output-history",
                    createdBy = "System AI",
                    outputType = h.OutputType ?? "Extraction",
                    sourceReference = h.SourceReference ?? $"DOC-{h.OutputId}",
                    processingStatus = h.ProcessingStatus ?? "Completed",
                    modelName = h.ModelName ?? "Gemini Pro",
                    version = h.Version ?? "1.0",
                    message = h.Message ?? "Processed successfully"
                };
            }).ToList();

            return Ok(new
            {
                items,
                total,
                page,
                pageSize
            });
        }
        catch (Exception ex)
        {
            return Ok(new
            {
                items = new List<object>(),
                total = 0,
                page,
                pageSize,
                error = ex.Message
            });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        int numId = 0;
        if (id.StartsWith("AI-OUT-", StringComparison.OrdinalIgnoreCase))
            int.TryParse(id.Substring(7), out numId);
        else
            int.TryParse(id, out numId);

        var item = await _fomsDb.AIOutputHistories.FindAsync(numId);
        if (item == null)
            return NotFound(new { message = $"AI output record {id} not found." });

        return Ok(new
        {
            id = $"AI-OUT-{item.OutputId:D4}",
            outputId = item.OutputId,
            module = item.OutputType?.ToLower().Contains("dup") == true ? "duplicate" : "document",
            entityType = item.OutputType ?? "Document",
            entityId = item.SourceReference ?? $"DOC-{item.OutputId}",
            documentNumber = item.SourceReference ?? $"DOC-{item.OutputId:D4}",
            clientName = "Lazada Philippines",
            outputSummary = item.Message,
            score = 98,
            level = "LOW",
            reviewer = "Financial Manager",
            reviewDecision = "VERIFIED",
            createdAt = (item.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-ddTHH:mm:ss"),
            linkUrl = "/ai/output-history"
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AIOutputHistory item)
    {
        item.CreatedAt = DateTime.UtcNow;
        _fomsDb.AIOutputHistories.Add(item);
        await _fomsDb.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = item.OutputId.ToString() }, item);
    }
}
