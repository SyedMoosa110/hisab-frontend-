import axios from 'axios'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, Banknote, BookOpen, CalendarDays, CheckCircle2,
  Clock3, Download, Edit3, FileSpreadsheet, FileText, Landmark, LayoutDashboard,
  Lock, LogOut, Menu, Plus, ReceiptText, RefreshCw, Search, Settings, Tags,
  Trash2, Upload, Users, WalletCards,
} from 'lucide-react'
import './App.css'

const ChartPanel = lazy(() => import('./ChartPanel.jsx'))
const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
const navItems = [
  ['Dashboard', LayoutDashboard], ['Transactions', BookOpen], ['Categories', Tags],
  ['Parties/Vendors', Users], ['Settings', Settings], ['Backup', Download],
]
const pageCopy = {
  Dashboard: 'Business overview, account balances, and recent money movement.',
  Transactions: 'Record income and expenses, filter the ledger, and manage dues.',
  Categories: 'Organize income and expenses so reports stay easy to scan.',
  'Parties/Vendors': 'Keep customers, vendors, staff, and other parties in one place.',
  Settings: 'Manage accounts, reminders, and admin access.',
  Backup: 'Create and review database backups.',
}

function currency(value) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

async function prepareCsrf() {
  await axios.get(`${apiBase}/auth/csrf/`, { withCredentials: true })
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
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' })
  const [active, setActive] = useState('Dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [data, setData] = useState({ dashboard: null, reports: null, accounts: [], categories: [], parties: [], transactions: [], dues: [], notes: [], backups: [] })
  const [loaded, setLoaded] = useState({ refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false })
  const [filters, setFilters] = useState({ keyword: '', category: '', payment_method: '', start: '', end: '', min_amount: '', max_amount: '' })
  const [appliedFilters, setAppliedFilters] = useState(filters)
  const [txForm, setTxForm] = useState(emptyTransaction())
  const [editingTx, setEditingTx] = useState(null)

  const api = useMemo(() => {
    const instance = axios.create({ baseURL: apiBase, withCredentials: true })
    instance.interceptors.request.use((config) => {
      const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/)
      if (match) config.headers['X-CSRFToken'] = match[1]
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
      setLoaded((current) => ({ ...current, [active]: true }))
      setMessage('')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) setAuth(null)
      setMessage(error.response?.data?.detail || 'Backend se data load nahi hua. Server aur login check karein.')
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
      const csrfMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/)
      const csrfToken = csrfMatch ? csrfMatch[1] : ''
      const response = await axios.post(`${apiBase}/auth/login/`, loginForm, { withCredentials: true, headers: { 'X-CSRFToken': csrfToken } })
      setAuth(response.data)
      setLoginForm({ username: response.data.username, password: '' })
      setMessage('Login successful.')
    } catch {
      setMessage('Username ya password ghalat hai.')
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
    const confirmed = window.confirm('Is record ko permanently delete karna hai?')
    if (!confirmed) return
    try {
      await prepareCsrf()
      await api.delete(`/${resource}/${id}/`)
      setLoaded((current) => ({ ...current, refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false }))
      await loadActivePage(true)
      setMessage('Record deleted from backend.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Delete failed.')
    }
  }

  async function saveSimple(resource, payload) {
    try {
      await prepareCsrf()
      await api.post(`/${resource}/`, payload)
      setLoaded((current) => ({ ...current, refs: false, Dashboard: false, Transactions: false, Categories: false, 'Parties/Vendors': false, Settings: false, Backup: false }))
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
      setMessage(Array.isArray(detail) ? detail.join(' ') : detail || 'Password change nahi hua.')
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
    return <main className="loginPage">
      <form className="loginBox" onSubmit={login}>
        <div className="brand center"><div className="brandMark"><Landmark /></div><div><strong>HisabPro</strong><span>Admin Login</span></div></div>
        <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} placeholder="Username" />
        <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Password" />
        <button className="primary"><Lock size={18} /> Login</button>
        {message && <p className="message">{message}</p>}
      </form>
    </main>
  }

  return <div className="app">
    <aside className={menuOpen ? 'sidebar open' : 'sidebar'}>
      <div className="brand"><div className="brandMark"><Landmark size={22} /></div><div><strong>HisabPro</strong><span>Account Department</span></div></div>
      <nav>{navItems.map(([item, Icon]) => <button className={active === item ? 'active' : ''} key={item} onClick={() => { setActive(item); setMenuOpen(false) }}><Icon size={18} /> {item}</button>)}</nav>
    </aside>
    <main>
      <header className="topbar">
        <button className="iconButton" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu"><Menu /></button>
        <div className="pageHeading"><p>{loading ? 'Syncing latest data...' : `Logged in as ${auth.username}`}</p><h1>{active}</h1><span>{pageCopy[active]}</span></div>
        <div className="topActions"><button onClick={() => loadActivePage(true)} title="Refresh"><RefreshCw size={18} /></button><button onClick={logout} title="Logout"><LogOut size={18} /></button></div>
      </header>
      {message && <div className="notice">{message}</div>}

      {active === 'Dashboard' && <>
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
          <Ledger filters={filters} setFilters={setFilters} apply={applyFilters} transactions={data.transactions} categories={data.categories} edit={editTransaction} remove={(id) => remove('transactions', id)} exportTx={downloadTransactionExport} />
        </section>
        <section className="transactionDues">
          <DuesPanel dues={data.dues} parties={data.parties} save={saveSimple} remove={(id) => remove('dues', id)} />
        </section>
      </>}

      {active === 'Categories' && <CategoriesPanel categories={data.categories} save={saveSimple} remove={(id) => remove('categories', id)} />}
      {active === 'Parties/Vendors' && <PartiesPanel parties={data.parties} save={saveSimple} remove={(id) => remove('parties', id)} />}
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

function Ledger({ filters, setFilters, apply, transactions, categories, edit, remove, exportTx }) {
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
  return <Panel title="Vendor and customer records" icon={Users} actions={<span className="panelMeta">{parties.length} records</span>}><form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('parties', form); setForm({ ...form, name: '', phone: '', email: '' }) }}><Field label="Name"><input required placeholder="Customer or vendor name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Type"><select value={form.party_type} onChange={(e) => setForm({ ...form, party_type: e.target.value })}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="staff">Staff</option><option value="other">Other</option></select></Field><Field label="Phone"><input placeholder="03xx..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field><button className="primary">Add party</button></form><SimpleRows emptyTitle="No parties yet" emptyBody="Add customers, vendors, or staff to link them with transactions." rows={parties.map((p) => [p.id, p.name, formatLabel(p.party_type), p.phone])} remove={remove} /></Panel>
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
