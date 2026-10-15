import { API_BASE_URL } from './config/api';
import React, { useState, useEffect, useRef } from 'react';
import { AuthView } from './components/AuthView';
import { DashboardView } from './components/DashboardView';
import './index.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
export default function App() {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('activeTab') || 'Dashboard');
  const [ingestView, setIngestView] = useState<'email' | 'upload'>('email');
  const [searchQuery, setSearchQuery] = useState('');

  const [user, setUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoApprove, setAutoApprove] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  useEffect(() => {
    const fetchPendingApprovals = async () => {
      try {
        const res = await fetch(${ API_BASE_URL });
        const poRes = await fetch(${ API_BASE_URL });
        let count = 0;
        if (res.ok) {
          const data = await res.json();
          count += data.filter((a: any) => a.status === 'Pending').length;
        }
        if (poRes.ok) {
          const data = await poRes.json();
          count += data.filter((a: any) => a.status === 'Pending').length;
        }
        setPendingApprovalsCount(count);
      } catch (err) { }
    };
    if (user) {
      fetchPendingApprovals();
      const interval = setInterval(fetchPendingApprovals, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetch(${ API_BASE_URL }, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) setUser(data.user);
        })
        .catch(() => { })
        .finally(() => setIsAuthChecking(false));
    } else {
      setIsAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    fetch(${ API_BASE_URL })
      .then(res => res.json())
      .then(setNotifications)
      .catch(() => { });
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    setShowProfileMenu(false);
  };

  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin text-primary material-symbols-outlined text-4xl">sync</div></div>;

  if (!user) {
    return <AuthView onLogin={setUser} />;
  }

  const navItems = [
    { name: 'Dashboard', icon: 'dashboard' },
    { name: 'Ingest invoice', icon: 'upload_file' },
    { name: 'Connections', icon: 'hub' },
    { name: 'Approvals', icon: 'fact_check' },
    { name: 'Audit logs', icon: 'manage_search' },
    { name: 'Vendors', icon: 'store' },
    { name: 'Bills', icon: 'receipt_long' },
    { name: 'Purchase orders', icon: 'shopping_cart' },
    { name: 'Chart of accounts', icon: 'account_balance' },
  ];

  return (
    <div className="bg-background text-on-surface font-body-md selection:bg-primary-fixed min-h-screen">
      {/* Side Navigation */}
      <aside className="fixed left-0 top-0 h-screen w-sidebar-width bg-surface-container-lowest border-r border-border-low-contrast flex flex-col py-stack-lg gap-stack-md px-4 z-50">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-on-primary">
            <span className="material-symbols-outlined text-sm">auto_awesome</span>
          </div>
          <div>
            <h1 className="font-headline-sm text-headline-sm text-primary">Invoicely</h1>
            <p className="text-[10px] font-medium uppercase tracking-widest text-on-surface-variant opacity-70">AI Automation</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => {
                  setActiveTab(item.name);
                  localStorage.setItem('activeTab', item.name);
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-200 text-left ${isActive
                    ? 'bg-surface-container text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-subtle'
                  }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="font-label-md text-label-md flex-1">{item.name}</span>
                {item.name === 'Approvals' && pendingApprovalsCount > 0 && (
                  <span className="bg-error text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">{pendingApprovalsCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-2">
          <div className="p-3 bg-surface-subtle rounded-xl border border-border-low-contrast">
            <p className="text-[11px] font-semibold text-primary mb-1">PRO PLAN</p>
            <p className="text-[12px] text-on-surface-variant mb-3">85% of monthly invoice credits used.</p>
            <div className="w-full bg-surface-container-high h-1 rounded-full overflow-hidden">
              <div className="bg-primary h-full w-[85%]"></div>
            </div>
          </div>
        </div>
      </aside>

      {/* Top App Bar */}
      <header className="fixed top-0 right-0 left-0 h-16 bg-surface border-b border-border-low-contrast flex items-center justify-between pl-[232px] pr-8 z-40">
        <div className="flex items-center bg-surface-subtle border border-border-low-contrast rounded-full px-4 py-1.5 w-full max-w-md">
          <span className="material-symbols-outlined text-outline text-[20px] mr-2">search</span>
          <input className="bg-transparent border-none focus:ring-0 text-body-md w-full placeholder:text-on-surface-variant outline-none" placeholder={
            activeTab === 'Vendors' ? 'Search vendors, tax IDs, or categories...' :
              activeTab === 'Bills' ? 'Search bills, vendors or numbers...' :
                activeTab === 'Purchase orders' ? 'Search purchase orders...' :
                  activeTab === 'Chart of accounts' ? 'Search accounts...' :
                    'Search connections or settings...'
          } type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="relative" ref={notificationsRef}>
            <button onClick={() => setShowNotifications(!showNotifications)} className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-subtle rounded-full transition-colors relative cursor-pointer bg-transparent border-none">
              <span className="material-symbols-outlined">notifications</span>
              {(notifications.length > 0 || pendingApprovalsCount > 0) && <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-surface animate-pulse"></span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest border border-border-low-contrast rounded-xl shadow-lg z-50 py-2 animate-in fade-in zoom-in-95 max-h-96 overflow-y-auto">
                <div className="px-4 py-2 border-b border-border-low-contrast mb-1 flex justify-between items-center">
                  <p className="text-body-sm font-semibold">Notifications</p>
                  <button onClick={() => setNotifications([])} className="text-[11px] text-primary hover:underline bg-transparent border-none cursor-pointer">Mark all read</button>
                </div>
                {notifications.length === 0 ? (
                  <p className="px-4 py-6 text-center text-body-sm text-on-surface-variant">No new notifications</p>
                ) : notifications.map((n, i) => (
                  <div key={i} className="px-4 py-3 hover:bg-surface-subtle border-b border-border-low-contrast last:border-0 cursor-pointer transition-colors">
                    <p className="text-body-sm font-medium text-on-surface">{n.title}</p>
                    <p className="text-[12px] text-on-surface-variant mt-0.5">{n.desc}</p>
                    <p className="text-[10px] text-outline mt-1">{new Date(n.time).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:bg-surface-subtle rounded-full transition-colors cursor-pointer bg-transparent border-none">
            <span className="material-symbols-outlined">settings</span>
          </button>

          <div className="h-8 w-[1px] bg-border-low-contrast mx-1"></div>
          <div className="relative" ref={profileMenuRef}>
            <div
              className="flex items-center gap-3 cursor-pointer group p-1.5 rounded-lg hover:bg-surface-subtle transition-colors"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <div className="text-right">
                <p className="font-label-md text-label-md text-on-surface group-hover:text-primary transition-colors">{user.name}</p>
                <p className="text-[11px] text-on-surface-variant">Admin Account</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold border border-border-low-contrast">
                {user.name.charAt(0)}
              </div>
            </div>

            {showProfileMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-surface-container-lowest border border-border-low-contrast rounded-xl shadow-lg z-50 py-2 animate-in fade-in zoom-in-95">
                <div className="px-4 py-2 border-b border-border-low-contrast mb-1">
                  <p className="text-body-sm font-semibold truncate">{user.name}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{user.email}</p>
                </div>
                <button onClick={() => { setShowProfileMenu(false); setShowEditProfile(true); }} className="w-full text-left px-4 py-2 text-label-md text-on-surface hover:bg-surface-subtle transition-colors bg-transparent border-none cursor-pointer flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                  Edit Profile
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-label-md text-error hover:bg-error-container/20 transition-colors bg-transparent border-none cursor-pointer flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="ml-[200px] pt-24 pb-12 px-8 min-h-screen">
        <div className="max-w-container-max-width mx-auto">
          {activeTab === 'Ingest invoice' && (
            <IngestInvoiceContent ingestView={ingestView} setIngestView={setIngestView} />
          )}
          {activeTab === 'Dashboard' && (
            <DashboardView setActiveTab={setActiveTab} setSearchQuery={setSearchQuery} />
          )}
          {activeTab === 'Approvals' && (
            <ApprovalsContent searchQuery={searchQuery} user={user} />
          )}
          {activeTab === 'Audit logs' && (
            <AuditLogsContent searchQuery={searchQuery} />
          )}
          {activeTab === 'Connections' && (
            <ConnectionsContent searchQuery={searchQuery} />
          )}
          {activeTab === 'Vendors' && (
            <VendorsContent searchQuery={searchQuery} />
          )}
          {activeTab === 'Bills' && (
            <BillsContent searchQuery={searchQuery} />
          )}
          {activeTab === 'Purchase orders' && (
            <PurchaseOrdersContent searchQuery={searchQuery} />
          )}
          {activeTab === 'Chart of accounts' && (
            <ChartOfAccountsContent searchQuery={searchQuery} />
          )}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-surface border border-border-low-contrast rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-border-low-contrast flex items-center justify-between bg-surface-subtle">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">settings</span>
                Settings
              </h3>
              <button onClick={() => setShowSettings(false)} className="text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer flex p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <p className="text-body-md text-on-surface-variant mb-6">Manage your application preferences here.</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface">Email Notifications</span>
                  <input type="checkbox" checked={emailNotifications} onChange={(e) => setEmailNotifications(e.target.checked)} className="accent-primary w-4 h-4 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface">Auto-Approve Low Amounts</span>
                  <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="accent-primary w-4 h-4 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface">Dark Mode Theme</span>
                  <input type="checkbox" checked={darkMode} onChange={(e) => setDarkMode(e.target.checked)} className="accent-primary w-4 h-4 cursor-pointer" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-border-low-contrast bg-surface-subtle flex justify-end gap-3">
              <button onClick={() => setShowSettings(false)} className="px-5 py-2 font-label-md text-label-md border border-border-low-contrast rounded-lg text-on-surface hover:bg-surface-subtle cursor-pointer bg-white">Cancel</button>
              <button onClick={() => setShowSettings(false)} className="px-5 py-2 font-label-md text-label-md bg-primary text-white rounded-lg hover:bg-primary-container cursor-pointer border-none shadow-sm">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in">
          <div className="bg-surface border border-border-low-contrast rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-border-low-contrast flex items-center justify-between bg-surface-subtle">
              <h3 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                Edit Profile
              </h3>
              <button onClick={() => setShowEditProfile(false)} className="text-on-surface-variant hover:text-on-surface bg-transparent border-none cursor-pointer flex p-1">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">Full Name</label>
                <input type="text" defaultValue={user?.name || ''} className="w-full bg-surface-container-lowest border border-border-low-contrast rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary transition-colors" />
              </div>
              <div className="mb-4">
                <label className="block text-label-sm font-label-sm text-on-surface-variant mb-1 uppercase tracking-wider">Email Address</label>
                <input type="email" defaultValue={user?.email || ''} className="w-full bg-surface-container-lowest border border-border-low-contrast rounded-lg px-3 py-2 text-body-md outline-none focus:border-primary transition-colors" />
              </div>
            </div>
            <div className="p-4 border-t border-border-low-contrast bg-surface-subtle flex justify-end gap-3">
              <button onClick={() => setShowEditProfile(false)} className="px-5 py-2 font-label-md text-label-md border border-border-low-contrast rounded-lg text-on-surface hover:bg-surface-subtle cursor-pointer bg-white">Cancel</button>
              <button onClick={() => setShowEditProfile(false)} className="px-5 py-2 font-label-md text-label-md bg-primary text-white rounded-lg hover:bg-primary-container cursor-pointer border-none shadow-sm">Save Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IngestInvoiceContent({ ingestView, setIngestView }: { ingestView: 'email' | 'upload', setIngestView: (v: 'email' | 'upload') => void }) {
  const [jobs, setJobs] = useState<any[]>([]);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);


  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}