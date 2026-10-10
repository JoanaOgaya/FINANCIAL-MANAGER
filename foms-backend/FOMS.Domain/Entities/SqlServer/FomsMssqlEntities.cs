using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FOMS.Domain.Entities.SqlServer;

[Table("Roles")]
public class Role
{
    [Key]
    [Column("role_id")]
    public int RoleId { get; set; }

    [Column("role_name")]
    public string RoleName { get; set; } = string.Empty;

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}

[Table("Users")]
public class User
{
    [Key]
    [Column("user_id")]
    public int UserId { get; set; }

    [Column("employee_number")]
    public string? EmployeeNumber { get; set; }

    [Column("full_name")]
    public string FullName { get; set; } = string.Empty;

    [Column("username")]
    public string Username { get; set; } = string.Empty;

    [Column("password_hash")]
    public string PasswordHash { get; set; } = string.Empty;

    [Column("role_id")]
    public int RoleId { get; set; }

    [Column("is_active")]
    public bool? IsActive { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

[Table("Clients")]
public class Client
{
    [Key]
    [Column("client_id")]
    public int ClientId { get; set; }

    [Column("dms_client_id")]
    public string? DmsClientId { get; set; }

    [Column("client_code")]
    public string? ClientCode { get; set; }

    [Column("company_name")]
    public string CompanyName { get; set; } = string.Empty;

    [Column("address")]
    public string? Address { get; set; }

    [Column("contact_person")]
    public string? ContactPerson { get; set; }

    [Column("contact_number")]
    public string? ContactNumber { get; set; }

    [Column("email")]
    public string? Email { get; set; }

    [Column("is_active")]
    public bool? IsActive { get; set; }

    [Column("synced_from_dms")]
    public bool? SyncedFromDms { get; set; }

    [Column("last_synced_at")]
    public DateTime? LastSyncedAt { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

[Table("ClientFinanceSettings")]
public class ClientFinanceSetting
{
    [Key]
    [Column("client_id")]
    public int ClientId { get; set; }

    [Column("billing_terms")]
    public string? BillingTerms { get; set; }

    [Column("payment_terms")]
    public string? PaymentTerms { get; set; }

    [Column("credit_terms_days")]
    public int? CreditTermsDays { get; set; }

    [Column("tax_type")]
    public string? TaxType { get; set; }

    [Column("oda_rate_applicable")]
    public bool? OdaRateApplicable { get; set; }

    [Column("finance_status")]
    public string? FinanceStatus { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

[Table("ClientRates")]
public class ClientRate
{
    [Key]
    [Column("rate_id")]
    public int RateId { get; set; }

    [Column("client_id")]
    public int ClientId { get; set; }

    [Column("service_type")]
    public string? ServiceType { get; set; }

    [Column("delivery_area")]
    public string? DeliveryArea { get; set; }

    [Column("minimum_kg")]
    public decimal? MinimumKg { get; set; }

    [Column("minimum_rate")]
    public decimal? MinimumRate { get; set; }

    [Column("excess_rate_per_kg")]
    public decimal? ExcessRatePerKg { get; set; }

    [Column("oda_rate")]
    public decimal? OdaRate { get; set; }

    [Column("fuel_surcharge_rate")]
    public decimal? FuelSurchargeRate { get; set; }

    [Column("valuation_rate")]
    public decimal? ValuationRate { get; set; }

    [Column("effective_from")]
    public DateOnly? EffectiveFrom { get; set; }

    [Column("effective_to")]
    public DateOnly? EffectiveTo { get; set; }

    [Column("is_active")]
    public bool? IsActive { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

[Table("Invoices")]
public class Invoice
{
    [Key]
    [Column("invoice_id")]
    public int InvoiceId { get; set; }

    [Column("invoice_number")]
    public string InvoiceNumber { get; set; } = string.Empty;

    [Column("client_id")]
    public int ClientId { get; set; }

    [Column("billing_period")]
    public string? BillingPeriod { get; set; }

    [Column("due_date")]
    public DateOnly? DueDate { get; set; }

    [Column("total_amount")]
    public decimal TotalAmount { get; set; }

    [Column("paid_amount")]
    public decimal? PaidAmount { get; set; }

    [Column("outstanding_balance")]
    public decimal? OutstandingBalance { get; set; }

    [Column("invoice_status")]
    public string? InvoiceStatus { get; set; }

    [Column("validation_status")]
    public string? ValidationStatus { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

[Table("AccountsReceivable")]
public class AccountsReceivable
{
    [Key]
    [Column("ar_id")]
    public int ArId { get; set; }

    [Column("invoice_id")]
    public int InvoiceId { get; set; }

    [Column("client_id")]
    public int ClientId { get; set; }

    [Column("invoice_amount")]
    public decimal InvoiceAmount { get; set; }

    [Column("paid_amount")]
    public decimal? PaidAmount { get; set; }

    [Column("outstanding_balance")]
    public decimal? OutstandingBalance { get; set; }

    [Column("overpayment_amount")]
    public decimal? OverpaymentAmount { get; set; }

    [Column("ar_status")]
    public string? ArStatus { get; set; }

    [Column("due_date")]
    public DateOnly? DueDate { get; set; }

    [Column("aging_bucket")]
    public string? AgingBucket { get; set; }

    [Column("collection_priority")]
    public string? CollectionPriority { get; set; }

    [Column("refund_status")]
    public string? RefundStatus { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }

    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }
}

[Table("Payments")]
public class Payment
{
    [Key]
    [Column("payment_id")]
    public int PaymentId { get; set; }

    [Column("invoice_id")]
    public int? InvoiceId { get; set; }

    [Column("client_id")]
    public int? ClientId { get; set; }

    [Column("amount")]
    public decimal Amount { get; set; }

    [Column("payment_method")]
    public string? PaymentMethod { get; set; }

    [Column("reference_number")]
    public string? ReferenceNumber { get; set; }

    [Column("proof_of_payment_path")]
    public string? ProofOfPaymentPath { get; set; }

    [Column("payment_status")]
    public string? PaymentStatus { get; set; }

    [Column("submitted_at")]
    public DateTime? SubmittedAt { get; set; }

    [Column("validated_at")]
    public DateTime? ValidatedAt { get; set; }

    [Column("validated_by")]
    public int? ValidatedBy { get; set; }

    [Column("rejected_at")]
    public DateTime? RejectedAt { get; set; }

    [Column("rejected_by")]
    public int? RejectedBy { get; set; }

    [Column("rejection_reason")]
    public string? RejectionReason { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }
}

[Table("PaymentHistory")]
public class PaymentHistory
{
    [Key]
    [Column("history_id")]
    public int HistoryId { get; set; }

    [Column("payment_id")]
    public int? PaymentId { get; set; }

    [Column("invoice_id")]
    public int? InvoiceId { get; set; }

    [Column("status")]
    public string? Status { get; set; }

    [Column("action")]
    public string? Action { get; set; }

    [Column("remarks")]
    public string? Remarks { get; set; }

    [Column("performed_by")]
    public int? PerformedBy { get; set; }

    [Column("performed_role")]
    public string? PerformedRole { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}

[Table("Notifications")]
public class Notification
{
    [Key]
    [Column("notification_id")]
    public int NotificationId { get; set; }

    [Column("recipient_user_id")]
    public int? RecipientUserId { get; set; }

    [Column("recipient_role")]
    public string? RecipientRole { get; set; }

    [Column("type")]
    public string? Type { get; set; }

    [Column("title")]
    public string? Title { get; set; }

    [Column("message")]
    public string? Message { get; set; }

    [Column("related_record_type")]
    public string? RelatedRecordType { get; set; }

    [Column("related_record_id")]
    public int? RelatedRecordId { get; set; }

    [Column("is_read")]
    public bool? IsRead { get; set; }

    [Column("created_at")]
    public DateTime? CreatedAt { get; set; }
}

[Table("AuditLogs")]
public class AuditLog
{
    [Key]
    [Column("audit_id")]
    public int audit_id { get; set; }

    [Column("user_id")]
    public int? user_id { get; set; }

    [Column("role")]
    public string? role { get; set; }

    [Column("action")]
    public string action { get; set; } = string.Empty;

    [Column("module")]
    public string module { get; set; } = string.Empty;

    [Column("affected_record_type")]
    public string? affected_record_type { get; set; }

    [Column("affected_record_id")]
    public int? affected_record_id { get; set; }

    [Column("before_value")]
    public string? before_value { get; set; }

    [Column("after_value")]
    public string? after_value { get; set; }

    [Column("remarks")]
    public string? remarks { get; set; }

    [Column("created_at")]
    public DateTime? created_at { get; set; }
}
