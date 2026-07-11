import axios from 'axios'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, Banknote, BookOpen, CalendarDays, CheckCircle2,
  Clock3, Download, Edit3, FileSpreadsheet, FileText, Landmark, LayoutDashboard,
  Lock, LogOut, Menu, Plus, ReceiptText, RefreshCw, Search, Settings, Tags,
  Trash2, Upload, Users, WalletCards, ShoppingCart, Package, Printer,
} from 'lucide-react'
import './App.css'

const ChartPanel = lazy(() => import('./ChartPanel.jsx'))
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const navItems = [
  ['Dashboard', LayoutDashboard], ['Transactions', BookOpen], ['Categories', Tags],
  ['Parties/Vendors', Users], ['Sales', ShoppingCart], ['Stock', Package],
  ['Settings', Settings], ['Backup', Download],
]
const pageCopy = {
  Dashboard: 'Business overview, account balances, and recent money movement.',
  Transactions: 'Record income and expenses, filter the ledger, and manage dues.',
  Categories: 'Organize income and expenses so reports stay easy to scan.',
  'Parties/Vendors': 'Keep customers, vendors, staff, and other parties in one place.',
  Sales: 'Track product sales, record custom sales, and manage sales revenue.',
  Stock: 'Monitor inventory levels, view total, sold, and remaining stock.',
  Settings: 'Manage accounts, reminders, and admin access.',
  Backup: 'Create and review database backups.',
}

function currency(value) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

let csrfTokenCached = '';

async function prepareCsrf() {
  const response = await axios.get(`${apiBase}/auth/csrf/`, { withCredentials: true })
  if (response.data && response.data.csrfToken) {
    csrfTokenCached = response.data.csrfToken;
  }
}

function emptyTransaction(type = 'income') {
  return { transaction_type: type, title: '', amount: '', category: '', account: '', party: '', payment_method: 'cash', reference_number: '', notes: '', date: new Date().toISOString().slice(0, 10), attachment: null }
}

