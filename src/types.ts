export interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  category?: string;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Invoice {
  id: string;
  date: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  customerName?: string;
}
