import { Product, Invoice } from '../types';

const PRODUCTS_KEY = 'invoice_pro_products';
const INVOICES_KEY = 'invoice_pro_invoices';

// Seed data
const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', barcode: '123456', name: 'Premium Coffee Beans', price: 1200, category: 'Beverages' },
  { id: '2', barcode: '789012', name: 'Organic Almond Milk', price: 350, category: 'Dairy' },
  { id: '3', barcode: '345678', name: 'Artisan Sourdough', price: 450, category: 'Bakery' },
];

export const db = {
  getProducts: (): Product[] => {
    const stored = localStorage.getItem(PRODUCTS_KEY);
    if (!stored) {
      localStorage.setItem(PRODUCTS_KEY, JSON.stringify(DEFAULT_PRODUCTS));
      return DEFAULT_PRODUCTS;
    }
    return JSON.parse(stored);
  },

  saveProduct: (product: Product) => {
    const products = db.getProducts();
    const index = products.findIndex(p => p.id === product.id || p.barcode === product.barcode);
    if (index >= 0) {
      // Logic: Keep the higher price
      const existingPrice = products[index].price;
      const newPrice = Math.max(existingPrice, product.price);
      products[index] = { ...product, price: newPrice };
    } else {
      products.push(product);
    }
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
  },

  getProductByBarcode: (barcode: string): Product | undefined => {
    const products = db.getProducts();
    return products.find(p => p.barcode === barcode);
  },

  getInvoices: (): Invoice[] => {
    const stored = localStorage.getItem(INVOICES_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveInvoice: (invoice: Invoice) => {
    const invoices = db.getInvoices();
    invoices.unshift(invoice);
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
  }
};