function formatLabel(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default function App() {
  const [auth, setAuth] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerForm, setRegisterForm] = useState({ business_name: '', owner_name: '', email: '', phone: '', password: '' })
  const [active, setActive] = useState('Dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [data, setData] = useState({ dashboard: null, reports: null, accounts: [], categories: [], parties: [], transactions: [], dues: [], notes: [], backups: [], sales: [], stock: [] })
  const [loaded, setLoaded] = useState({ refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false, Sales: false, Stock: false })
  const [filters, setFilters] = useState({ keyword: '', category: '', payment_method: '', start: '', end: '', min_amount: '', max_amount: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [txForm, setTxForm] = useState(emptyTransaction())
  const [editingTx, setEditingTx] = useState(null)

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: apiBase, withCredentials: true })
    instance.interceptors.request.use((config) => {
      let token = csrfTokenCached;
      if (!token) {
        const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/)
        if (match) token = match[1]
      }
      if (token) config.headers['X-CSRFToken'] = token
      return config
    })
    return instance
  }, [])
  const incomeCategories = useMemo(() => data.categories.filter((c) => c.category_type === 'income'), [data.categories])
  const expenseCategories = useMemo(() => data.categories.filter((c) => c.category_type === 'expense'), [data.categories])
  const activeCategories = txForm.transaction_type === 'income' ? incomeCategories : expenseCategories

  useEffect(() => {
    if (!txForm.account && data.accounts.length === 1) {
      setTxForm((form) => ({ ...form, account: String(data.accounts[0].id) }))
    }
  }, [data.accounts, txForm.account])

  useEffect(() => {
    if (!txForm.category && activeCategories.length === 1) {
      setTxForm((form) => ({ ...form, category: String(activeCategories[0].id) }))
    }
  }, [activeCategories, txForm.category])

  const mergeData = useCallback((updates) => {
    setData((current) => ({ ...current, ...updates }))
  }, [])

  const loadReferenceData = useCallback(async (force = false) => {
    if (!auth || (loaded.refs && !force)) return
    const [accounts, categories, parties] = await Promise.all([
      api.get('/accounts/'),
      api.get('/categories/'),
      api.get('/parties/'),
    ])
    mergeData({ accounts: accounts.data, categories: categories.data, parties: parties.data })
    setLoaded((current) => ({ ...current, refs: true }))
  }, [api, auth, loaded.refs, mergeData])

  const loadActivePage = useCallback(async (force = false) => {
    if (!auth) return
    if (loaded[active] && !force) return
    setLoading(true)
    try {
      const query = new URLSearchParams(Object.entries(appliedFilters).filter(([, v]) => v)).toString()
      if (active === 'Dashboard') {
        const [dashboard, reports] = await Promise.all([
          api.get('/dashboard/'),
          api.get(`/reports/${query ? `?${query}` : ''}`),
        ])
        mergeData({ dashboard: dashboard.data, reports: reports.data })
      }
      if (active === 'Transactions') {
        await loadReferenceData()
        const [transactions, dues] = await Promise.all([
          api.get(`/transactions/${query ? `?${query}` : ''}`),
          api.get('/dues/'),
        ])
        mergeData({ transactions: transactions.data, dues: dues.data })
      }
      if (active === 'Categories') {
        const categories = await api.get('/categories/')
        mergeData({ categories: categories.data })
      }
      if (active === 'Parties/Vendors') {
        const parties = await api.get('/parties/')
        mergeData({ parties: parties.data })
      }
      if (active === 'Settings') {
        const [accounts, notes] = await Promise.all([api.get('/accounts/'), api.get('/notes/')])
        mergeData({ accounts: accounts.data, notes: notes.data })
      }
      if (active === 'Backup') {
        const backups = await api.get('/backups/')
        mergeData({ backups: backups.data })
      }
      if (active === 'Sales') {
        await loadReferenceData()
        const [sales, stock] = await Promise.all([api.get('/sales/'), api.get('/stock/')])
        mergeData({ sales: sales.data, stock: stock.data })
      }
      if (active === 'Stock') {
        const stock = await api.get('/stock/')
        mergeData({ stock: stock.data })
      }
      setLoaded((current) => ({ ...current, [active]: true }))
      setMessage('')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) setAuth(null)
      setMessage(error.response?.data?.detail || 'Could not load data from backend. Please check server and login.')
    } finally {
      setLoading(false)
    }
  }, [active, api, auth, appliedFilters, loadReferenceData, loaded, mergeData])

  useEffect(() => {
    async function checkSession() {
      try {
        await prepareCsrf()
        const response = await axios.get(`${apiBase}/auth/me/`, { withCredentials: true })
        setAuth(response.data)
        setMessage('')
      } catch {
        setAuth(null)
      } finally {
        setCheckingSession(false)
      }
    }
    checkSession()
  }, [])

  useEffect(() => { loadActivePage() }, [loadActivePage])

  function applyFilters() {
    setAppliedFilters(filters)
    setLoaded((current) => ({ ...current, Dashboard: false, Transactions: false }))
  }

  async function login(event) {
    event.preventDefault()
    try {
      await prepareCsrf()
      const csrfToken = csrfTokenCached;
      const response = await axios.post(`${apiBase}/auth/login/`, loginForm, { withCredentials: true, headers: { 'X-CSRFToken': csrfToken } })
      setAuth(response.data)
      setLoginForm({ username: response.data.username, password: '' })
      setMessage('Login successful.')
    } catch {
      setMessage('Invalid username or password.')
    }
  }

  async function register(event) {
    event.preventDefault()
    try {
      await prepareCsrf()
      const csrfToken = csrfTokenCached;
      const response = await axios.post(`${apiBase}/auth/register/`, registerForm, { withCredentials: true, headers: { 'X-CSRFToken': csrfToken } })
      setRegisterForm({ business_name: '', owner_name: '', email: '', phone: '', password: '' })
      setIsRegistering(false)
      setMessage(response.data?.detail || 'Registration successful! Please login.')
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Registration failed. Please check your inputs.'
      setMessage(Array.isArray(errorMsg) ? errorMsg.join(' ') : errorMsg)
    }
  }

  async function logout() {
    await api.post('/auth/logout/').catch(() => {})
    setAuth(null)
    setData({ dashboard: null, reports: null, accounts: [], categories: [], parties: [], transactions: [], dues: [], notes: [], backups: [] })
    setLoaded({ refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false })
    setMessage('Logged out.')
  }

  async function saveTransaction(event) {
    event.preventDefault()
    await prepareCsrf()
    const formData = new FormData()
    Object.entries(txForm).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (key === 'attachment' && !(value instanceof File)) return
        formData.append(key, value)
      }
    })
    // Form will require category and account natively using 'required'
    try {
      if (editingTx) await api.patch(`/transactions/${editingTx.id}/`, formData)
      else await api.post('/transactions/', formData)
      setTxForm(emptyTransaction(txForm.transaction_type))
      setEditingTx(null)
      setLoaded((current) => ({ ...current, Dashboard: false, Transactions: false }))
      await loadActivePage(true)
      setMessage('Transaction saved in backend.')
    } catch (error) {
      const d = error.response?.data;
      if (d && typeof d === 'object' && !d.detail) {
        setMessage(Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | '));
      } else {
        setMessage(d?.detail || 'Transaction save failed. Check server.');
      }
    }
  }

  function editTransaction(tx) {
    setEditingTx(tx)
    setTxForm({ ...emptyTransaction(tx.transaction_type), ...tx, category: tx.category, account: tx.account, party: tx.party || '', attachment: null })
    setActive('Transactions')
  }

  async function remove(resource, id) {
    const confirmed = window.confirm('Are you sure you want to permanently delete this record?')
    if (!confirmed) return
    try {
      await prepareCsrf()
      await api.delete(`/${resource}/${id}/`)
      setLoaded((current) => ({ ...current, refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false, Sales: false, Stock: false }))
      await loadActivePage(true)
      setMessage('Record deleted from backend.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Delete failed.')
    }
  }

  async function saveSimple(resource, payload) {
    try {
      await prepareCsrf()
      if (payload.id) {
        await api.patch(`/${resource}/${payload.id}/`, payload)
      } else {
        await api.post(`/${resource}/`, payload)
      }
      setLoaded((current) => ({ ...current, refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false, Sales: false, Stock: false }))
      await loadActivePage(true)
      setMessage('Record saved in backend.')
    } catch (error) {
      const d = error.response?.data;
      if (d && typeof d === 'object' && !d.detail) {
        setMessage(Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join(' | '));
      } else {
        setMessage(d?.detail || 'Save failed.');
      }
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await prepareCsrf()
      await api.post('/auth/change-password/', { old_password: form.get('old_password'), new_password: form.get('new_password') })
      formElement.reset()
      setMessage('Password changed.')
    } catch (error) {
      const detail = error.response?.data?.detail
      setMessage(Array.isArray(detail) ? detail.join(' ') : detail || 'Password could not be changed.')
    }
  }

  async function createBackup() {
    try {
      await prepareCsrf()
      await api.post('/backup/create/', { backup_type: 'manual', notes: 'Created from dashboard' })
      await loadActivePage(true)
      setMessage('Database backup created.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Backup failed.')
    }
  }

  async function downloadTransactionExport(type) {
    const query = new URLSearchParams(Object.entries(appliedFilters).filter(([, v]) => v)).toString()
    const response = await api.get(`/export/${type}/?${query}`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = type === 'excel' ? 'account-statement.xlsx' : 'account-statement.pdf'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function downloadSalesExport(type) {
    const response = await api.get(`/export-sales/${type}/`, { responseType: 'blob' })
    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = type === 'excel' ? 'sales-statement.xlsx' : 'sales-statement.pdf'
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importTransactions(file) {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await prepareCsrf()
      await api.post('/import/transactions/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setLoaded((current) => ({ ...current, Dashboard: false, Transactions: false }))
      await loadActivePage(true)
      setMessage('Transactions imported successfully.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Transactions import failed.')
    }
  }

  async function importSales(file) {
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      await prepareCsrf()
      await api.post('/import/sales/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setLoaded((current) => ({ ...current, Dashboard: false, Sales: false, Stock: false }))
      await loadActivePage(true)
      setMessage('Sales imported successfully.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Sales import failed.')
    }
  }


  const chartData = (data.reports?.by_date || []).reduce((rows, row) => {
    const label = String(row.date)
    const found = rows.find((item) => item.date === label) || { date: label, income: 0, expense: 0 }
    found[row.transaction_type] = Number(row.total)
    return rows.includes(found) ? rows : [...rows, found]
  }, [])
  const totals = data.dashboard?.totals || {}
  const pendingTotal = Number(totals.pending_payable || 0) + Number(totals.pending_receivable || 0)
  const accountSummaries = data.dashboard?.account_summaries || []

  if (checkingSession) return <main className="loginPage"><div className="loginBox"><p className="message">Checking secure session...</p></div></main>

  if (!auth) {
    if (isRegistering) {
      return <main className="loginPage">
        <form className="loginBox" onSubmit={register}>
          <div className="brand center"><div className="brandMark"><Landmark /></div><div><strong>LedgerPro</strong><span>Create Account</span></div></div>
          <input required value={registerForm.business_name} onChange={(e) => setRegisterForm({ ...registerForm, business_name: e.target.value })} placeholder="Company or Business Name" />
          <input required value={registerForm.owner_name} onChange={(e) => setRegisterForm({ ...registerForm, owner_name: e.target.value })} placeholder="Owner Name" />
          <input required type="email" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} placeholder="Email Address" />
          <input required value={registerForm.phone} onChange={(e) => setRegisterForm({ ...registerForm, phone: e.target.value })} placeholder="Phone Number" />
          <input required type="password" value={registerForm.password} onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })} placeholder="Set Password" />
          <button className="primary"><Plus size={18} /> Create Account</button>
          <div style={{ textAlign: 'center', marginTop: '10px' }}>
            <button type="button" className="textLinkButton" style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }} onClick={() => { setIsRegistering(false); setMessage('') }}>
              Already have an account? Login
            </button>
          </div>
          {message && <p className="message">{message}</p>}
        </form>
      </main>
    }

    return <main className="loginPage">
      <form className="loginBox" onSubmit={login}>
        <div className="brand center"><div className="brandMark"><Landmark /></div><div><strong>LedgerPro</strong><span>Admin Login</span></div></div>
        <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} placeholder="Email, Username or Business Name" />
        <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Password" />
        <button className="primary"><Lock size={18} /> Login</button>
        <div style={{ textAlign: 'center', marginTop: '10px' }}>
          <button type="button" className="textLinkButton" style={{ background: 'none', border: 'none', color: '#0f766e', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }} onClick={() => { setIsRegistering(true); setMessage('') }}>
            Don't have an account? Create Account
          </button>
        </div>
        {message && <p className="message">{message}</p>}
      </form>
    </main>
  }

  return <div className="app">
    {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand">
        <div className="brandMark"><Landmark size={22} /></div>
        <div>
          <strong>{auth?.company_name || 'LedgerPro'}</strong>
          <span style={{ textTransform: 'capitalize' }}>
            {auth?.role ? `${auth.role} Workspace` : 'Account Department'}
          </span>
        </div>
      </div>
      <nav>{navItems.map(([item, Icon]) => <button className={active === item ? 'active' : ''} key={item} onClick={() => { setActive(item); setMenuOpen(false) }}><Icon size={18} /> {item}</button>)}</nav>
    </aside>
    <main>
      <header className="topbar">
        <button className="iconButton" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu"><Menu /></button>
        <div className="pageHeading">
          <p>{loading ? 'Syncing latest data...' : `Logged in as ${auth?.owner_name || auth?.username} | ${auth?.company_name || 'Workspace'}`}</p>
          <h1>{active} | {auth?.company_name || 'Workspace'}</h1>
          <span>{pageCopy[active]}</span>
        </div>
        <div className="topActions"><button onClick={() => loadActivePage(true)} title="Refresh"><RefreshCw size={18} /></button><button onClick={logout} title="Logout"><LogOut size={18} /></button></div>
      </header>
      {message && <div className="notice">{message}</div>}

      {active === 'Dashboard' && <>
        <div className="dashboard-brand-header">
          <h2>{auth?.company_name || 'Workspace'} Ledger Dashboard</h2>
        </div>
        <section className="statsGrid">
          <Metric icon={WalletCards} label="Current balance" value={currency(totals.current_balance)} tone="blue" />
          <Metric icon={ArrowUpCircle} label="Total income" value={currency(totals.income)} tone="green" />
          <Metric icon={ArrowDownCircle} label="Total expense" value={currency(totals.expense)} tone="red" />
          <Metric icon={Clock3} label="Pending dues" value={currency(pendingTotal)} tone="amber" />
        </section>
        <section className="periodGrid">{Object.entries(data.dashboard?.periods || {}).map(([period, value]) => <div className="period" key={period}><span>{period}</span><strong>{currency(value.balance)}</strong></div>)}</section>
        <section className="contentGrid">
          <Panel title="Income vs Expense" icon={CalendarDays}><Suspense fallback={<p className="emptyState">Loading chart...</p>}><ChartPanel data={chartData} currency={currency} /></Suspense></Panel>
          <Panel title="Account balances" icon={Banknote}><AccountList accounts={accountSummaries} /></Panel>
        </section>
        <section className="dashboardReport">
          <Panel title="All accounts report" icon={WalletCards}><AccountReport accounts={accountSummaries} /></Panel>
          <Panel title="Pending and recent activity" icon={Clock3}><DashboardActivity dashboard={data.dashboard} /></Panel>
        </section>
      </>}

      {active === 'Transactions' && <>
        <section className="split">
          <Panel title={editingTx ? 'Edit transaction' : 'New income / expense'} icon={Plus}>
            <TransactionForm form={txForm} setForm={setTxForm} save={saveTransaction} accounts={data.accounts} categories={activeCategories} parties={data.parties} editing={editingTx} cancel={() => { setEditingTx(null); setTxForm(emptyTransaction()) }} />
          </Panel>
          <Ledger filters={filters} setFilters={setFilters} apply={applyFilters} transactions={data.transactions} categories={data.categories} edit={editTransaction} remove={(id) => remove('transactions', id)} exportTx={downloadTransactionExport} importTx={importTransactions} />
        </section>
        <section className="transactionDues">
          <DuesPanel dues={data.dues} parties={data.parties} save={saveSimple} remove={(id) => remove('dues', id)} />
        </section>
      </>}

      {active === 'Categories' && <CategoriesPanel categories={data.categories} save={saveSimple} remove={(id) => remove('categories', id)} />}
      {active === 'Parties/Vendors' && <PartiesPanel parties={data.parties} save={saveSimple} remove={(id) => remove('parties', id)} />}
      {active === 'Sales' && <SalesPanel sales={data.sales} stock={data.stock} accounts={data.accounts} save={saveSimple} remove={(id) => remove('sales', id)} exportSales={downloadSalesExport} importSales={importSales} />}
      {active === 'Stock' && <StockPanel stock={data.stock} save={saveSimple} remove={(id) => remove('stock', id)} />}
      {active === 'Settings' && <SettingsPanel accounts={data.accounts} notes={data.notes} save={saveSimple} remove={remove} changePassword={changePassword} />}
      {active === 'Backup' && <BackupPanel backups={data.backups} createBackup={createBackup} />}
    </main>
  </div>
}

