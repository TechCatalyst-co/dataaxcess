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

export type InvoicePage = {
  items: Invoice[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}
