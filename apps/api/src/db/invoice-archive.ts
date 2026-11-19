import { AppSetting } from "./schema.js";

const millisecondsPerDay = 24 * 60 * 60 * 1000;
export const defaultInvoiceExpirationDays = 30;

export async function getInvoiceExpirationDays() {
  const setting = await AppSetting.findById("invoiceExpirationDays")
    .select("value")
    .lean<{ value: number } | null>();
  const value = Number(setting?.value);
  return Number.isInteger(value) && value > 0 ? value : defaultInvoiceExpirationDays;
}

export function invoiceExpirationCutoff(now: Date, expirationDays: number) {
  return new Date(now.getTime() - expirationDays * millisecondsPerDay);
}

export function invoiceExpirationDate(createdAt: Date, expirationDays: number) {
  return new Date(createdAt.getTime() + expirationDays * millisecondsPerDay);
}