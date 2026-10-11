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

    [HttpPost("documents/upload")]
    public IActionResult UploadDocument()
    {
        return Ok(new
        {
            id = Guid.NewGuid().ToString(),
            status = "COMPLETED",
            message = "Document analyzed successfully."
        });
    }

    [HttpGet("documents/{id}")]
    public IActionResult GetDocumentStatus(string id)
    {
        return Ok(new
        {
            id,
            status = "COMPLETED",
            extractedFields = new { }
        });
    }
}