function Metric({ icon: Icon, label, value, tone }) { return <div className={`metric ${tone}`}><div className="metricIcon"><Icon /></div><span>{label}</span><strong>{value}</strong></div> }
function Panel({ title, icon: Icon, children, actions = null }) { return <section className="panel"><div className="panelTitle"><div><Icon size={19} /><h2>{title}</h2></div>{actions}</div>{children}</section> }
function EmptyState({ title, body }) { return <div className="emptyState"><strong>{title}</strong><span>{body}</span></div> }
function Field({ label, children, wide = false }) { return <label className={wide ? 'field wide' : 'field'}><span>{label}</span>{children}</label> }
function IconButton({ children, tone = '', ...props }) { return <button className={`rowAction ${tone}`} type="button" {...props}>{children}</button> }
function AccountList({ accounts }) {
  if (!accounts.length) return <EmptyState title="No accounts yet" body="Add an account from Settings to start tracking balances." />
  return <div className="accountList">{accounts.map((a) => <div key={a.id}><span>{a.name}<small>{formatLabel(a.account_type)} account - opening {currency(a.opening_balance)}</small></span><strong>{currency(a.current_balance)}</strong></div>)}</div>
}

function AccountReport({ accounts }) {
  if (!accounts.length) return <EmptyState title="No account report" body="Account totals will appear here after accounts are created." />
  return <div className="tableWrap"><table className="accountReportTable"><thead><tr><th>Account</th><th>Type</th><th>Opening</th><th>Income</th><th>Expense</th><th>Current Balance</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong></td><td><span className="pill">{formatLabel(account.account_type)}</span></td><td>{currency(account.opening_balance)}</td><td className="positive">{currency(account.income)}</td><td className="negative">{currency(account.expense)}</td><td><strong>{currency(account.current_balance)}</strong></td></tr>)}</tbody></table></div>
}

