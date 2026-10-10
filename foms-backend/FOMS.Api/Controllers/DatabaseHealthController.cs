using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Infrastructure.Persistence;

namespace FOMS.Api.Controllers;

[ApiController]
[Route("api/health")]
public class DatabaseHealthController : ControllerBase
{
    private readonly FomsDbContext _dbContext;

    public DatabaseHealthController(FomsDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("database")]
    public async Task<IActionResult> CheckDatabaseHealth()
    {
        try
        {
            var canConnect = await _dbContext.Database.CanConnectAsync();
            if (canConnect)
            {
                return Ok(new
                {
                    success = true,
                    database = "FOMS_DB",
                    provider = "Microsoft SQL Server",
                    server = @"localhost\SQLEXPRESS",
                    status = "Connected"
                });
            }
            else
            {
                return StatusCode(503, new
                {
                    success = false,
                    database = "FOMS_DB",
                    provider = "Microsoft SQL Server",
                    status = "Connection Failed",
                    message = @"Could not establish connection to localhost\SQLEXPRESS database FOMS_DB."
                });
            }
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                database = "FOMS_DB",
                provider = "Microsoft SQL Server",
                status = "Connection Failed",
                message = ex.Message
            });
        }
    }
}
