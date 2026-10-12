using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FOMS.Domain.Entities.SqlServer;
using FOMS.Infrastructure.Persistence;

namespace FOMS.Api.Controllers;

public class LiquidationDto
{
    public string? Id { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? SubmittedByName { get; set; }
    public string? SubmittedBy { get; set; }
    public decimal? TotalAmount { get; set; }
    public decimal? Amount { get; set; }
    public decimal? LeftoverCash { get; set; }
    public decimal? ReimbursementAmount { get; set; }
    public string? Status { get; set; }
    public string? Purpose { get; set; }
    public string? Notes { get; set; }
}

[Authorize]
[ApiController]
[Route("api/liquidations")]
[Route("api/v1/liquidations")]
[Route("liquidations")]
public class LiquidationsController : ControllerBase
{
    private readonly FomsDbContext _fomsDb;

    public LiquidationsController(FomsDbContext fomsDb)
    {
        _fomsDb = fomsDb;
    }

    private async Task EnsureSeededAsync()
    {
        try
        {
            if (!await _fomsDb.Liquidations.AnyAsync())
            {
                var samples = new List<Liquidation>
                {
                    new() { ReferenceNumber = "LIQ-2026-0001", SubmittedByName = "Juan Dela Cruz", TotalAmount = 4500m, LeftoverCash = 500m, ReimbursementAmount = 0m, Status = "Pending Validation", DateSubmitted = DateTime.UtcNow.AddDays(-1), CreatedAt = DateTime.UtcNow.AddDays(-1) },
                    new() { ReferenceNumber = "LIQ-2026-0002", SubmittedByName = "Pedro Santos", TotalAmount = 3200m, LeftoverCash = 0m, ReimbursementAmount = 200m, Status = "Pending Validation", DateSubmitted = DateTime.UtcNow.AddDays(-2), CreatedAt = DateTime.UtcNow.AddDays(-2) },
                    new() { ReferenceNumber = "LIQ-2026-0003", SubmittedByName = "Carlos Reyes", TotalAmount = 6100m, LeftoverCash = 900m, ReimbursementAmount = 0m, Status = "Validated", DateSubmitted = DateTime.UtcNow.AddDays(-4), CreatedAt = DateTime.UtcNow.AddDays(-4) },
                    new() { ReferenceNumber = "LIQ-2026-0004", SubmittedByName = "Miguel Gomez", TotalAmount = 1850m, LeftoverCash = 0m, ReimbursementAmount = 150m, Status = "Returned", DateSubmitted = DateTime.UtcNow.AddDays(-5), CreatedAt = DateTime.UtcNow.AddDays(-5) }
                };
                _fomsDb.Liquidations.AddRange(samples);
                await _fomsDb.SaveChangesAsync();
            }
            else if (!await _fomsDb.Liquidations.AnyAsync(l => l.Status == "Returned"))
            {
                _fomsDb.Liquidations.Add(new Liquidation
                {
                    ReferenceNumber = "LIQ-2026-0004",
                    SubmittedByName = "Miguel Gomez",
                    TotalAmount = 1850m,
                    LeftoverCash = 0m,
                    ReimbursementAmount = 150m,
                    Status = "Returned",
                    DateSubmitted = DateTime.UtcNow.AddDays(-5),
                    CreatedAt = DateTime.UtcNow.AddDays(-5)
                });
                await _fomsDb.SaveChangesAsync();
            }
        }
        catch { }
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        await EnsureSeededAsync();
        var query = _fomsDb.Liquidations.AsNoTracking();
        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(l => l.DateSubmitted ?? l.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new
            {
                id = l.LiquidationId.ToString(),
                liquidationId = l.LiquidationId,
                reference = l.ReferenceNumber ?? $"LIQ-{l.LiquidationId:D4}",
                referenceNumber = l.ReferenceNumber ?? $"LIQ-{l.LiquidationId:D4}",
                submittedBy = l.SubmittedByName ?? $"Employee {l.SubmittedBy}",
                submittedByName = l.SubmittedByName ?? $"Employee {l.SubmittedBy}",
                submittedAt = (l.DateSubmitted ?? l.CreatedAt ?? DateTime.UtcNow).ToString("o"),
                dateSubmitted = (l.DateSubmitted ?? l.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
                amount = l.TotalAmount,
                totalAmount = l.TotalAmount,
                status = l.Status ?? "Pending Validation",
                leftoverCash = l.LeftoverCash ?? 0m,
                reimbursementAmount = l.ReimbursementAmount ?? 0m
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            total,
            page,
            pageSize
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var item = await _fomsDb.Liquidations.AsNoTracking().FirstOrDefaultAsync(l => l.LiquidationId == id);
        if (item == null) return NotFound(new { message = "Liquidation not found" });

        var lineItems = await _fomsDb.LiquidationLineItems.Where(li => li.LiquidationId == id).AsNoTracking().ToListAsync();
        var docs = await _fomsDb.LiquidationDocuments.Where(d => d.LiquidationId == id).AsNoTracking().ToListAsync();

        return Ok(new
        {
            id = item.LiquidationId.ToString(),
            item.LiquidationId,
            referenceNumber = item.ReferenceNumber ?? $"LIQ-{item.LiquidationId:D4}",
            submittedBy = item.SubmittedByName ?? $"Employee {item.SubmittedBy}",
            submittedByName = item.SubmittedByName ?? $"Employee {item.SubmittedBy}",
            amount = item.TotalAmount,
            totalAmount = item.TotalAmount,
            leftoverCash = item.LeftoverCash ?? 0m,
            reimbursementAmount = item.ReimbursementAmount ?? 0m,
            status = item.Status ?? "Pending Validation",
            dateSubmitted = (item.DateSubmitted ?? item.CreatedAt ?? DateTime.UtcNow).ToString("yyyy-MM-dd"),
            lineItems,
            documents = docs
        });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] LiquidationDto dto)
    {
        var item = new Liquidation
        {
            ReferenceNumber = dto.ReferenceNumber ?? $"LIQ-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpper()}",
            SubmittedByName = dto.SubmittedByName ?? dto.SubmittedBy ?? "Employee",
            TotalAmount = dto.TotalAmount ?? dto.Amount ?? 0m,
            LeftoverCash = dto.LeftoverCash ?? 0m,
            ReimbursementAmount = dto.ReimbursementAmount ?? 0m,
            Status = dto.Status ?? "Pending Validation",
            CreatedAt = DateTime.UtcNow,
            DateSubmitted = DateTime.UtcNow
        };

        _fomsDb.Liquidations.Add(item);
        await _fomsDb.SaveChangesAsync();

        _fomsDb.AuditLogs.Add(new AuditLog
        {
            action = "CREATE_LIQUIDATION",
            module = "Liquidations",
            role = "Accountant",
            affected_record_id = item.LiquidationId,
            remarks = $"Submitted liquidation {item.ReferenceNumber} for {item.SubmittedByName}: ₱{item.TotalAmount:N2}",
            created_at = DateTime.UtcNow
        });
        await _fomsDb.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = item.LiquidationId }, item);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] LiquidationDto dto)
    {
        var item = await _fomsDb.Liquidations.FindAsync(id);
        if (item == null) return NotFound(new { message = "Liquidation not found" });

        if (!string.IsNullOrEmpty(dto.Status))
            item.Status = dto.Status;

        if (dto.TotalAmount.HasValue || dto.Amount.HasValue)
            item.TotalAmount = dto.TotalAmount ?? dto.Amount!.Value;

        if (dto.LeftoverCash.HasValue)
            item.LeftoverCash = dto.LeftoverCash.Value;

        if (dto.ReimbursementAmount.HasValue)
            item.ReimbursementAmount = dto.ReimbursementAmount.Value;

        await _fomsDb.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPost("{id}/{actionName}")]
    public async Task<IActionResult> Act(int id, string actionName, [FromBody] LiquidationDto? dto)
    {
        var item = await _fomsDb.Liquidations.FindAsync(id);
        if (item == null) return NotFound(new { message = "Liquidation not found" });

        item.Status = actionName switch
        {
            "approve" or "validate" => "Validated",
            "reject" => "Rejected",
            "return" => "Returned",
            "submit" => "Pending Validation",
            _ => item.Status
        };
        item.ValidatedAt = DateTime.UtcNow;
        item.ValidatedBy = 1;
        await _fomsDb.SaveChangesAsync();

        _fomsDb.AuditLogs.Add(new AuditLog
        {
            action = $"LIQUIDATION_{actionName.ToUpper()}",
            module = "Liquidations",
            role = "Head Accountant",
            affected_record_id = item.LiquidationId,
            remarks = $"Liquidation {item.ReferenceNumber} action {actionName} -> {item.Status}. Remarks: {dto?.Notes ?? "N/A"}",
            created_at = DateTime.UtcNow
        });
        await _fomsDb.SaveChangesAsync();

        return Ok(item);
    }
}
