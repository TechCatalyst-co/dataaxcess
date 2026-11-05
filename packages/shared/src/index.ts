import { z } from "zod";

export const roleSchema = z.enum(["admin", "agent"]);
export type Role = z.infer<typeof roleSchema>;

export const loginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(1).max(50),
  vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i).transform((value) => value.toUpperCase()),
  year: z.number().int().min(1886).max(2100),
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  buyerCompany: z.string().trim().max(100).optional(),
  buyerRfc: z.string().trim().max(20).optional(),
  buyerAddress: z.string().trim().max(200).optional(),
  buyerCity: z.string().trim().max(100).optional(),
  saleDate: z.iso.date().optional(),
  totalSales: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).optional(),
  dataAnalyst: z.string().trim().max(255).optional(),
});
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const vinSchema = z
  .string()
  .length(17)
  .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, "Invalid VIN")
  .transform((v) => v.toUpperCase());

export const teamUserSchema = z.object({
  id: z.number().int().positive(),
  username: z.string().min(1).max(50),
  fullName: z.string().min(1).max(100),
  role: roleSchema,
  createdAt: z.string().datetime(),
});
export type TeamUser = z.infer<typeof teamUserSchema>;

export const createTeamUserSchema = z.object({
  username: z.string().trim().min(1).max(50),
  fullName: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(200),
  role: roleSchema,
});
export type CreateTeamUserInput = z.infer<typeof createTeamUserSchema>;

export const updateTeamUserSchema = z.object({
  fullName: z.string().trim().min(1).max(100).optional(),
  role: roleSchema.optional(),
})
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateTeamUserInput = z.infer<typeof updateTeamUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().trim().min(12).max(200),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
