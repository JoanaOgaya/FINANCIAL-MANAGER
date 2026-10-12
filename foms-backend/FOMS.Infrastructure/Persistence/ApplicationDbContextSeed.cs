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
        // ==================== Employees ====================
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
                PasswordHash = FOMS.Application.Services.AuthService.HashPassword("Password@123"),
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
                Role = "Assistant Financial Manager",
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

        // ==================== Clients ====================
        var demoClients = new List<Client>
        {
            new Client
            {
                Id = "CA-001",
                ClientCode = "CA-001",
                Name = "Lazada Philippines",
                BusinessName = "Lazada PH",
                ContactPerson = "John Doe",
                ContactNumber = "09171234567",
                Email = "contact@lazada.com",
                Address = "Manila, Philippines",
                Tin = "123-456-789",
                CreditLimit = 500000m,
                CurrentBalance = 53200m
            },
            new Client
            {
                Id = "CA-002",
                ClientCode = "CA-002",
                Name = "Shopee Philippines",
                BusinessName = "Shopee PH",
                ContactPerson = "Jane Smith",
                ContactNumber = "09179876543",
                Email = "contact@shopee.com",
                Address = "Cebu, Philippines",
                Tin = "987-654-321",
                CreditLimit = 300000m,
                CurrentBalance = 0m
            }
        };
        foreach (var client in demoClients)
        {
            var existing = await context.Clients.FirstOrDefaultAsync(c => c.Id == client.Id);
            if (existing != null)
            {
                existing.Name = client.Name;
                existing.BusinessName = client.BusinessName;
                existing.ContactPerson = client.ContactPerson;
                existing.ContactNumber = client.ContactNumber;
                existing.Email = client.Email;
                existing.Address = client.Address;
                existing.Tin = client.Tin;
                existing.CreditLimit = client.CreditLimit;
                existing.CurrentBalance = client.CurrentBalance;
            }
            else
            {
                context.Clients.Add(client);
            }
        }

        // ==================== Invoices ====================
        var demoInvoices = new List<Invoice>
        {
            new Invoice
            {
                Id = "INV-001",
                InvoiceNo = "LZD-2026-0001",
                ClientId = "CA-001",
                ClientName = "Lazada Philippines",
                BillingDate = DateTime.UtcNow.AddDays(-10).ToString("yyyy-MM-dd"),
                DueDate = DateTime.UtcNow.AddDays(20).ToString("yyyy-MM-dd"),
                TotalAmount = 50000m,
                AmountPaid = 0m,
                Balance = 50000m,
                PaymentStatus = "Unpaid"
            },
            new Invoice
            {
                Id = "INV-002",
                InvoiceNo = "BI-2026-0001",
                ClientId = "CA-001",
                ClientName = "Lazada Philippines",
                BillingDate = DateTime.UtcNow.AddDays(-5).ToString("yyyy-MM-dd"),
                DueDate = DateTime.UtcNow.AddDays(25).ToString("yyyy-MM-dd"),
                TotalAmount = 30000m,
                AmountPaid = 0m,
                Balance = 30000m,
                PaymentStatus = "Unpaid"
            }
        };
        foreach (var invoice in demoInvoices)
        {
            var existing = await context.Invoices.FirstOrDefaultAsync(i => i.Id == invoice.Id);
            if (existing != null)
            {
                existing.InvoiceNo = invoice.InvoiceNo;
                existing.ClientId = invoice.ClientId;
                existing.ClientName = invoice.ClientName;
                existing.BillingDate = invoice.BillingDate;
                existing.DueDate = invoice.DueDate;
                existing.TotalAmount = invoice.TotalAmount;
                existing.AmountPaid = invoice.AmountPaid;
                existing.Balance = invoice.Balance;
                existing.PaymentStatus = invoice.PaymentStatus;
            }
            else
            {
                context.Invoices.Add(invoice);
            }
        }

        // ==================== Shipment Records ====================
        var demoShipments = new List<ShipmentRecord>
        {
            new ShipmentRecord
            {
                Id = "SR-001",
                ClientId = "CA-001",
                Cost = 7500m,
                Status = "Pending Validation"
            }
        };
        foreach (var shipment in demoShipments)
        {
            var existing = await context.ShipmentRecords.FirstOrDefaultAsync(s => s.Id == shipment.Id);
            if (existing != null)
            {
                existing.ClientId = shipment.ClientId;
                existing.Cost = shipment.Cost;
                existing.Status = shipment.Status;
            }
            else
            {
                context.ShipmentRecords.Add(shipment);
            }
        }

        // ==================== Cash Flow Transactions ====================
        var demoCashFlows = new List<CashFlowTransaction>
        {
            new CashFlowTransaction
            {
                Id = Guid.NewGuid().ToString(),
                Type = "Inflow",
                Category = "Collection",
                Amount = 50000m,
                ReferenceNo = "OR-2026-INIT",
                Description = "Initial cash collection",
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            },
            new CashFlowTransaction
            {
                Id = Guid.NewGuid().ToString(),
                Type = "Outflow",
                Category = "Fuel",
                Amount = 3500m,
                ReferenceNo = "OR-2026-FUEL",
                Description = "Fleet expense for XYZ-1234",
                Date = DateTime.UtcNow.ToString("yyyy-MM-dd"),
            }
        };
        foreach (var cf in demoCashFlows)
        {
            var exists = await context.CashFlowTransactions.FirstOrDefaultAsync(c => c.ReferenceNo == cf.ReferenceNo);
            if (exists == null)
            {
                context.CashFlowTransactions.Add(cf);
            }
        }

        // ==================== Payments ====================
        var demoPayments = new List<Payment>
        {
            new Payment
            {
                Id = "PAY-001",
                InvoiceId = "INV-001",
                InvoiceNo = "LZD-2026-0001",
                ClientId = "CA-001",
                ClientName = "Lazada Philippines",
                Amount = 50000m,
                PaymentMethod = "Bank Transfer",
                ReferenceNumber = "OR-2026-TEST",
                PaymentStatus = "Pending Finance Validation",
                SubmittedAt = DateTime.UtcNow
            }
        };
        foreach (var p in demoPayments)
        {
            var existing = await context.Payments.FirstOrDefaultAsync(pay => pay.Id == p.Id);
            if (existing == null)
            {
                context.Payments.Add(p);
            }
        }

        await context.SaveChangesAsync();
    }
}
