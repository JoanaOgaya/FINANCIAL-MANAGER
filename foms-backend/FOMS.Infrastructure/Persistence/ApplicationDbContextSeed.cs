using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using FOMS.Domain.Entities;

namespace FOMS.Infrastructure.Persistence;

public static class ApplicationDbContextSeed
{
    public static async Task SeedSampleDataAsync(ApplicationDbContext context)
    {
        // ══════════════════════════════════════════════════════════════════
        // 1. Seed Employees (always upsert — never skip)
        // ══════════════════════════════════════════════════════════════════
        var demoEmployees = new List<Employee>
        {
            new Employee
            {
                Id = "EMP-001",
                Name = "Crystalyn Joyce C. Fajardo",
                Role = "Finance Manager",
                Email = "crystalyn@foms.local",
                SystemAccess = "Finance Operation Service",
                Status = "Active",
                IsActive = true,
                Username = "EMP-001",
                PasswordHash = FOMS.Application.Services.AuthService.HashPassword("Password@123")
            },
            new Employee
            {
                Id = "EMP-002",
                Name = "Misty",
                Role = "Head Accountant",
                Email = "misty@foms.local",
                SystemAccess = "Finance Operation Service",
                Status = "Active",
                IsActive = true,
                Username = "EMP-002",
                PasswordHash = FOMS.Application.Services.AuthService.HashPassword("Password@123")
            },
            new Employee
            {
                Id = "EMP-003",
                Name = "Maria Mariel Jane Anonuevo",
                Role = "Accountant",
                Email = "mariel@foms.local",
                SystemAccess = "Finance Operation Service",
                Status = "Active",
                IsActive = true,
                Username = "EMP-003",
                PasswordHash = FOMS.Application.Services.AuthService.HashPassword("Password@123")
            },
            new Employee
            {
                Id = "EMP-004",
                Name = "Joana Marie Ogaya",
                Role = "Financial Manager",
                Email = "joana@foms.local",
                SystemAccess = "Finance Operation Service",
                Status = "Active",
                IsActive = true,
                Username = "EMP-004",
                PasswordHash = FOMS.Application.Services.AuthService.HashPassword("Password@123")
            }
        };

        foreach (var demoEmployee in demoEmployees)
        {
            var existingEmployee = await context.Employees.FirstOrDefaultAsync(e => e.Id == demoEmployee.Id);
            if (existingEmployee != null)
            {
                existingEmployee.Name = demoEmployee.Name;
                existingEmployee.Role = demoEmployee.Role;
                existingEmployee.Email = demoEmployee.Email;
                existingEmployee.SystemAccess = demoEmployee.SystemAccess;
                existingEmployee.Status = demoEmployee.Status;
                existingEmployee.IsActive = demoEmployee.IsActive;
                existingEmployee.Username = demoEmployee.Username;

                if (!existingEmployee.PasswordHash.StartsWith("PBKDF2$"))
                {
                    existingEmployee.PasswordHash = demoEmployee.PasswordHash;
                }
            }
            else
            {
                context.Employees.Add(demoEmployee);
            }
        }

        var seedIds = demoEmployees.Select(e => e.Id).ToList();
        var extraEmployees = await context.Employees.Where(e => !seedIds.Contains(e.Id)).ToListAsync();
        if (extraEmployees.Any())
        {
            context.Employees.RemoveRange(extraEmployees);
        }

        await context.SaveChangesAsync();

        // ══════════════════════════════════════════════════════════════════
        // 2. Seed Clients (upsert all known clients)
        // ══════════════════════════════════════════════════════════════════
        var clientList = new List<Client>
        {
            new Client { Id = "CL-001", ClientCode = "LZD-001", Name = "Lazada Philippines",      BusinessName = "Lazada E-Services Philippines, Inc.", ContactPerson = "Maria Dela Cruz", ContactNumber = "0917-123-4567",  Email = "finance@lazada.com.ph", Address = "Rockwell Dr., Brgy. Poblacion, Makati City", Tin = "123-456-789-000", CreditLimit = 500000, Status = "Active", DateRegistered = "2024-11-26", LastTransaction = "2026-05-18", CurrentBalance = 85300,  TotalBilled = 124200, TotalPaid = 38900 },
            new Client { Id = "CL-002", ClientCode = "SHP-002", Name = "Shopee Express",           BusinessName = "Shopee Xpress PH, Inc.",               ContactPerson = "Jose Santos",     ContactNumber = "0917-555-9876",  Email = "ap@shopee.ph",           Address = "Ayala Ave., Makati City",                   Tin = "987-654-321-000", CreditLimit = 450000, Status = "Active", DateRegistered = "2024-12-26", LastTransaction = "2026-05-19", CurrentBalance = 52500,  TotalBilled = 86200,  TotalPaid = 33700 },
            new Client { Id = "CL-003", ClientCode = "TTS-003", Name = "TikTok Shop",              BusinessName = "TikTok Shop Philippines, Inc.",        ContactPerson = "Robert Lim",      ContactNumber = "0917-333-4444",  Email = "billing@tiktok.ph",      Address = "BGC High St., Taguig City",                 Tin = "321-654-987-000", CreditLimit = 300000, Status = "Active", DateRegistered = "2025-01-25", LastTransaction = "2026-05-12", CurrentBalance = 36350,  TotalBilled = 56350,  TotalPaid = 20000 },
            new Client { Id = "CA-001", ClientCode = "CA-001", Name = "Lazada Account",            BusinessName = "Lazada E-Services Philippines, Inc.", ContactPerson = "Maria Dela Cruz", ContactNumber = "0917-123-4567",  Email = "finance@lazada.com.ph", Address = "Rockwell Dr., Brgy. Poblacion, Makati City", Status = "Active", CreditLimit = 500000, CurrentBalance = 53200, DateRegistered = "2024-11-26" },
            new Client { Id = "CA-002", ClientCode = "CA-002", Name = "Shopee Express Account",    BusinessName = "Shopee Xpress PH, Inc.",               ContactPerson = "Jose Santos",     ContactNumber = "0917-555-9876",  Email = "ap@shopee.ph",           Address = "Ayala Ave., Makati City",                   Status = "Active", CreditLimit = 450000, CurrentBalance = 45000, DateRegistered = "2024-12-26" },
            new Client { Id = "CA-003", ClientCode = "CA-003", Name = "Lazada Philippines",        BusinessName = "Lazada Philippines",                   ContactPerson = "Lazada Admin",    ContactNumber = "+63 917 123 4567", Email = "billing@lazada.ph",    Address = "BGC High St., Taguig City",                 Status = "Active", CreditLimit = 500000, CurrentBalance = 25000, DateRegistered = "2024-11-26" },
        };

        foreach (var client in clientList)
        {
            if (!await context.Clients.AnyAsync(c => c.Id == client.Id))
                context.Clients.Add(client);
        }
        await context.SaveChangesAsync();

        // ══════════════════════════════════════════════════════════════════
        // 3. Seed ShipmentRecords (Waybills)
        //    E2E records (WB-E2E-*) are ALWAYS reset to "For Checking" so
        //    every test run starts from a clean, deterministic state.
        // ══════════════════════════════════════════════════════════════════

        // Static background waybills (insert-only)
        var staticWaybills = new List<ShipmentRecord>
        {
            new ShipmentRecord { Id = "SR-001", ClientId = "CA-001", Origin = "Manila",       Destination = "Cebu",         WeightKg = 12.5m, Cost = 7500.00m, Status = "Completed", ShipmentDate = DateTime.UtcNow.AddDays(-15) },
            new ShipmentRecord { Id = "SR-002", ClientId = "CA-001", Origin = "Manila",       Destination = "Davao",        WeightKg = 25.0m, Cost = 1555.00m, Status = "Completed", ShipmentDate = DateTime.UtcNow.AddDays(-10) },
            new ShipmentRecord { Id = "SR-003", ClientId = "CA-002", Origin = "Cebu",         Destination = "Manila",       WeightKg = 18.0m, Cost = 2200.00m, Status = "Completed", ShipmentDate = DateTime.UtcNow.AddDays(-8)  },
            new ShipmentRecord { Id = "SR-004", ClientId = "CA-003", Origin = "Davao",        Destination = "Cebu",         WeightKg = 30.0m, Cost = 3500.00m, Status = "Completed", ShipmentDate = DateTime.UtcNow.AddDays(-12) },
            new ShipmentRecord { Id = "SR-005", ClientId = "CL-001", Origin = "Makati",       Destination = "BGC",          WeightKg = 5.5m,  Cost = 800.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-7)  },
            new ShipmentRecord { Id = "SR-006", ClientId = "CL-002", Origin = "Taguig",       Destination = "Pasig",        WeightKg = 9.0m,  Cost = 1100.00m, Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-9)  },
            new ShipmentRecord { Id = "SR-007", ClientId = "CL-003", Origin = "Quezon",       Destination = "Manila",       WeightKg = 7.5m,  Cost = 950.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-6)  },
        };

        foreach (var wb in staticWaybills)
        {
            if (!await context.ShipmentRecords.AnyAsync(s => s.Id == wb.Id))
                context.ShipmentRecords.Add(wb);
        }

        // ── E2E Waybills: 10 records, ALWAYS reset to "Validated" ─────
        var e2eWaybills = new List<ShipmentRecord>
        {
            new ShipmentRecord { Id = "WB-E2E-001", ClientId = "CA-001", Origin = "Makati",       Destination = "Quezon City",   WeightKg = 5.0m,  Cost = 500.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-1) },
            new ShipmentRecord { Id = "WB-E2E-002", ClientId = "CA-001", Origin = "Pasay",         Destination = "Paranaque",     WeightKg = 7.5m,  Cost = 750.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-1) },
            new ShipmentRecord { Id = "WB-E2E-003", ClientId = "CA-002", Origin = "Taguig",        Destination = "Alabang",       WeightKg = 3.0m,  Cost = 300.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-2) },
            new ShipmentRecord { Id = "WB-E2E-004", ClientId = "CA-002", Origin = "Mandaluyong",   Destination = "Marikina",      WeightKg = 11.0m, Cost = 1100.00m, Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-2) },
            new ShipmentRecord { Id = "WB-E2E-005", ClientId = "CA-003", Origin = "Caloocan",      Destination = "Navotas",       WeightKg = 6.0m,  Cost = 600.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-2) },
            new ShipmentRecord { Id = "WB-E2E-006", ClientId = "CA-003", Origin = "Valenzuela",    Destination = "Malabon",       WeightKg = 9.5m,  Cost = 950.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-3) },
            new ShipmentRecord { Id = "WB-E2E-007", ClientId = "CL-001", Origin = "Las Pinas",     Destination = "Muntinlupa",    WeightKg = 4.5m,  Cost = 450.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-3) },
            new ShipmentRecord { Id = "WB-E2E-008", ClientId = "CL-002", Origin = "Antipolo",      Destination = "Cainta",        WeightKg = 8.0m,  Cost = 800.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-3) },
            new ShipmentRecord { Id = "WB-E2E-009", ClientId = "CL-003", Origin = "San Juan",      Destination = "Mandaluyong",   WeightKg = 5.5m,  Cost = 550.00m,  Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-4) },
            new ShipmentRecord { Id = "WB-E2E-010", ClientId = "CA-001", Origin = "Pateros",       Destination = "Taguig",        WeightKg = 12.0m, Cost = 1200.00m, Status = "Validated", ShipmentDate = DateTime.UtcNow.AddDays(-4) },
        };

        foreach (var wb in e2eWaybills)
        {
            var existing = await context.ShipmentRecords.FirstOrDefaultAsync(s => s.Id == wb.Id);
            if (existing == null)
            {
                context.ShipmentRecords.Add(wb);
            }
            else
            {
                // ALWAYS reset E2E waybills to "Validated" on every startup
                existing.Status = "Validated";
                existing.ShipmentDate = wb.ShipmentDate;
            }
        }
        await context.SaveChangesAsync();

        // ══════════════════════════════════════════════════════════════════
        // 4. Seed Invoices
        //    Static invoices: insert-only.
        //    E2E invoices (INV-E2E-*): ALWAYS reset to "Unpaid".
        // ══════════════════════════════════════════════════════════════════
        var staticInvoices = new List<Invoice>
        {
            new Invoice { Id = "INV-001", InvoiceNo = "LZD-2026-0001", ClientId = "CA-001", ClientName = "Lazada Philippines", BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"), FreightCharges = 47500.00m, Subtotal = 47500.00m, VatRate = 0.12, VatAmount = 5700.00m,  TotalAmount = 53200.00m, AmountPaid = 0m,       Balance = 53200.00m, PaymentStatus = "Unpaid",         Description = "Monthly Freight Shipping Services" },
            new Invoice { Id = "INV-002", InvoiceNo = "SHP-2026-0001", ClientId = "CL-002", ClientName = "Shopee Express",     BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"), FreightCharges = 35000.00m, Subtotal = 35000.00m, VatRate = 0.12, VatAmount = 4200.00m,  TotalAmount = 39200.00m, AmountPaid = 0m, Balance = 39200.00m, PaymentStatus = "Unpaid", Description = "Cargo Forwarding" },
            new Invoice { Id = "INV-003", InvoiceNo = "TTS-2026-0001", ClientId = "CL-003", ClientName = "TikTok Shop",        BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(15).ToString("yyyy-MM-dd"), FreightCharges = 18000.00m, Subtotal = 18000.00m, VatRate = 0.12, VatAmount = 2160.00m,  TotalAmount = 20160.00m, AmountPaid = 0m,       Balance = 20160.00m, PaymentStatus = "Unpaid",         Description = "Cross-dock Services" },
        };

        foreach (var inv in staticInvoices)
        {
            if (!await context.Invoices.AnyAsync(i => i.Id == inv.Id))
                context.Invoices.Add(inv);
        }

        // ── E2E Invoices: 5 Unpaid records for CA-003, always reset ──────
        var e2eInvoices = new List<Invoice>
        {
            new Invoice { Id = "INV-E2E-001", InvoiceNo = "LZD-2026-E001", ClientId = "CA-003", ClientName = "Lazada Philippines", BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"), FreightCharges = 25000.00m, Subtotal = 25000.00m, VatRate = 0.12, VatAmount = 3000.00m, TotalAmount = 28000.00m, AmountPaid = 0m, Balance = 28000.00m, PaymentStatus = "Unpaid", Description = "E2E Test Invoice #1" },
            new Invoice { Id = "INV-E2E-002", InvoiceNo = "LZD-2026-E002", ClientId = "CA-003", ClientName = "Lazada Philippines", BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(25).ToString("yyyy-MM-dd"), FreightCharges = 18500.00m, Subtotal = 18500.00m, VatRate = 0.12, VatAmount = 2220.00m, TotalAmount = 20720.00m, AmountPaid = 0m, Balance = 20720.00m, PaymentStatus = "Unpaid", Description = "E2E Test Invoice #2" },
            new Invoice { Id = "INV-E2E-003", InvoiceNo = "LZD-2026-E003", ClientId = "CA-003", ClientName = "Lazada Philippines", BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-dd"), FreightCharges = 32000.00m, Subtotal = 32000.00m, VatRate = 0.12, VatAmount = 3840.00m, TotalAmount = 35840.00m, AmountPaid = 0m, Balance = 35840.00m, PaymentStatus = "Unpaid", Description = "E2E Test Invoice #3" },
            new Invoice { Id = "INV-E2E-004", InvoiceNo = "LZD-2026-E004", ClientId = "CA-003", ClientName = "Lazada Philippines", BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(15).ToString("yyyy-MM-dd"), FreightCharges = 15000.00m, Subtotal = 15000.00m, VatRate = 0.12, VatAmount = 1800.00m, TotalAmount = 16800.00m, AmountPaid = 0m, Balance = 16800.00m, PaymentStatus = "Unpaid", Description = "E2E Test Invoice #4" },
            new Invoice { Id = "INV-E2E-005", InvoiceNo = "LZD-2026-E005", ClientId = "CA-003", ClientName = "Lazada Philippines", BillingDate = DateTime.UtcNow.ToString("yyyy-MM-dd"), DueDate = DateTime.UtcNow.AddDays(10).ToString("yyyy-MM-dd"), FreightCharges = 22000.00m, Subtotal = 22000.00m, VatRate = 0.12, VatAmount = 2640.00m, TotalAmount = 24640.00m, AmountPaid = 0m, Balance = 24640.00m, PaymentStatus = "Unpaid", Description = "E2E Test Invoice #5" },
        };

        foreach (var inv in e2eInvoices)
        {
            var existing = await context.Invoices.FirstOrDefaultAsync(i => i.Id == inv.Id);
            if (existing == null)
            {
                context.Invoices.Add(inv);
            }
            else
            {
                // ALWAYS reset E2E invoices to Unpaid on every startup
                existing.PaymentStatus = "Unpaid";
                existing.AmountPaid = 0m;
                existing.Balance = inv.TotalAmount;
            }
        }
        await context.SaveChangesAsync();

        // ══════════════════════════════════════════════════════════════════
        // 5. Seed Payments (static background data, insert-only)
        // ══════════════════════════════════════════════════════════════════
        if (!await context.Payments.AnyAsync())
        {
            var payments = new List<Payment>
            {
                new Payment
                {
                    Id = "PAY-001",
                    OrNumber = "OR-2026-0001",
                    InvoiceId = "INV-001",
                    InvoiceNo = "INV-001",
                    ClientId = "CA-001",
                    ClientName = "Shopee Express",
                    PaymentDate = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd"),
                    Amount = 20400.00m,
                    PaymentMethod = "Bank Transfer",
                    ReferenceNumber = "BT-2026-001",
                    PaymentStatus = "Validated",
                    RecordedBy = "EMP-001",
                    DateRecorded = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd"),
                    SubmittedAt = DateTime.UtcNow.AddDays(-5)
                }
            };
            context.Payments.AddRange(payments);
            await context.SaveChangesAsync();
        }

        // ══════════════════════════════════════════════════════════════════
        // 6. Seed CashFlowTransactions (insert-only)
        // ══════════════════════════════════════════════════════════════════
        if (!await context.CashFlowTransactions.AnyAsync())
        {
            var cf = new CashFlowTransaction
            {
                Id = "CF-001",
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                Description = "Client Collection - Shopee Express",
                Amount = 20400.00m,
                Type = "Inflow",
                Category = "Collections",
                ReferenceNo = "OR-2026-001"
            };
            context.CashFlowTransactions.Add(cf);
            await context.SaveChangesAsync();
        }

        // ══════════════════════════════════════════════════════════════════
        // 7. Seed ReceivableBalances (insert-only)
        // ══════════════════════════════════════════════════════════════════
        if (!await context.ReceivableBalances.AnyAsync())
        {
            var receivables = new List<ReceivableBalance>
            {
                new ReceivableBalance { Id = "RB-001", ClientId = "CA-001", InvoiceId = "INV-001", BalanceAmount = 53200.00m, DueDate = DateTime.UtcNow.AddDays(30) },
                new ReceivableBalance { Id = "RB-002", ClientId = "CL-002", InvoiceId = "INV-002", BalanceAmount = 18800.00m, DueDate = DateTime.UtcNow.AddDays(30) },
                new ReceivableBalance { Id = "RB-003", ClientId = "CL-003", InvoiceId = "INV-003", BalanceAmount = 20160.00m, DueDate = DateTime.UtcNow.AddDays(15) }
            };
            context.ReceivableBalances.AddRange(receivables);
            await context.SaveChangesAsync();
        }

        // ══════════════════════════════════════════════════════════════════
        // 8. Seed AgingAccounts (insert-only)
        // ══════════════════════════════════════════════════════════════════
        if (!await context.AgingAccounts.AnyAsync())
        {
            var aging = new List<AgingAccount>
            {
                new AgingAccount { Id = "AA-001", ClientId = "CL-001", CurrentAmount = 15000.00m, DaysPastDue = 45, Status = "Overdue" },
                new AgingAccount { Id = "AA-002", ClientId = "CL-002", CurrentAmount = 18800.00m, DaysPastDue = 0,  Status = "Current" },
                new AgingAccount { Id = "AA-003", ClientId = "CL-003", CurrentAmount = 8500.00m,  DaysPastDue = 10, Status = "Overdue" }
            };
            context.AgingAccounts.AddRange(aging);
            await context.SaveChangesAsync();
        }

        await context.SaveChangesAsync();
    }
}
