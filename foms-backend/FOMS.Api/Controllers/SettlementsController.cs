using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/settlements")]
[AllowAnonymous]
public class SettlementsController : ApiControllerBase
{
    private static readonly List<object> _settlements = new()
    {
        new
        {
            id = "STL-001",
            type = "Leftover return",
            courierName = "Speedex Courier 1",
            tripRef = "TRIP-2026-081",
            submittedAt = "2026-10-10",
            amount = 1250.00,
            discrepancy = 0.00,
            status = "Validated",
            cashAdvance = 5000.00,
            totalExpenses = 3750.00,
            envelopeNo = "ENV-1001",
            cashCounted = 1250.00,
            recordedBy = "Accountant",
            recordedAt = "2026-10-10"
        },
        new
        {
            id = "STL-002",
            type = "Reimbursement",
            courierName = "Speedex Courier 2",
            tripRef = "TRIP-2026-082",
            submittedAt = "2026-10-11",
            amount = 450.00,
            discrepancy = 0.00,
            status = "For validation",
            cashAdvance = 3000.00,
            totalExpenses = 3450.00,
            envelopeNo = "ENV-1002",
            cashCounted = 0.00,
            recordedBy = "Accountant",
            recordedAt = "2026-10-11"
        }
    };

    [HttpGet]
    public IActionResult GetSettlements([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        var total = _settlements.Count;
        var items = _settlements.Skip((page - 1) * pageSize).Take(pageSize).ToList();
        return Ok(new
        {
            items,
            total,
            page,
            pageSize
        });
    }

    [HttpGet("{id}")]
    public IActionResult GetSettlement(string id)
    {
        var item = _settlements.FirstOrDefault(s => ((dynamic)s).id == id);
        if (item == null) return NotFound(new { message = "Settlement not found" });
        return Ok(item);
    }

    [HttpPost]
    public IActionResult CreateSettlement([FromBody] object body)
    {
        return Ok(body);
    }

    [HttpPost("{id}/{action}")]
    public IActionResult ActOnSettlement(string id, string action, [FromBody] object? body)
    {
        return Ok(new { id, status = action == "approve" || action == "validate" ? "Validated" : "Rejected" });
    }
}
