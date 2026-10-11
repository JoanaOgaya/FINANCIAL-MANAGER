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

        var seedIds = demoEmployees.Select(e => e.Id).ToList();
        var extraEmployees = await context.Employees.Where(e => !seedIds.Contains(e.Id)).ToListAsync();
        if (extraEmployees.Any())
        {
            context.Employees.RemoveRange(extraEmployees);
        }

        await context.SaveChangesAsync();
    }
}