function DashboardActivity({ dashboard }) {
  const dues = dashboard?.pending_dues || []
  const transactions = dashboard?.recent_transactions || []
  return <div className="activityGrid"><div><h3>Pending payments</h3>{dues.length ? dues.map((due) => <p key={due.id}><strong>{due.title}</strong><span>{formatLabel(due.due_type)} - {currency(due.amount)} - {due.due_date}</span></p>) : <EmptyState title="No pending dues" body="Payables and receivables will show here." />}</div><div><h3>Recent ledger</h3>{transactions.length ? transactions.map((tx) => <p key={tx.id}><strong>{tx.title}</strong><span>{formatLabel(tx.transaction_type)} - {tx.account_name} - {currency(tx.amount)}</span></p>) : <EmptyState title="No recent transactions" body="New entries will appear in this activity list." />}</div></div>
}

function TransactionForm({ form, setForm, save, accounts, categories, parties, editing, cancel }) {
  return <form className="entryForm" onSubmit={save}>
    <div className="segmented">
      {['income', 'expense'].map((type) => <button className={form.transaction_type === type ? 'active' : ''} key={type} type="button" onClick={() => setForm({ ...form, transaction_type: type, category: '' })}>{formatLabel(type)}</button>)}
    </div>
    <Field label="Title"><input required placeholder="Source, vendor, or detail" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
    <div className="formTwo">
      <Field label="Amount"><input required type="number" step="any" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
      <Field label="Date"><input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
    </div>
    <Field label="Category"><select required value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="" disabled>{categories.length ? 'Select category' : 'No category available'}</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>{categories.length === 0 && <small className="fieldHint">Create this type of category from Categories page.</small>}</Field>
    <Field label="Account"><select required value={form.account || ''} onChange={(e) => setForm({ ...form, account: e.target.value })}><option value="" disabled>{accounts.length ? 'Select account' : 'No account available'}</option>{accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select>{accounts.length === 1 && <small className="fieldHint">Only one account found, selected automatically.</small>}{accounts.length === 0 && <small className="fieldHint">Create an account from Settings page first.</small>}</Field>
    <div className="formTwo">
      <Field label="Payment"><select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option><option value="cheque">Cheque</option></select></Field>
      <Field label="Party"><select value={form.party || ''} onChange={(e) => setForm({ ...form, party: e.target.value })}><option value="">No party</option>{parties.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></Field>
    </div>
    <Field label="Reference"><input placeholder="Invoice or payment reference" value={form.reference_number || ''} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} /></Field>
    <Field label="Notes"><textarea placeholder="Optional details" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
    <label className="upload"><Upload size={18} /><span>Receipt / invoice upload</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setForm({ ...form, attachment: e.target.files[0] })} /></label>
    <div className="formActions"><button className="primary"><CheckCircle2 size={18} /> {editing ? 'Update entry' : 'Save entry'}</button>{editing && <button type="button" onClick={cancel}>Cancel</button>}</div>
  </form>
}

