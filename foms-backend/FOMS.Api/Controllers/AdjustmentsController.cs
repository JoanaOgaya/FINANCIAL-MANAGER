using System.Threading.Tasks;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using FOMS.Application.Features;

namespace FOMS.Api.Controllers;

[Route("api/adjustments")]
[Route("api/v1/adjustments")]
[Route("adjustments")]
public class AdjustmentsController : ApiControllerBase
{
    /// <summary>
    /// GET /api/v1/adjustments â€” Returns all payment adjustments, newest first.
    /// Accessible by Accountant and Bookkeeper.
    /// </summary>
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetAdjustments()
    {
        var list = await Mediator.Send(new AdjustmentFeatures.GetAdjustmentsQuery());
        var mapped = list.Select(a => new
        {
            id = a.Id,
            type = a.AdjustmentType == "Credit" ? "Credit Memo" : "Adjustment",
            amount = a.Amount,
            reason = a.Reason,
            referenceNo = a.Id,
            status = a.Status == "Pending" ? "Pending Approval" : a.Status,
            affectedRecordId = a.InvoiceNo,
            clientId = "CA-001",
            createdAt = !string.IsNullOrEmpty(a.DateRequested) ? a.DateRequested : DateTime.UtcNow.ToString("yyyy-MM-dd"),
            createdBy = !string.IsNullOrEmpty(a.AdjustedBy) ? a.AdjustedBy : "Bookkeeper",
            remarks = a.Reason,
            a.InvoiceNo,
            a.AdjustmentType,
            a.AdjustedBy,
            a.DateRequested,
            a.ApprovedBy,
            a.DateApproved
        }).ToList();
        return Ok(mapped);
    }

    /// <summary>
    /// POST /api/v1/adjustments â€” Create a new pending adjustment request.
    /// Bookkeepers submit; Accountants also allowed to create.
    /// </summary>
    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] AdjustmentFeatures.CreateAdjustmentCommand command)
    {
        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";
        var role = User.FindFirst(ClaimTypes.Role)?.Value ?? string.Empty;

        // If Bookkeeper, override AdjustedBy with the current user
        // If Accountant creating the adjustment, they are also the AdjustedBy
        var updatedCommand = command with { AdjustedBy = user };

        try
        {
            var result = await Mediator.Send(updatedCommand);
            if (result == null)
                return NotFound(new { message = "Invoice not found. Please check the invoice number." });

            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// PUT /api/v1/adjustments/{id}/approve â€” Accountant approves an adjustment.
    /// Applies the balance change to the invoice.
    /// </summary>
    [Authorize]
    [HttpPut("{id}/approve")]
    [HttpPost("{id}/approve")]
    public async Task<IActionResult> Approve(string id)
    {
        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";
        var result = await Mediator.Send(new AdjustmentFeatures.ApproveAdjustmentCommand(id, user));
        if (result == null)
            return NotFound(new { message = "Adjustment not found or is no longer pending." });

        return Ok(result);
    }

    /// <summary>
    /// PUT or POST /api/v1/adjustments/{id}/reject — Accountant rejects a pending adjustment.
    /// No balance change is applied.
    /// </summary>
    [Authorize]
    [HttpPut("{id}/reject")]
    [HttpPost("{id}/reject")]
    public async Task<IActionResult> Reject(string id)
    {
        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";
        var result = await Mediator.Send(new AdjustmentFeatures.RejectAdjustmentCommand(id, user));
        if (result == null)
            return NotFound(new { message = "Adjustment not found or is no longer pending." });

        return Ok(result);
    }

    /// <summary>
    /// DELETE /api/v1/adjustments/{id} â€” Delete a Pending adjustment (Bookkeeper or Accountant).
    /// Cannot delete already Approved or Rejected adjustments.
    /// </summary>
    [Authorize]
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var user = User.FindFirst("name")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value ?? "Unknown User";
        var result = await Mediator.Send(new AdjustmentFeatures.DeleteAdjustmentCommand(id, user));
        if (!result)
            return NotFound(new { message = "Adjustment not found or has already been processed (Approved/Rejected)." });

        return Ok(new { success = true });
    }
}
