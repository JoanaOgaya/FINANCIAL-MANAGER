using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/ai/outputs")]
public class AiOutputsController : ApiControllerBase
{
    [HttpGet]
    public IActionResult GetOutputs([FromQuery] int page = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        return Ok(new
        {
            items = new List<object>(),
            total = 0,
            page,
            pageSize
        });
    }

    [HttpGet("{id}")]
    public IActionResult GetById(string id)
    {
        return NotFound(new { message = $"AI output record {id} not found." });
    }
}