function Ledger({ filters, setFilters, apply, transactions, categories, edit, remove, exportTx, importTx }) {
  const totalCredit = transactions.reduce((sum, tx) => sum + (tx.transaction_type === 'income' ? Number(tx.amount) : 0), 0)
  const totalDebit = transactions.reduce((sum, tx) => sum + (tx.transaction_type === 'expense' ? Number(tx.amount) : 0), 0)
  return <Panel title="Ledger / account book" icon={ReceiptText} actions={<span className="panelMeta">{transactions.length} entries</span>}>
    <div className="ledgerSummary"><span>Debit <strong className="negative">{currency(totalDebit)}</strong></span><span>Credit <strong className="positive">{currency(totalCredit)}</strong></span><span>Net <strong>{currency(totalCredit - totalDebit)}</strong></span></div>
    <div className="filters">
      <label className="searchField"><Search size={16} /><input placeholder="Search title, notes, party" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} /></label>
      <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <select value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}><option value="">All methods</option><option value="cash">Cash</option><option value="bank">Bank</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select>
      <input aria-label="Start date" type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} /><input aria-label="End date" type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
      <button className="primary" onClick={apply}>Apply</button>
    </div>
    <div className="exportGrid">
      <button onClick={() => exportTx('excel')}><FileSpreadsheet /> Excel export</button>
      <button onClick={() => exportTx('pdf')}><FileText /> PDF report</button>
      <label className="importLabel">
        <Upload size={16} /> Import Excel
        <input type="file" accept=".xlsx" onChange={(e) => importTx(e.target.files[0])} style={{ display: 'none' }} />
      </label>
      <label className="importLabel">
        <Upload size={16} /> Import PDF
        <input type="file" accept=".pdf" onChange={(e) => importTx(e.target.files[0])} style={{ display: 'none' }} />
      </label>
    </div>
    {transactions.length ? <div className="tableWrap"><table><thead><tr><th>Date</th><th>Details</th><th>Category</th><th>Debit</th><th>Credit</th><th>Proof</th><th>Action</th></tr></thead><tbody>{transactions.map((tx) => <tr key={tx.id}><td>{tx.date}</td><td><strong>{tx.title}</strong><small>{tx.party_name || 'No party'}{tx.reference_number ? ` - ${tx.reference_number}` : ''}</small></td><td><span className="pill">{tx.category_name}</span></td><td className="negative">{tx.transaction_type === 'expense' ? currency(tx.amount) : '-'}</td><td className="positive">{tx.transaction_type === 'income' ? currency(tx.amount) : '-'}</td><td>{tx.attachment ? <a className="textLink" href={tx.attachment} target="_blank" rel="noreferrer">Open</a> : '-'}</td><td><div className="rowActions"><IconButton onClick={() => edit(tx)}><Edit3 size={15} /></IconButton><IconButton tone="danger" onClick={() => remove(tx.id)}><Trash2 size={15} /></IconButton></div></td></tr>)}</tbody></table></div> : <EmptyState title="No transactions found" body="Add a new entry or adjust filters to see ledger records." />}
  </Panel>
}

