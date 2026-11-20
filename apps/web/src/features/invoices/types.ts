export type Invoice = {
  invoiceNumber: string
  vin: string
  year: number
  make: string
  model: string
  buyerCompany: string | null
  saleDate: string | null
  totalSales: string | null
  verified: string | null
}

export type InvoiceVerificationEvent = {
  verifiedAt: string
  source: 'sales_api' | 'ledger'
  status: 'verified' | 'pending'
  user: {
    fullName: string | null
    username: string | null
    role: string | null
  } | null
}

export type InvoiceDetail = {
  invoiceNumber: string
  vin: string
  year: number
  make: string
  model: string
  buyerCompany: string | null
  buyerRfc: string | null
  buyerAddress: string | null
  buyerCity: string | null
  saleDate: string | null
  totalSales: string | null
  dataAnalyst: string | null
  verified: string
  verificationHistory: InvoiceVerificationEvent[]
}

export type ArchivedInvoice = Invoice & {
  createdAt: string
  expiresAt: string
}

export type InvoicePage = {
  items: Invoice[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type ArchivedInvoicePage = Omit<InvoicePage, 'items'> & {
  items: ArchivedInvoice[]
  expirationThresholdDays: number
}
