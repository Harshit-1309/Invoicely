import { useState, useEffect } from 'react';
import {
  FileText,
  Mail,
  Upload,
  RefreshCw,
  ExternalLink,
  Search,
  Building2,
  Receipt,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  X
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { getApiUrl } from '../config/api';

interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  vendorName: string;
  amount: string;
  rawAmount: number;
  date: string;
  dueDate: string;
  status: string;
  source: 'email' | 'upload';
}

interface VendorSummary {
  vendorName: string;
  totalInvoices: number;
  emailInvoices: number;
  pdfInvoices: number;
  totalAmount: number;
  formattedSpend: string;
  poNumbers: string[];
  invoices: InvoiceItem[];
}

interface ChannelData {
  totalEmailsFetched?: number;
  totalUploaded?: number;
  totalInvoicesProcessed: number;
  totalBillsCreated: number;
  totalAmount: number;
  invoices: InvoiceItem[];
}

interface DashboardViewProps {
  setActiveTab: (tab: string) => void;
  setSearchQuery?: (query: string) => void;
}

export function DashboardView({ setActiveTab, setSearchQuery }: DashboardViewProps) {
  const [dateRange, setDateRange] = useState('All');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [funnel, setFunnel] = useState<{ stage: string; count: number }[]>([]);
  const [attention, setAttention] = useState<any[]>([]);
  const [spendByVendor, setSpendByVendor] = useState<any[]>([]);
  const [channels, setChannels] = useState<{ email: ChannelData; pdf: ChannelData }>({
    email: { totalEmailsFetched: 0, totalInvoicesProcessed: 0, totalBillsCreated: 0, totalAmount: 0, invoices: [] },
    pdf: { totalUploaded: 0, totalInvoicesProcessed: 0, totalBillsCreated: 0, totalAmount: 0, invoices: [] }
  });
  const [vendorBreakdown, setVendorBreakdown] = useState<VendorSummary[]>([]);
  const [allInvoices, setAllInvoices] = useState<InvoiceItem[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  
  // Table filters & search
  const [tableSearch, setTableSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<'all' | 'email' | 'upload' | 'overdue'>('all');

  // Modals state
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [fullBillDetails, setFullBillDetails] = useState<any>(null);
  const [isBillLoading, setIsBillLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [selectedVendorForModal, setSelectedVendorForModal] = useState<VendorSummary | null>(null);

  // Trigger state
  const [isTriggering, setIsTriggering] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/metrics?days=${dateRange}&t=${Date.now()}`));
      if (res.ok) {
        const data = await res.json();
        setFunnel(data.funnel || []);
        setAttention(data.attention || []);
        setSpendByVendor(data.spendByVendor || []);
        if (data.channelBreakdown) {
          setChannels(data.channelBreakdown);
        }
        if (data.vendorBreakdown) {
          setVendorBreakdown(data.vendorBreakdown);
        }
        if (data.allInvoices) {
          setAllInvoices(data.allInvoices);
        }
        if (data.recentJobs) {
          setRecentJobs(data.recentJobs);
        }
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch dashboard metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 8000);
    return () => clearInterval(interval);
  }, [dateRange]);

  const triggerEmailFetch = async () => {
    setIsTriggering(true);
    try {
      await fetch(getApiUrl('/api/trigger'), { method: 'POST' });
      setTimeout(() => {
        setIsTriggering(false);
        fetchDashboardData();
      }, 2000);
    } catch (err) {
      console.error('Email trigger failed', err);
      setIsTriggering(false);
    }
  };

  const handleOpenInvoiceModal = async (invoice: InvoiceItem) => {
    setSelectedInvoice(invoice);
    setIsBillLoading(true);
    setFullBillDetails(null);
    try {
      const res = await fetch(getApiUrl(`/api/bills/${invoice.id}`));
      if (res.ok) {
        const billData = await res.json();
        setFullBillDetails(billData);
      }
    } catch (err) {
      console.error('Failed to fetch bill details for modal:', err);
    } finally {
      setIsBillLoading(false);
    }
  };

  const navigateToBills = (invoiceNumber?: string) => {
    if (invoiceNumber && setSearchQuery) {
      setSearchQuery(invoiceNumber);
    }
    setActiveTab('Bills');
    localStorage.setItem('activeTab', 'Bills');
  };

  const navigateToPOs = (poNumber?: string) => {
    if (poNumber && setSearchQuery) {
      setSearchQuery(poNumber);
    }
    setActiveTab('Purchase orders');
    localStorage.setItem('activeTab', 'Purchase orders');
  };

  const navigateToVendors = (vendorName?: string) => {
    if (vendorName && setSearchQuery) {
      setSearchQuery(vendorName);
    }
    setActiveTab('Vendors');
    localStorage.setItem('activeTab', 'Vendors');
  };

  // Filtered invoices table logic
  const filteredInvoices = allInvoices.filter(inv => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(tableSearch.toLowerCase()) ||
      inv.vendorName.toLowerCase().includes(tableSearch.toLowerCase()) ||
      (inv.poNumber && inv.poNumber.toLowerCase().includes(tableSearch.toLowerCase()));
    
    if (!matchesSearch) return false;

    if (tableFilter === 'email') return inv.source === 'email';
    if (tableFilter === 'upload') return inv.source === 'upload';
    if (tableFilter === 'overdue') return inv.status.toLowerCase() === 'overdue';
    return true;
  });

  const totalCalculatedSpend = allInvoices.reduce((acc, curr) => acc + (curr.rawAmount || 0), 0);
  const maxFunnelCount = funnel.length > 0 ? Math.max(...funnel.map(f => f.count), 1) : 1;

  return (
    <div className="flex flex-col gap-8 animate-in fade-in pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest border border-border-low-contrast rounded-2xl p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-fixed text-primary">
              <Sparkles className="w-3.5 h-3.5" />
              Live AI Pipeline
            </span>
            <span className="flex items-center gap-1.5 text-xs text-status-success font-medium">
              <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
              Synced with Zoho Books
            </span>
          </div>
          <h2 className="font-headline-lg text-2xl md:text-3xl font-bold text-on-surface tracking-tight">
            Automation Overview & Invoice Dashboard
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Real-time tracking of invoices ingested via Zoho Mail emails vs direct PDF uploads, matched PO numbers, and vendor aggregates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-on-surface-variant font-medium hidden sm:inline">
            Updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <div className="flex items-center bg-surface-subtle border border-border-low-contrast rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-xs text-on-surface-variant font-medium mr-2">Timeframe:</span>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-on-surface outline-none cursor-pointer"
            >
              <option value="1">Today</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="All">All Time</option>
            </select>
          </div>

          <button
            onClick={fetchDashboardData}
            title="Refresh now"
            className="p-2 bg-white border border-border-low-contrast rounded-xl hover:bg-surface-subtle text-on-surface-variant hover:text-primary transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Attention Alert Banner if any */}
      {attention.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-900 block">Requires Attention:</span>
              <span className="text-xs text-amber-800">
                {attention.map(a => `${a.count} ${a.type}`).join(' • ')}
              </span>
            </div>
          </div>
          <button
            onClick={() => setTableFilter('overdue')}
            className="text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors"
          >
            Review Overdue Invoices
          </button>
        </div>
      )}

      {/* Top High-Level Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoices in Books */}
        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-2xl p-5 shadow-sm hover:border-primary/40 hover:-translate-y-0.5 transition-all">
          <div className="flex justify-between items-center text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invoices Created</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-on-surface">{allInvoices.length}</span>
            <span className="text-xs font-medium text-status-success">In Zoho Books</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border-low-contrast flex items-center justify-between text-xs text-on-surface-variant">
            <span>Spend Recorded:</span>
            <span className="font-semibold text-on-surface">${totalCalculatedSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        {/* Processed via Email */}
        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-2xl p-5 shadow-sm hover:border-blue-400 hover:-translate-y-0.5 transition-all">
          <div className="flex justify-between items-center text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Processed via Email</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-700">{channels.email.totalBillsCreated}</span>
            <span className="text-xs font-medium text-blue-600">Invoices</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border-low-contrast flex items-center justify-between text-xs text-on-surface-variant">
            <span>Emails Fetched:</span>
            <span className="font-semibold text-on-surface">{channels.email.totalEmailsFetched} events</span>
          </div>
        </div>

        {/* Processed via PDF Upload */}
        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-2xl p-5 shadow-sm hover:border-indigo-400 hover:-translate-y-0.5 transition-all">
          <div className="flex justify-between items-center text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Processed via PDF</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-700">{channels.pdf.totalBillsCreated}</span>
            <span className="text-xs font-medium text-indigo-600">Invoices</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border-low-contrast flex items-center justify-between text-xs text-on-surface-variant">
            <span>Direct Uploads:</span>
            <span className="font-semibold text-on-surface">{channels.pdf.totalUploaded} files</span>
          </div>
        </div>

        {/* Vendors Active */}
        <div className="bg-surface-container-lowest border border-border-low-contrast rounded-2xl p-5 shadow-sm hover:border-purple-400 hover:-translate-y-0.5 transition-all">
          <div className="flex justify-between items-center text-on-surface-variant mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Vendors</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-purple-700">{vendorBreakdown.length}</span>
            <span className="text-xs font-medium text-purple-600">Vendors</span>
          </div>
          <div className="mt-3 pt-3 border-t border-border-low-contrast flex items-center justify-between text-xs text-on-surface-variant">
            <span>Linked POs:</span>
            <span className="font-semibold text-on-surface">
              {vendorBreakdown.reduce((sum, v) => sum + (v.poNumbers?.length || 0), 0)} POs
            </span>
          </div>
        </div>
      </div>

      {/* Ingestion Channels Breakdown Section (Requested: email vs PDF detail) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Processing Channel Card */}
        <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">Email Ingestion (Zoho Mail)</h3>
                  <p className="text-xs text-on-surface-variant">Automated unread email attachment fetcher & AI extractor</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                {channels.email.totalBillsCreated} Invoices
              </span>
            </div>

            {/* Email Statistics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5 p-3.5 bg-blue-50/50 rounded-xl border border-blue-100">
              <div>
                <span className="text-[11px] text-blue-800 font-medium block">Total Emails Scanned</span>
                <span className="text-xl font-bold text-blue-950">{channels.email.totalEmailsFetched}</span>
              </div>
              <div>
                <span className="text-[11px] text-blue-800 font-medium block">Invoices Created</span>
                <span className="text-xl font-bold text-blue-950">{channels.email.totalBillsCreated}</span>
              </div>
              <div>
                <span className="text-[11px] text-blue-800 font-medium block">Channel Spend</span>
                <span className="text-xl font-bold text-blue-950">
                  ${channels.email.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Recent Email Invoices preview list */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2.5">
                Invoices Created Through Email:
              </p>
              <div className="space-y-2">
                {channels.email.invoices.length > 0 ? (
                  channels.email.invoices.map((inv, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleOpenInvoiceModal(inv)}
                      className="p-3 bg-surface-subtle hover:bg-blue-50/60 border border-border-low-contrast rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                          #
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary group-hover:underline">{inv.invoiceNumber}</span>
                            {inv.poNumber && inv.poNumber !== 'N/A' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-border-low-contrast text-on-surface-variant font-medium">
                                PO: {inv.poNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant truncate max-w-[200px]">{inv.vendorName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-on-surface">{inv.amount}</div>
                        <span className={`text-[10px] font-semibold uppercase ${inv.status === 'overdue' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic p-3 text-center">No invoices processed via email yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border-low-contrast flex items-center justify-between">
            <button
              onClick={triggerEmailFetch}
              disabled={isTriggering}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              {isTriggering ? 'Scanning Zoho Inbox...' : 'Fetch New Email Invoices'}
            </button>
            <button
              onClick={() => { setTableFilter('email'); }}
              className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
            >
              Filter Table Below <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Direct PDF Upload Channel Card */}
        <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">Direct PDF Upload Channel</h3>
                  <p className="text-xs text-on-surface-variant">Manual drag-and-drop ingestion & OCR-based data extraction</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                {channels.pdf.totalBillsCreated} Invoices
              </span>
            </div>

            {/* PDF Statistics Grid */}
            <div className="grid grid-cols-3 gap-3 mb-5 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
              <div>
                <span className="text-[11px] text-indigo-800 font-medium block">Total PDFs Uploaded</span>
                <span className="text-xl font-bold text-indigo-950">{channels.pdf.totalUploaded}</span>
              </div>
              <div>
                <span className="text-[11px] text-indigo-800 font-medium block">Invoices Created</span>
                <span className="text-xl font-bold text-indigo-950">{channels.pdf.totalBillsCreated}</span>
              </div>
              <div>
                <span className="text-[11px] text-indigo-800 font-medium block">Channel Spend</span>
                <span className="text-xl font-bold text-indigo-950">
                  ${channels.pdf.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>

            {/* Recent PDF Invoices preview list */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2.5">
                Invoices Created Through PDF Upload:
              </p>
              <div className="space-y-2">
                {channels.pdf.invoices.length > 0 ? (
                  channels.pdf.invoices.map((inv, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleOpenInvoiceModal(inv)}
                      className="p-3 bg-surface-subtle hover:bg-indigo-50/60 border border-border-low-contrast rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                          #
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary group-hover:underline">{inv.invoiceNumber}</span>
                            {inv.poNumber && inv.poNumber !== 'N/A' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-white border border-border-low-contrast text-on-surface-variant font-medium">
                                PO: {inv.poNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-on-surface-variant truncate max-w-[200px]">{inv.vendorName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold text-on-surface">{inv.amount}</div>
                        <span className={`text-[10px] font-semibold uppercase ${inv.status === 'overdue' ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-on-surface-variant italic p-3 text-center">No invoices uploaded via PDF yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-border-low-contrast flex items-center justify-between">
            <button
              onClick={() => { setActiveTab('Ingest invoice'); localStorage.setItem('activeTab', 'Ingest invoice'); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload New Invoice PDF
            </button>
            <button
              onClick={() => { setTableFilter('upload'); }}
              className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
            >
              Filter Table Below <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Vendor Aggregations Section (Requested: "if four invoices created for vendor, show 4 invoices created for this vendor") */}
      <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-xl text-on-surface">Vendor Invoice Intelligence</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface-variant">
                {vendorBreakdown.length} Vendors
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Complete breakdown of invoices and associated PO numbers for each vendor.
            </p>
          </div>
          <button
            onClick={() => navigateToVendors()}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer self-start sm:self-auto"
          >
            Manage All Vendors <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendorBreakdown.map((vendor, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl border border-border-low-contrast bg-surface-subtle hover:bg-white hover:border-primary/40 hover:shadow-md transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {vendor.vendorName.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-on-surface line-clamp-1" title={vendor.vendorName}>
                        {vendor.vendorName}
                      </h4>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                        {vendor.totalInvoices} {vendor.totalInvoices === 1 ? 'invoice' : 'invoices'} created
                      </span>
                    </div>
                  </div>
                </div>

                {/* Channel badges */}
                <div className="flex items-center gap-2 mb-3">
                  {vendor.emailInvoices > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 flex items-center gap-1">
                      <Mail className="w-2.5 h-2.5" /> {vendor.emailInvoices} via Email
                    </span>
                  )}
                  {vendor.pdfInvoices > 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800 flex items-center gap-1">
                      <FileText className="w-2.5 h-2.5" /> {vendor.pdfInvoices} via PDF
                    </span>
                  )}
                </div>

                {/* PO numbers */}
                <div className="mb-3">
                  <span className="text-[11px] text-on-surface-variant font-medium block mb-1">Associated PO Numbers:</span>
                  <div className="flex flex-wrap gap-1">
                    {vendor.poNumbers && vendor.poNumbers.length > 0 ? (
                      vendor.poNumbers.map((po, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => navigateToPOs(po)}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-white border border-border-low-contrast hover:border-primary text-on-surface hover:text-primary transition-colors cursor-pointer"
                        >
                          {po}
                        </button>
                      ))
                    ) : (
                      <span className="text-[11px] text-on-surface-variant italic">No PO assigned</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-border-low-contrast flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-on-surface-variant block">Total Invoiced Spend</span>
                  <span className="font-bold text-sm text-on-surface">{vendor.formattedSpend}</span>
                </div>
                <button
                  onClick={() => setSelectedVendorForModal(vendor)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-border-low-contrast hover:bg-primary hover:text-white transition-colors cursor-pointer"
                >
                  View Invoices ({vendor.totalInvoices})
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Complete Invoices Master Table (Requested: clickable navigation, invoice #, PO #, vendor, email vs PDF) */}
      <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="font-bold text-xl text-on-surface">All Processed Invoices & Accounting Records</h3>
            <p className="text-xs text-on-surface-variant mt-1">
              Click on any row to open the complete invoice details, linked PO, and Zoho Books record.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center bg-surface-subtle p-1 rounded-xl border border-border-low-contrast">
              <button
                onClick={() => setTableFilter('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border-none cursor-pointer ${
                  tableFilter === 'all' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface bg-transparent'
                }`}
              >
                All ({allInvoices.length})
              </button>
              <button
                onClick={() => setTableFilter('email')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border-none cursor-pointer flex items-center gap-1 ${
                  tableFilter === 'email' ? 'bg-white text-blue-700 shadow-sm' : 'text-on-surface-variant hover:text-on-surface bg-transparent'
                }`}
              >
                <Mail className="w-3 h-3" /> Via Email ({channels.email.totalBillsCreated})
              </button>
              <button
                onClick={() => setTableFilter('upload')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all border-none cursor-pointer flex items-center gap-1 ${
                  tableFilter === 'upload' ? 'bg-white text-indigo-700 shadow-sm' : 'text-on-surface-variant hover:text-on-surface bg-transparent'
                }`}
              >
                <FileText className="w-3 h-3" /> Via PDF ({channels.pdf.totalBillsCreated})
              </button>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice, vendor, PO..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-surface-subtle border border-border-low-contrast rounded-xl text-xs outline-none focus:border-primary w-48 md:w-60"
              />
            </div>
          </div>
        </div>

        {/* Invoices Table */}
        <div className="overflow-x-auto rounded-xl border border-border-low-contrast">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-subtle border-b border-border-low-contrast text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Ingestion Channel</th>
                <th className="py-3 px-4">Vendor Name</th>
                <th className="py-3 px-4">PO Number</th>
                <th className="py-3 px-4">Bill Date</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-low-contrast text-xs">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => handleOpenInvoiceModal(inv)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 font-bold text-primary group-hover:underline">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      {inv.source === 'email' ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <Mail className="w-3 h-3" /> Zoho Mail
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <FileText className="w-3 h-3" /> PDF Upload
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-on-surface">
                      {inv.vendorName}
                    </td>
                    <td className="py-3.5 px-4">
                      {inv.poNumber && inv.poNumber !== 'N/A' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigateToPOs(inv.poNumber); }}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-surface-container hover:bg-primary-fixed text-on-surface hover:text-primary transition-colors cursor-pointer border-none"
                        >
                          {inv.poNumber}
                        </button>
                      ) : (
                        <span className="text-on-surface-variant italic text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-on-surface-variant">
                      {inv.date}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-on-surface">
                      {inv.amount}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        inv.status.toLowerCase() === 'paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        inv.status.toLowerCase() === 'overdue' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenInvoiceModal(inv); }}
                        className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-fixed rounded-lg transition-colors bg-transparent border-none cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant italic">
                    No matching invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Spend by Vendor Chart & Processing Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processing Funnel */}
        <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-lg text-on-surface mb-1">Pipeline Automation Funnel</h3>
            <p className="text-xs text-on-surface-variant mb-6">Stage-by-stage progression from unread email intake to Zoho Books Bill creation.</p>
            
            <div className="space-y-4">
              {funnel.map((stage, idx) => {
                const widthPercent = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0;
                return (
                  <div key={idx} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-on-surface">{stage.stage}</span>
                      <span className="font-bold text-on-surface">{stage.count}</span>
                    </div>
                    <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-primary h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(widthPercent, 4)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-border-low-contrast flex items-center justify-between text-xs text-on-surface-variant">
            <span>Overall AI Conversion Rate:</span>
            <span className="font-bold text-status-success">
              {funnel.length > 0 && funnel[0].count > 0 
                ? `${Math.round(((funnel[funnel.length - 1]?.count || 0) / funnel[0].count) * 100)}%` 
                : '100%'}
            </span>
          </div>
        </div>

        {/* Spend by Vendor Bar Chart */}
        <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg text-on-surface">Top Vendor Spend Distribution</h3>
                <p className="text-xs text-on-surface-variant">Total cumulative expenditure recorded across bills.</p>
              </div>
              <button
                onClick={() => navigateToVendors()}
                className="text-xs font-semibold text-primary hover:underline bg-transparent border-none cursor-pointer"
              >
                View All
              </button>
            </div>

            <div className="h-[220px] w-full">
              {spendByVendor.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={spendByVendor} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(val) => `$${Number(val).toLocaleString()}`} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#424656' }} />
                    <Tooltip
                      formatter={(val: any) => [`$${Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Spend']}
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #E2E8F0', fontSize: '12px' }}
                    />
                    <Bar dataKey="spend" radius={[0, 6, 6, 0]} barSize={24}>
                      {spendByVendor.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#004bca' : '#4380ec'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-on-surface-variant italic">
                  No spending records available.
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border-low-contrast flex items-center justify-between text-xs text-on-surface-variant">
            <span>Primary Vendor:</span>
            <span className="font-semibold text-on-surface">{spendByVendor[0]?.name || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Live Pipeline Recent Jobs Activity */}
      <div className="bg-white border border-border-low-contrast rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-xl text-on-surface">Live Automation Queue & Execution Log</h3>
            <p className="text-xs text-on-surface-variant mt-1">Real-time status of recent n8n workflow triggers and AI parsing runs.</p>
          </div>
          <button
            onClick={() => { setActiveTab('Ingest invoice'); localStorage.setItem('activeTab', 'Ingest invoice'); }}
            className="text-xs font-semibold text-primary hover:underline bg-transparent border-none cursor-pointer"
          >
            Open Queue Monitor
          </button>
        </div>

        <div className="space-y-3">
          {recentJobs.length > 0 ? (
            recentJobs.slice(0, 6).map((job) => (
              <div
                key={job.jobId}
                className="p-4 rounded-xl border border-border-low-contrast bg-surface-subtle flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    job.source === 'email' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {job.source === 'email' ? <Mail className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-on-surface">{job.fileName || job.jobId}</span>
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold uppercase bg-white border border-border-low-contrast text-on-surface-variant">
                        {job.source}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 max-w-xl truncate">
                      {job.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  <span className="text-[11px] text-on-surface-variant">
                    {job.updatedAt ? new Date(job.updatedAt).toLocaleTimeString() : ''}
                  </span>
                  <button
                    onClick={() => setSelectedJob(job)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-border-low-contrast hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    View Logs
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-on-surface-variant italic p-4 text-center">No recent background jobs executed.</p>
          )}
        </div>
      </div>

      {/* MODAL 1: Invoice Details & Deep Navigation Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-border-low-contrast rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-border-low-contrast flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-primary/10 text-primary rounded-lg">
                  <Receipt className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">Invoice Details — {selectedInvoice.invoiceNumber}</h3>
                  <p className="text-xs text-on-surface-variant">Synced with Zoho Books API</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Highlight summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-white rounded-xl border border-border-low-contrast">
                  <span className="text-[11px] text-on-surface-variant font-medium block">Total Amount</span>
                  <span className="text-lg font-bold text-on-surface">{selectedInvoice.amount}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-border-low-contrast">
                  <span className="text-[11px] text-on-surface-variant font-medium block">Ingestion Source</span>
                  <span className="text-sm font-bold text-primary capitalize flex items-center gap-1">
                    {selectedInvoice.source === 'email' ? <Mail className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                    {selectedInvoice.source === 'email' ? 'Zoho Mail' : 'PDF Upload'}
                  </span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-border-low-contrast">
                  <span className="text-[11px] text-on-surface-variant font-medium block">Associated PO</span>
                  <span className="text-sm font-bold text-on-surface font-mono">{selectedInvoice.poNumber || 'N/A'}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-border-low-contrast">
                  <span className="text-[11px] text-on-surface-variant font-medium block">Payment Status</span>
                  <span className={`text-xs font-bold uppercase ${selectedInvoice.status === 'overdue' ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {selectedInvoice.status}
                  </span>
                </div>
              </div>

              {/* Vendor & Dates info */}
              <div className="p-4 bg-white rounded-xl border border-border-low-contrast space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-on-surface-variant">Vendor Name:</span>
                  <span className="font-bold text-on-surface">{selectedInvoice.vendorName}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-on-surface-variant">Bill Date:</span>
                  <span className="font-semibold text-on-surface">{selectedInvoice.date}</span>
                </div>
                {selectedInvoice.dueDate && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant">Due Date:</span>
                    <span className="font-semibold text-on-surface">{selectedInvoice.dueDate}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-on-surface-variant">Zoho Internal Bill ID:</span>
                  <span className="font-mono text-on-surface">{selectedInvoice.id}</span>
                </div>
              </div>

              {/* Line items if fetched from Zoho Books */}
              {isBillLoading ? (
                <div className="p-6 text-center text-xs text-on-surface-variant">Loading line items from Zoho Books...</div>
              ) : fullBillDetails?.line_items && fullBillDetails.line_items.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-2">Itemized Line Items</h4>
                  <div className="border border-border-low-contrast rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-subtle border-b border-border-low-contrast text-[11px] text-on-surface-variant">
                        <tr>
                          <th className="py-2 px-3">Item / Description</th>
                          <th className="py-2 px-3 text-right">Qty</th>
                          <th className="py-2 px-3 text-right">Rate</th>
                          <th className="py-2 px-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-low-contrast">
                        {fullBillDetails.line_items.map((item: any, i: number) => (
                          <tr key={i}>
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-on-surface block">{item.name || item.description || 'Line Item'}</span>
                              {item.account_name && <span className="text-[10px] text-outline block">{item.account_name}</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right text-on-surface">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-on-surface">${item.rate}</td>
                            <td className="py-2.5 px-3 text-right font-bold text-on-surface">${item.item_total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Navigation Actions Footer */}
            <div className="px-6 py-4 border-t border-border-low-contrast bg-surface-subtle flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelectedInvoice(null); navigateToBills(selectedInvoice.invoiceNumber); }}
                  className="px-3.5 py-2 bg-primary hover:bg-primary-container text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Bills
                </button>
                {selectedInvoice.poNumber && selectedInvoice.poNumber !== 'N/A' && (
                  <button
                    onClick={() => { setSelectedInvoice(null); navigateToPOs(selectedInvoice.poNumber); }}
                    className="px-3.5 py-2 bg-white hover:bg-surface-subtle border border-border-low-contrast text-on-surface text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    View Purchase Order
                  </button>
                )}
                <button
                  onClick={() => { setSelectedInvoice(null); navigateToVendors(selectedInvoice.vendorName); }}
                  className="px-3.5 py-2 bg-white hover:bg-surface-subtle border border-border-low-contrast text-on-surface text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Vendor Profile
                </button>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-white border border-border-low-contrast hover:bg-surface-subtle rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Vendor Invoices Modal */}
      {selectedVendorForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-border-low-contrast rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-border-low-contrast flex items-center justify-between bg-surface-subtle">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  {selectedVendorForModal.vendorName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-on-surface">{selectedVendorForModal.vendorName}</h3>
                  <p className="text-xs text-on-surface-variant">
                    {selectedVendorForModal.totalInvoices} {selectedVendorForModal.totalInvoices === 1 ? 'Invoice' : 'Invoices'} • {selectedVendorForModal.formattedSpend} Total Spend
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedVendorForModal(null)}
                className="text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="space-y-2">
                {selectedVendorForModal.invoices.map((inv, i) => (
                  <div
                    key={i}
                    onClick={() => { setSelectedVendorForModal(null); handleOpenInvoiceModal(inv); }}
                    className="p-3.5 bg-white border border-border-low-contrast rounded-xl hover:border-primary/50 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-primary">{inv.invoiceNumber}</span>
                        <span className={`px-2 py-0.2 rounded-full text-[10px] font-semibold ${
                          inv.source === 'email' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {inv.source === 'email' ? '📧 Email' : '📄 PDF Upload'}
                        </span>
                        {inv.poNumber && inv.poNumber !== 'N/A' && (
                          <span className="font-mono text-[10px] bg-surface-container px-1.5 py-0.5 rounded">
                            {inv.poNumber}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-on-surface-variant block mt-1">Date: {inv.date}</span>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-sm text-on-surface block">{inv.amount}</span>
                      <span className="text-[10px] uppercase font-semibold text-amber-600">{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border-low-contrast bg-surface-subtle flex justify-between items-center">
              <button
                onClick={() => { setSelectedVendorForModal(null); navigateToVendors(selectedVendorForModal.vendorName); }}
                className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl cursor-pointer border-none"
              >
                Open Vendor Full Profile
              </button>
              <button
                onClick={() => setSelectedVendorForModal(null)}
                className="px-4 py-2 bg-white border border-border-low-contrast rounded-xl text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Job Execution Log Modal */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-border-low-contrast rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95">
            <div className="px-6 py-4 border-b border-border-low-contrast flex items-center justify-between bg-surface-subtle">
              <h3 className="font-bold text-base text-on-surface">Job Logs — {selectedJob.fileName || selectedJob.jobId}</h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto font-mono text-xs bg-[#1e1e1e] text-[#d4d4d4] flex-1">
              {selectedJob.logs && selectedJob.logs.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedJob.logs.map((log: any, idx: number) => (
                    <div key={idx} className="flex gap-3">
                      <span className="text-[#858585] shrink-0">[{new Date(log.time).toLocaleTimeString()}]</span>
                      <span className={log.message?.toLowerCase().includes('error') ? 'text-[#f48771]' : log.message?.includes('SUCCESS') ? 'text-[#89d185]' : 'text-[#d4d4d4]'}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-[#858585] py-8">No logs recorded for this job.</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border-low-contrast bg-surface-subtle flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 text-xs font-semibold text-on-surface bg-white border border-border-low-contrast hover:bg-surface-subtle rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
