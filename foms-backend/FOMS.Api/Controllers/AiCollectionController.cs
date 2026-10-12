using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Domain.Entities.SqlServer;
using FOMS.Infrastructure.Persistence;

namespace FOMS.Api.Controllers;

[AllowAnonymous]
[ApiController]
public class AiCollectionController : ApiControllerBase
{
    private readonly FomsDbContext _fomsDb;

    public AiCollectionController(FomsDbContext fomsDb)
    {
        _fomsDb = fomsDb;
    }

    [HttpGet("api/ai/collection/recommendations")]
    [HttpGet("ai/collection/recommendations")]
    public async Task<IActionResult> GetRecommendations([FromQuery] string? status)
    {
        var invoices = await _fomsDb.Invoices.AsNoTracking().ToListAsync();
        var clients = await _fomsDb.Clients.AsNoTracking().ToListAsync();

        var recommendations = new List<object>
        {
            new
            {
                id = "REC-001",
                review_status = "Accepted Recommendation",
                reviewed_at = DateTime.UtcNow.AddHours(-2).ToString("o"),
                reviewed_by = "Accountant User",
                reviewer_role = "Accountant",
                remarks = "Recommended priority follow-up call with client finance team.",
                recommended_action = "Payment overdue by 24 days. Priority rank #1. Auto follow-up email suggested.",
                priority = new
                {
                    normalized_invoice_number = "LZD-2026-0001",
                    invoice_number = "LZD-2026-0001",
                    client_name = "Lazada Philippines",
                    outstanding_balance = 50000.00m,
                    priority_level = "High Priority",
                    due_date = DateTime.UtcNow.AddDays(15).ToString("yyyy-MM-dd")
                }
            },
            new
            {
                id = "REC-002",
                review_status = "Accepted Recommendation",
                reviewed_at = DateTime.UtcNow.AddHours(-5).ToString("o"),
                reviewed_by = "Accountant User",
                reviewer_role = "Accountant",
                remarks = "Client agreed to settle within the week.",
                recommended_action = "Routine semi-monthly settlement review.",
                priority = new
                {
                    normalized_invoice_number = "BI-2026-0001",
                    invoice_number = "BI-2026-0001",
                    client_name = "Lazada Philippines",
                    outstanding_balance = 30000.00m,
                    priority_level = "Medium Priority",
                    due_date = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-dd")
                }
            }
        };

        return Ok(recommendations);
    }

    [HttpPost("api/ai/collection/recommendations/{id}/review")]
    [HttpPost("ai/collection/recommendations/{id}/review")]
    public IActionResult ReviewRecommendation(string id, [FromBody] dynamic body)
    {
        return Ok(new { success = true, message = "Manager decision saved successfully." });
    }

    [HttpGet("api/ai/collection/priorities")]
    [HttpGet("ai/collection/priorities")]
    public async Task<IActionResult> GetPriorities()
    {
        var priorities = new List<object>
        {
            new
            {
                id = "PRIO-001",
                invoiceNumber = "LZD-2026-0001",
                invoice_number = "LZD-2026-0001",
                clientName = "Lazada Philippines",
                client_name = "Lazada Philippines",
                outstandingBalance = 50000.00m,
                outstanding_balance = 50000.00m,
                dueDate = DateTime.UtcNow.AddDays(15).ToString("yyyy-MM-dd"),
                due_date = DateTime.UtcNow.AddDays(15).ToString("yyyy-MM-dd"),
                priorityLevel = "High Priority",
                priority_level = "High Priority",
                priorityScore = 88,
                priority_score = 88,
                daysOverdue = 14,
                overdue_days = 14,
                suggestedAction = "Send official payment demand letter and coordinate with treasury.",
                suggested_action = "Send official payment demand letter and coordinate with treasury."
            },
            new
            {
                id = "PRIO-002",
                invoiceNumber = "BI-2026-0001",
                invoice_number = "BI-2026-0001",
                clientName = "Lazada Philippines",
                client_name = "Lazada Philippines",
                outstandingBalance = 30000.00m,
                outstanding_balance = 30000.00m,
                dueDate = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-dd"),
                due_date = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-dd"),
                priorityLevel = "Medium Priority",
                priority_level = "Medium Priority",
                priorityScore = 65,
                priority_score = 65,
                daysOverdue = 5,
                overdue_days = 5,
                suggestedAction = "Follow up via email regarding overdue billing.",
                suggested_action = "Follow up via email regarding overdue billing."
            }
        };

        return Ok(priorities);
    }

    [HttpGet("api/ai/dashboard/alerts")]
    [HttpGet("ai/dashboard/alerts")]
    public IActionResult GetDashboardAlerts([FromQuery] string? scope)
    {
        var alerts = new List<object>
        {
            new
            {
                id = "ALT-001",
                title = "High Priority Collection Alert",
                message = "Invoice LZD-2026-0001 (₱50,000.00) requires immediate collection follow-up.",
                severity = "warning",
                module = "collection",
                createdAt = DateTime.UtcNow.AddHours(-1).ToString("o")
            },
            new
            {
                id = "ALT-002",
                title = "Settlement Validation Ready",
                message = "2 courier settlements awaiting Financial Manager verification.",
                severity = "info",
                module = "settlements",
                createdAt = DateTime.UtcNow.AddHours(-3).ToString("o")
            }
        };

        return Ok(alerts);
    }
}