function CategoriesPanel({ categories, save, remove }) {
  const [form, setForm] = useState({ name: '', category_type: 'income', color: '#2563eb' })
  return <Panel title="Categories management" icon={Tags} actions={<span className="panelMeta">{categories.length} categories</span>}><form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('categories', form); setForm({ ...form, name: '' }) }}><Field label="Category name"><input required placeholder="Rent, Sales, Utilities" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Type"><select value={form.category_type} onChange={(e) => setForm({ ...form, category_type: e.target.value })}><option value="income">Income</option><option value="expense">Expense</option></select></Field><Field label="Color"><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field><button className="primary">Add category</button></form><SimpleRows emptyTitle="No categories yet" emptyBody="Create income and expense categories to make reports useful." rows={categories.map((c) => [c.id, c.name, formatLabel(c.category_type), c.color])} remove={remove} /></Panel>
}

function PartiesPanel({ parties, save, remove }) {
  const [form, setForm] = useState({ name: '', party_type: 'customer', phone: '', email: '', address: '', notes: '' })
  return <Panel title="Vendor and customer records" icon={Users} actions={<span className="panelMeta">{parties.length} records</span>}><form className="inlineForm partiesForm" onSubmit={(e) => { e.preventDefault(); save('parties', form); setForm({ ...form, name: '', phone: '', email: '', address: '' }) }}><Field label="Name"><input required placeholder="Customer or vendor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Type"><select value={form.party_type} onChange={(e) => setForm({ ...form, party_type: e.target.value })}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="staff">Staff</option><option value="other">Other</option></select></Field><Field label="Phone"><input placeholder="03xx..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><Field label="Address"><input placeholder="Karachi, Lahore, etc." value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field><button className="primary">Add party</button></form><SimpleRows emptyTitle="No parties yet" emptyBody="Add customers, vendors, or staff to link them with transactions." rows={parties.map((p) => [p.id, p.name, formatLabel(p.party_type), p.phone, p.address])} remove={remove} /></Panel>
}

function DuesPanel({ dues, parties, save, remove }) {
  const [form, setForm] = useState({ title: '', due_type: 'payable', amount: '', due_date: new Date().toISOString().slice(0, 10), status: 'pending', party: '' })
  return <Panel title="Due payments" icon={Clock3} actions={<span className="panelMeta">{dues.length} pending items</span>}><form className="inlineForm duesForm" onSubmit={(e) => { e.preventDefault(); save('dues', form); setForm({ ...form, title: '', amount: '' }) }}><Field label="Title"><input required placeholder="Payment detail" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field><Field label="Type"><select value={form.due_type} onChange={(e) => setForm({ ...form, due_type: e.target.value })}><option value="payable">Payable</option><option value="receivable">Receivable</option></select></Field><Field label="Amount"><input required type="number" step="any" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field><Field label="Due date"><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field><Field label="Party"><select value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })}><option value="">No party</option>{parties.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></Field><button className="primary">Add due</button></form>{dues.length ? <div className="dueList">{dues.map((d) => <div key={d.id}><span>{d.title}<small>{d.party_name || 'No party'} - {d.due_date} - {formatLabel(d.status)}</small></span><strong>{currency(d.amount)}</strong><IconButton tone="danger" onClick={() => remove(d.id)}><Trash2 size={15} /></IconButton></div>)}</div> : <EmptyState title="No due payments" body="Payables and receivables will appear here." />}</Panel>
}

function SettingsPanel({ accounts, notes, save, remove, changePassword }) {
  const [note, setNote] = useState({ title: '', body: '', reminder_date: '' })
  const [account, setAccount] = useState({ name: '', account_type: 'cash', opening_balance: 0, is_active: true })
  return <Panel title="Admin login and settings" icon={Settings}>
    <div className="settingsStack">
      <form className="inlineForm" onSubmit={changePassword}><Field label="Old password"><input required type="password" name="old_password" placeholder="Current password" /></Field><Field label="New password"><input required type="password" name="new_password" placeholder="New secure password" /></Field><button className="primary">Change password</button></form>
      <form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('accounts', account); setAccount({ ...account, name: '', opening_balance: 0 }) }}><Field label="Account name"><input required placeholder="Cash counter, Bank account" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /></Field><Field label="Type"><select value={account.account_type} onChange={(e) => setAccount({ ...account, account_type: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select></Field><Field label="Opening balance"><input type="number" step="any" placeholder="0" value={account.opening_balance} onChange={(e) => setAccount({ ...account, opening_balance: e.target.value })} /></Field><button className="primary">Add account</button></form>
      <form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('notes', note); setNote({ title: '', body: '', reminder_date: '' }) }}><Field label="Note title"><input required placeholder="Reminder title" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} /></Field><Field label="Note"><input required placeholder="Reminder detail" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} /></Field><Field label="Reminder date"><input type="date" value={note.reminder_date} onChange={(e) => setNote({ ...note, reminder_date: e.target.value })} /></Field><button className="primary">Add note</button></form>
    </div>
    <h3 className="sectionLabel">Accounts</h3><SimpleRows emptyTitle="No accounts yet" emptyBody="Add an account to begin tracking balances." rows={accounts.map((a) => [a.id, a.name, formatLabel(a.account_type), currency(a.current_balance)])} remove={(id) => remove('accounts', id)} />
    <h3 className="sectionLabel">Notes</h3><SimpleRows emptyTitle="No notes yet" emptyBody="Create reminders for follow-ups or payments." rows={notes.map((n) => [n.id, n.title, n.body, n.reminder_date])} remove={(id) => remove('notes', id)} />
  </Panel>
}

