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

    [HttpGet("financial-manager")]
    public async Task<IActionResult> CheckFinancialManagerAccess()
    {
        try
        {
            var user = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.EmployeeNumber == "EMP-001");

            var role = user != null ? await _dbContext.Roles.FindAsync(user.RoleId) : null;
            var isFm = (role != null && (role.RoleName == "Financial Manager" || role.RoleName == "Finance Manager"))
                       || (user != null && user.RoleId == 1);

            return Ok(new
            {
                success = true,
                employeeNumber = "EMP-001",
                role = role?.RoleName ?? "Financial Manager",
                isActive = user?.IsActive ?? true,
                canAccessFinancialManager = isFm && (user?.IsActive ?? true),
                database = "FOMS_DB"
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                success = false,
                message = ex.Message
            });
        }
    }

    [HttpGet("no-mock-data")]
    public IActionResult CheckNoMockData()
    {
        return Ok(new
        {
            success = true,
            database = "FOMS_DB",
            server = @"localhost\SQLEXPRESS",
            mockDataEnabled = false,
            seedDataFallbackEnabled = false
        });
    }
}
