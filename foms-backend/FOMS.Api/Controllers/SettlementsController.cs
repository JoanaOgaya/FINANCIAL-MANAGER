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
    private static readonly List<object> _settlements = new();

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
