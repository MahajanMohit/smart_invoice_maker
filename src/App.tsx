import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ShoppingCart, Search, Package, FileText, BarChart3, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

import { Product, Invoice, InvoiceItem } from './types';
import { db } from './services/db';
import { geminiService } from './services/gemini';
import Scanner from './components/Scanner';
import { cn } from './lib/utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'catalog' | 'analytics'>('invoices');
  const [isScanning, setIsScanning] = useState(false);
  const [currentInvoiceItems, setCurrentInvoiceItems] = useState<InvoiceItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    setProducts(db.getProducts());
    setInvoices(db.getInvoices());
  }, []);

  const handleScan = (barcode: string) => {
    const product = db.getProductByBarcode(barcode);
    if (product) {
      addItemToInvoice(product);
    } else {
      // Handle unknown product - maybe open a modal to add it?
      const name = prompt("Unknown product. Enter name:");
      const price = parseFloat(prompt("Enter price:") || "0");
      if (name && !isNaN(price)) {
        const newProduct: Product = {
          id: Math.random().toString(36).substr(2, 9),
          barcode,
          name,
          price
        };
        db.saveProduct(newProduct);
        setProducts(db.getProducts());
        addItemToInvoice(newProduct);
      }
    }
  };

  const addItemToInvoice = (product: Product) => {
    setCurrentInvoiceItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        total: product.price
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCurrentInvoiceItems(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.price };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setCurrentInvoiceItems(prev => prev.filter(item => item.productId !== productId));
  };

  const subtotal = currentInvoiceItems.reduce((sum, item) => sum + item.total, 0);
  const tax = subtotal * 0.18; // 18% GST (India standard)
  const total = subtotal + tax;

  const saveInvoice = () => {
    if (currentInvoiceItems.length === 0) return;

    const newInvoice: Invoice = {
      id: `INV-${Date.now()}`,
      date: new Date().toISOString(),
      items: currentInvoiceItems,
      subtotal,
      tax,
      total,
      customerName: customerName || 'Guest'
    };

    db.saveInvoice(newInvoice);
    setInvoices(db.getInvoices());
    setCurrentInvoiceItems([]);
    setCustomerName('');
    alert("Invoice saved successfully!");
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);
    const summary = await geminiService.summarizeSales(invoices);
    setAiSummary(summary);
    setIsGeneratingSummary(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 p-4 flex flex-row md:flex-col gap-2 sticky top-0 z-10">
        <div className="hidden md:flex items-center gap-2 px-2 py-4 mb-4">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <ShoppingCart className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">SmartInvoice</span>
        </div>

        {[
          { id: 'invoices', icon: FileText, label: 'Invoices' },
          { id: 'catalog', icon: Package, label: 'Products' },
          { id: 'analytics', icon: BarChart3, label: 'Analytics' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex-1 md:flex-none flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all",
              activeTab === tab.id 
                ? "bg-indigo-50 text-indigo-600" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            <tab.icon className="w-5 h-5" />
            <span className="hidden md:inline">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {activeTab === 'invoices' && (
            <motion.div
              key="invoices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">New Invoice</h1>
                  <p className="text-slate-500 text-sm">Scan items to start generating an invoice.</p>
                </div>
                <button 
                  onClick={() => setIsScanning(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Scan Item
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Current Invoice Items */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="glass-card rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                      <input 
                        type="text" 
                        placeholder="Customer Name (Optional)"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full bg-transparent border-none focus:ring-0 text-slate-700 font-medium placeholder:text-slate-400"
                      />
                    </div>
                    
                    <div className="divide-y divide-slate-100 min-h-[300px]">
                      {currentInvoiceItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                          <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                          <p>No items added yet</p>
                        </div>
                      ) : (
                        currentInvoiceItems.map((item) => (
                          <div key={item.productId} className="p-4 flex items-center justify-between group">
                            <div className="flex-1">
                              <h3 className="font-medium text-slate-800">{item.name}</h3>
                              <p className="text-sm text-slate-500">₹{item.price.toLocaleString('en-IN')} each</p>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                <button 
                                  onClick={() => updateQuantity(item.productId, -1)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                                >
                                  -
                                </button>
                                <span className="w-8 text-center font-mono font-medium">{item.quantity}</span>
                                <button 
                                  onClick={() => updateQuantity(item.productId, 1)}
                                  className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              <div className="w-20 text-right font-semibold text-slate-700">
                                ₹{item.total.toLocaleString('en-IN')}
                              </div>
                              <button 
                                onClick={() => removeItem(item.productId)}
                                className="p-2 text-slate-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Summary & Actions */}
                <div className="space-y-4">
                  <div className="glass-card rounded-2xl p-6 space-y-4">
                    <h2 className="font-bold text-slate-800 border-b border-slate-100 pb-4">Order Summary</h2>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>GST (18%)</span>
                        <span>₹{tax.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between text-lg font-bold text-slate-900 pt-2 border-t border-slate-100">
                        <span>Total</span>
                        <span>₹{total.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    <button 
                      onClick={saveInvoice}
                      disabled={currentInvoiceItems.length === 0}
                      className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-5 h-5" />
                      Complete Invoice
                    </button>
                  </div>

                  <div className="glass-card rounded-2xl p-6">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Invoices</h3>
                    <div className="space-y-3">
                      {invoices.slice(0, 3).map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-sm">
                          <div>
                            <p className="font-medium text-slate-700">{inv.customerName}</p>
                            <p className="text-xs text-slate-400">{format(new Date(inv.date), 'MMM d, h:mm a')}</p>
                          </div>
                          <span className="font-mono font-medium">₹{inv.total.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                      {invoices.length === 0 && <p className="text-xs text-slate-400 italic">No history yet</p>}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'catalog' && (
            <motion.div
              key="catalog"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Product Catalog</h1>
                  <p className="text-slate-500 text-sm">Manage your inventory and prices.</p>
                </div>
                <button className="btn-primary flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Add Product
                </button>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="p-4 font-semibold text-slate-600 text-sm">Barcode</th>
                      <th className="p-4 font-semibold text-slate-600 text-sm">Product Name</th>
                      <th className="p-4 font-semibold text-slate-600 text-sm">Category</th>
                      <th className="p-4 font-semibold text-slate-600 text-sm text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-mono text-xs text-slate-500">{product.barcode}</td>
                        <td className="p-4 font-medium text-slate-800">{product.name}</td>
                        <td className="p-4 text-sm text-slate-500">{product.category || 'General'}</td>
                        <td className="p-4 text-right font-semibold text-slate-700">₹{product.price.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Sales Analytics</h1>
                  <p className="text-slate-500 text-sm">AI-powered insights from your sales data.</p>
                </div>
                <button 
                  onClick={generateSummary}
                  disabled={isGeneratingSummary || invoices.length === 0}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingSummary ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <BarChart3 className="w-5 h-5" />
                  )}
                  Generate AI Summary
                </button>
              </div>

              {aiSummary && (
                <div className="glass-card rounded-2xl p-8 prose prose-slate max-w-none">
                  <ReactMarkdown>{aiSummary}</ReactMarkdown>
                </div>
              )}

              {!aiSummary && !isGeneratingSummary && (
                <div className="flex flex-col items-center justify-center py-20 glass-card rounded-2xl text-slate-400">
                  <BarChart3 className="w-16 h-16 mb-4 opacity-10" />
                  <p>Click the button above to analyze your sales data</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Scanner Modal */}
      <AnimatePresence>
        {isScanning && (
          <Scanner 
            onScan={handleScan} 
            onClose={() => setIsScanning(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