function BackupPanel({ backups, createBackup }) {
  return <Panel title="Backup system" icon={Download} actions={<span className="panelMeta">{backups.length} backups</span>}><div className="backupBox"><div><strong>Database backup</strong><p>Create a fresh copy before major edits or at the end of the day.</p></div><button className="primary" onClick={createBackup}><Download size={18} /> Create backup</button></div><SimpleRows emptyTitle="No backups yet" emptyBody="Created backups will be listed here." rows={backups.map((b) => [b.id, formatLabel(b.backup_type), b.file, b.created_at])} /></Panel>
}

function SimpleRows({ rows, remove, emptyTitle = 'No records', emptyBody = 'Records will appear here.' }) {
  if (!rows.length) return <EmptyState title={emptyTitle} body={emptyBody} />
  return <div className="simpleList">{rows.map((row) => <div key={row[0]}>{row.slice(1).map((cell) => <span key={cell}>{cell || '-'}</span>)}{remove && <IconButton tone="danger" onClick={() => remove(row[0])}><Trash2 size={15} /></IconButton>}</div>)}</div>
}

function StockPanel({ stock, save, remove }) {
  const [form, setForm] = useState({ name: '', quantity: '', unit_price: '' })
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, quantity: editing.quantity, unit_price: editing.unit_price, id: editing.id })
    } else {
      setForm({ name: '', quantity: '', unit_price: '' })
    }
  }, [editing])

  const handleSubmit = (e) => {
    e.preventDefault()
    save('stock', form)
    setEditing(null)
    setForm({ name: '', quantity: '', unit_price: '' })
  }

  return (
    <div className="stockContainer">
      <Panel title={editing ? "Edit Stock Item" : "Add New Stock"} icon={Package}>
        <form className="inlineForm" onSubmit={handleSubmit}>
          <Field label="Stock Item Name">
            <input required placeholder="e.g. Cement Bag, Steel Rod" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Total Stock Quantity">
            <input required type="number" placeholder="Total quantity" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Unit Price (Rs)">
            <input required type="number" step="any" placeholder="Purchase price per unit" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </Field>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', minHeight: '42px' }}>
            <button className="primary">{editing ? "Update" : "Add Stock"}</button>
            {editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}
          </div>
        </form>
      </Panel>

      <div style={{ marginTop: '20px' }}>
        <Panel title="Stock Inventory Status" icon={Package} actions={<span className="panelMeta">{stock.length} items</span>}>
          {stock.length ? (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th>Unit Price</th>
                    <th>Total Stock</th>
                    <th>Sold Stock</th>
                    <th>Remaining Stock</th>
                    <th>Value (Remaining)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stock.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      <td>{currency(item.unit_price)}</td>
                      <td><span className="pill blue">{item.quantity}</span></td>
                      <td><span className="pill green">{item.sold_stock}</span></td>
                      <td>
                        <span className={`pill ${item.remaining_stock <= 5 ? 'red' : 'orange'}`}>
                          {item.remaining_stock}
                        </span>
                      </td>
                      <td>{currency(item.remaining_stock * item.unit_price)}</td>
                      <td>
                        <div className="rowActions">
                          <IconButton onClick={() => setEditing(item)}><Edit3 size={15} /></IconButton>
                          <IconButton tone="danger" onClick={() => remove(item.id)}><Trash2 size={15} /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No stock items found" body="Add stock items above to start tracking your inventory." />
          )}
        </Panel>
      </div>
    </div>
  )
}

function SalesPanel({ sales, stock, accounts, save, remove, exportSales, importSales }) {
  const [form, setForm] = useState({ stock: '', quantity: '', sale_price: '', date: new Date().toISOString().slice(0, 10), account: '', notes: '', customer_name: '', customer_phone: '', customer_address: '' })
  const [editing, setEditing] = useState(null)
  const [activeInvoice, setActiveInvoice] = useState(null)

  useEffect(() => {
    if (editing) {
      setForm({
        stock: String(editing.stock),
        quantity: editing.quantity,
        sale_price: editing.sale_price,
        date: editing.date,
        account: String(editing.account),
        notes: editing.notes || '',
        customer_name: editing.customer_name || '',
        customer_phone: editing.customer_phone || '',
        customer_address: editing.customer_address || '',
        id: editing.id
      })
    } else {
      setForm({
        stock: '',
        quantity: '',
        sale_price: '',
        date: new Date().toISOString().slice(0, 10),
        account: accounts.length ? String(accounts[0].id) : '',
        notes: '',
        customer_name: '',
        customer_phone: '',
        customer_address: ''
      })
    }
  }, [editing, accounts])

  const handleSubmit = (e) => {
    e.preventDefault()
    save('sales', form)
    setEditing(null)
    setForm({
      stock: '',
      quantity: '',
      sale_price: '',
      date: new Date().toISOString().slice(0, 10),
      account: accounts.length ? String(accounts[0].id) : '',
      notes: '',
      customer_name: '',
      customer_phone: '',
      customer_address: ''
    })
  }

  const handleStockChange = (e) => {
    const selectedStockId = e.target.value
    const selectedStock = stock.find(s => String(s.id) === selectedStockId)
    setForm(f => ({
      ...f,
      stock: selectedStockId,
      sale_price: selectedStock ? selectedStock.unit_price : ''
    }))
  }

  return (
    <div className="salesContainer">
      <Panel title={editing ? "Edit Sale Record" : "Record New Sale"} icon={ShoppingCart}>
        <form className="salesForm" onSubmit={handleSubmit}>
          <Field label="Select Stock Item">
            <select required value={form.stock} onChange={handleStockChange}>
              <option value="" disabled>Select Item</option>
              {stock.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} (Remaining: {item.remaining_stock})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sale Quantity">
            <input required type="number" placeholder="Qty sold" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Sale Price (per unit)">
            <input required type="number" step="any" placeholder="Sale price per unit" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
          </Field>
          <Field label="Account (Received In)">
            <select required value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>
              <option value="" disabled>Select Account</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({formatLabel(acc.account_type)})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date">
            <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Customer Name">
            <input placeholder="Walk-in Customer" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
          </Field>
          <Field label="Customer Phone">
            <input placeholder="Customer phone number" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
          </Field>
          <Field label="Customer Address">
            <input placeholder="Customer address" value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
          </Field>
          <Field label="Notes">
            <input placeholder="Optional sale comments" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', minHeight: '42px' }}>
            <button className="primary">{editing ? "Update" : "Record Sale"}</button>
            {editing && <button type="button" onClick={() => setEditing(null)}>Cancel</button>}
          </div>
        </form>
      </Panel>

      <div style={{ marginTop: '20px' }}>
        <Panel title="Sales Ledger" icon={ShoppingCart} actions={<span className="panelMeta">{sales.length} sales</span>}>
          <div className="exportGrid">
            <button onClick={() => exportSales('excel')}><FileSpreadsheet /> Excel export</button>
            <button onClick={() => exportSales('pdf')}><FileText /> PDF report</button>
            <label className="importLabel">
              <Upload size={16} /> Import Excel
              <input type="file" accept=".xlsx" onChange={(e) => importSales(e.target.files[0])} style={{ display: 'none' }} />
            </label>
            <label className="importLabel">
              <Upload size={16} /> Import PDF
              <input type="file" accept=".pdf" onChange={(e) => importSales(e.target.files[0])} style={{ display: 'none' }} />
            </label>
          </div>
          {sales.length ? (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Stock Item</th>
                    <th>Customer</th>
                    <th>Quantity</th>
                    <th>Sale Price</th>
                    <th>Total Price</th>
                    <th>Account</th>
                    <th>Notes</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.date}</td>
                      <td><strong>{sale.stock_name}</strong></td>
                      <td>
                        {sale.customer_name ? (
                          <div>
                            <strong>{sale.customer_name}</strong>
                            {sale.customer_phone && <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>{sale.customer_phone}</small>}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>Walk-in</span>
                        )}
                      </td>
                      <td>{sale.quantity}</td>
                      <td>{currency(sale.sale_price)}</td>
                      <td><strong className="positive">{currency(sale.total_price)}</strong></td>
                      <td><span className="pill">{sale.account_name}</span></td>
                      <td><small>{sale.notes || '-'}</small></td>
                      <td>
                        <div className="rowActions">
                          <IconButton onClick={() => setActiveInvoice(sale)} title="Invoice"><Printer size={15} /></IconButton>
                          <IconButton onClick={() => setEditing(sale)} title="Edit"><Edit3 size={15} /></IconButton>
                          <IconButton tone="danger" onClick={() => remove(sale.id)} title="Delete"><Trash2 size={15} /></IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No sales recorded" body="Add product sales above to track transactions." />
          )}
        </Panel>
      </div>

      {activeInvoice && (
        <div className="modalOverlay" onClick={() => setActiveInvoice(null)}>
          <div className="printable-invoice" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-header">
              <div className="invoice-brand">
                <Landmark size={28} />
                <h2>LedgerPro</h2>
              </div>
              <div className="invoice-meta">
                <h3>INVOICE</h3>
                <p><strong>Invoice #:</strong> INV-SALE-{activeInvoice.id}</p>
                <p><strong>Date:</strong> {activeInvoice.date}</p>
              </div>
            </div>
            
            <div className="invoice-body">
              <div className="invoice-bill-to">
                <h4>Bill To:</h4>
                {activeInvoice.customer_name ? (
                  <div style={{ display: 'grid', gap: '3px', fontSize: '14px', color: '#1e293b' }}>
                    <p style={{ margin: 0 }}><strong>Name:</strong> {activeInvoice.customer_name}</p>
                    {activeInvoice.customer_phone && <p style={{ margin: 0 }}><strong>Phone:</strong> {activeInvoice.customer_phone}</p>}
                    {activeInvoice.customer_address && <p style={{ margin: 0 }}><strong>Address:</strong> {activeInvoice.customer_address}</p>}
                  </div>
                ) : (
                  <p>Walk-in Customer</p>
                )}
                {activeInvoice.notes && <p style={{ marginTop: '8px' }}><strong>Notes:</strong> {activeInvoice.notes}</p>}
              </div>
              
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>{activeInvoice.stock_name}</strong></td>
                    <td>{activeInvoice.quantity}</td>
                    <td>{currency(activeInvoice.sale_price)}</td>
                    <td><strong>{currency(activeInvoice.total_price)}</strong></td>
                  </tr>
                </tbody>
              </table>

              <div className="invoice-total-section">
                <div className="invoice-total-row">
                  <span>Subtotal:</span>
                  <span>{currency(activeInvoice.total_price)}</span>
                </div>
                <div className="invoice-total-row grand-total">
                  <span>Grand Total:</span>
                  <span>{currency(activeInvoice.total_price)}</span>
                </div>
              </div>
              
              <div className="invoice-payment-method">
                <p><strong>Payment Received In:</strong> {activeInvoice.account_name}</p>
              </div>
            </div>

            <div className="invoice-footer">
              <p>Thank you for your business!</p>
            </div>

            <div className="invoice-actions">
              <button className="primary" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</button>
              <button onClick={() => setActiveInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
