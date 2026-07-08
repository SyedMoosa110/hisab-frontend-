import axios from 'axios'
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, Banknote, BookOpen, CalendarDays, CheckCircle2,
  Clock3, Download, Edit3, FileSpreadsheet, FileText, Landmark, LayoutDashboard,
  Lock, Menu, NotebookPen, Plus, Printer, ReceiptText, Search, Settings, Tags,
  Trash2, Upload, Users, WalletCards, X,
} from 'lucide-react'
import './App.css'

const ChartPanel = lazy(() => import('./ChartPanel.jsx'))
const apiBase = 'http://127.0.0.1:8000/api'
const navItems = [
  ['Dashboard', LayoutDashboard], ['Transactions', BookOpen], ['Categories', Tags],
  ['Parties/Vendors', Users], ['Settings', Settings], ['Backup', Download],
]

function currency(value) {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(Number(value || 0))
}

async function prepareCsrf() {
  await axios.get(`${apiBase}/auth/csrf/`, { withCredentials: true })
}

function emptyTransaction(type = 'income') {
  return { transaction_type: type, title: '', amount: '', category: '', account: '', party: '', payment_method: 'cash', reference_number: '', notes: '', date: new Date().toISOString().slice(0, 10), attachment: null }
}

function startOfPeriod(mode) {
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (mode === 'week') start.setDate(start.getDate() - start.getDay())
  if (mode === 'month') start.setDate(1)
  if (mode === 'year') {
    start.setMonth(0)
    start.setDate(1)
  }
  return start
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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
  const [filters, setFilters] = useState({ keyword: '', category: '', payment_method: '', start: '', end: '', min_amount: '', max_amount: '' })
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
  const incomeCategories = data.categories.filter((c) => c.category_type === 'income')
  const expenseCategories = data.categories.filter((c) => c.category_type === 'expense')

  const loadAll = useCallback(async () => {
    if (!auth) return
    setLoading(true)
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
      const [dashboard, accounts, categories, parties, transactions, dues, notes, backups, reports] = await Promise.all([
        api.get('/dashboard/'), api.get('/accounts/'), api.get('/categories/'), api.get('/parties/'),
        api.get(`/transactions/${query ? `?${query}` : ''}`), api.get('/dues/'), api.get('/notes/'),
        api.get('/backups/'), api.get(`/reports/${query ? `?${query}` : ''}`),
      ])
      setData({ dashboard: dashboard.data, accounts: accounts.data, categories: categories.data, parties: parties.data, transactions: transactions.data, dues: dues.data, notes: notes.data, backups: backups.data, reports: reports.data })
      setMessage('')
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) setAuth(null)
      setMessage(error.response?.data?.detail || 'Backend se data load nahi hua. Server aur login check karein.')
    } finally {
      setLoading(false)
    }
  }, [api, auth, filters])

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

  useEffect(() => { loadAll() }, [loadAll])

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
    if (!formData.get('category')) formData.set('category', (txForm.transaction_type === 'income' ? incomeCategories[0] : expenseCategories[0])?.id || '')
    if (!formData.get('account')) formData.set('account', data.accounts[0]?.id || '')
    try {
      if (editingTx) await api.patch(`/transactions/${editingTx.id}/`, formData)
      else await api.post('/transactions/', formData)
      setTxForm(emptyTransaction(txForm.transaction_type))
      setEditingTx(null)
      await loadAll()
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
      await loadAll()
      setMessage('Record deleted from backend.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Delete failed.')
    }
  }

  async function saveSimple(resource, payload) {
    try {
      await prepareCsrf()
      await api.post(`/${resource}/`, payload)
      await loadAll()
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
      await loadAll()
      setMessage('Database backup created.')
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Backup failed.')
    }
  }

  async function downloadTransactionExport(type) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString()
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
        <div><p>{loading ? 'Loading backend data...' : `Logged in as ${auth.username}`}</p><h1>{active}</h1></div>
        <div className="topActions"><button onClick={loadAll} title="Refresh"><CheckCircle2 size={18} /></button><button onClick={logout} title="Logout"><X size={18} /></button></div>
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
            <TransactionForm form={txForm} setForm={setTxForm} save={saveTransaction} accounts={data.accounts} categories={txForm.transaction_type === 'income' ? incomeCategories : expenseCategories} parties={data.parties} editing={editingTx} cancel={() => { setEditingTx(null); setTxForm(emptyTransaction()) }} />
          </Panel>
          <Ledger filters={filters} setFilters={setFilters} apply={loadAll} transactions={data.transactions} categories={data.categories} edit={editTransaction} remove={(id) => remove('transactions', id)} exportTx={downloadTransactionExport} />
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

function Metric({ icon: Icon, label, value, tone }) { return <div className={`metric ${tone}`}><Icon /><span>{label}</span><strong>{value}</strong></div> }
function Panel({ title, icon: Icon, children }) { return <section className="panel"><div className="panelTitle"><Icon size={19} /><h2>{title}</h2></div>{children}</section> }
function AccountList({ accounts }) { return <div className="accountList">{accounts.map((a) => <div key={a.id}><span>{a.name}<small>{a.account_type} - opening {currency(a.opening_balance)}</small></span><strong>{currency(a.current_balance)}</strong></div>)}</div> }

function AccountReport({ accounts }) {
  return <div className="tableWrap"><table className="accountReportTable"><thead><tr><th>Account</th><th>Type</th><th>Opening</th><th>Income</th><th>Expense</th><th>Current Balance</th></tr></thead><tbody>{accounts.map((account) => <tr key={account.id}><td><strong>{account.name}</strong></td><td>{account.account_type}</td><td>{currency(account.opening_balance)}</td><td>{currency(account.income)}</td><td>{currency(account.expense)}</td><td><strong>{currency(account.current_balance)}</strong></td></tr>)}</tbody></table></div>
}

function DashboardActivity({ dashboard }) {
  const dues = dashboard?.pending_dues || []
  const transactions = dashboard?.recent_transactions || []
  return <div className="activityGrid"><div><h3>Pending payments</h3>{dues.map((due) => <p key={due.id}><strong>{due.title}</strong><span>{due.due_type} - {currency(due.amount)} - {due.due_date}</span></p>)}</div><div><h3>Recent ledger</h3>{transactions.map((tx) => <p key={tx.id}><strong>{tx.title}</strong><span>{tx.transaction_type} - {tx.account_name} - {currency(tx.amount)}</span></p>)}</div></div>
}

function TransactionForm({ form, setForm, save, accounts, categories, parties, editing, cancel }) {
  return <form className="entryForm" onSubmit={save}>
    <select value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value, category: '' })}><option value="income">Income</option><option value="expense">Expense</option></select>
    <input required placeholder="Source / vendor / title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
    <input required type="number" step="any" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
    <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
    <select value={form.account} onChange={(e) => setForm({ ...form, account: e.target.value })}>{accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}</select>
    <select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option><option value="cheque">Cheque</option></select>
    <select value={form.party || ''} onChange={(e) => setForm({ ...form, party: e.target.value })}><option value="">No party</option>{parties.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
    <input placeholder="Reference number" value={form.reference_number || ''} onChange={(e) => setForm({ ...form, reference_number: e.target.value })} />
    <textarea placeholder="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
    <label className="upload"><Upload size={18} /> Receipt / invoice upload<input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp,application/pdf" onChange={(e) => setForm({ ...form, attachment: e.target.files[0] })} /></label>
    <button className="primary"><CheckCircle2 size={18} /> {editing ? 'Update entry' : 'Save entry'}</button>
    {editing && <button type="button" onClick={cancel}>Cancel edit</button>}
  </form>
}

function Ledger({ filters, setFilters, apply, transactions, categories, edit, remove, exportTx }) {
  return <Panel title="Ledger / account book" icon={ReceiptText}>
    <div className="filters">
      <label><Search size={16} /><input placeholder="Keyword search" value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} /></label>
      <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
      <select value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}><option value="">All methods</option><option value="cash">Cash</option><option value="bank">Bank</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select>
      <input type="date" value={filters.start} onChange={(e) => setFilters({ ...filters, start: e.target.value })} /><input type="date" value={filters.end} onChange={(e) => setFilters({ ...filters, end: e.target.value })} />
      <button onClick={apply}>Apply</button>
    </div>
    <div className="exportGrid" style={{ marginTop: '10px', marginBottom: '15px' }}>
      <button onClick={() => exportTx('excel')}><FileSpreadsheet /> Excel export</button>
      <button onClick={() => exportTx('pdf')}><FileText /> PDF report</button>
    </div>
    <div className="tableWrap"><table><thead><tr><th>Date</th><th>Details</th><th>Category</th><th>Debit</th><th>Credit</th><th>Proof</th><th>Action</th></tr></thead><tbody>{transactions.map((tx) => <tr key={tx.id}><td>{tx.date}</td><td><strong>{tx.title}</strong><small>{tx.party_name || 'No party'} - {tx.reference_number}</small></td><td>{tx.category_name}</td><td>{tx.transaction_type === 'expense' ? currency(tx.amount) : '-'}</td><td>{tx.transaction_type === 'income' ? currency(tx.amount) : '-'}</td><td>{tx.attachment ? <a href={tx.attachment} target="_blank" rel="noreferrer">Open</a> : '-'}</td><td><button onClick={() => edit(tx)}><Edit3 size={15} /></button><button onClick={() => remove(tx.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div>
  </Panel>
}

function CategoriesPanel({ categories, save, remove }) {
  const [form, setForm] = useState({ name: '', category_type: 'income', color: '#2563eb' })
  return <Panel title="Categories management" icon={Tags}><form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('categories', form); setForm({ ...form, name: '' }) }}><input required placeholder="Category name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><select value={form.category_type} onChange={(e) => setForm({ ...form, category_type: e.target.value })}><option value="income">Income</option><option value="expense">Expense</option></select><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /><button className="primary">Add</button></form><SimpleRows rows={categories.map((c) => [c.id, c.name, c.category_type, c.color])} remove={remove} /></Panel>
}

function PartiesPanel({ parties, save, remove }) {
  const [form, setForm] = useState({ name: '', party_type: 'customer', phone: '', email: '', address: '', notes: '' })
  return <Panel title="Vendor and customer records" icon={Users}><form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('parties', form); setForm({ ...form, name: '', phone: '', email: '' }) }}><input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><select value={form.party_type} onChange={(e) => setForm({ ...form, party_type: e.target.value })}><option value="customer">Customer</option><option value="vendor">Vendor</option><option value="staff">Staff</option><option value="other">Other</option></select><input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><button className="primary">Add</button></form><SimpleRows rows={parties.map((p) => [p.id, p.name, p.party_type, p.phone])} remove={remove} /></Panel>
}

function DuesPanel({ dues, parties, save, remove }) {
  const [form, setForm] = useState({ title: '', due_type: 'payable', amount: '', due_date: new Date().toISOString().slice(0, 10), status: 'pending', party: '' })
  return <Panel title="Due payments" icon={Clock3}><form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('dues', form); setForm({ ...form, title: '', amount: '' }) }}><input required placeholder="Due title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><select value={form.due_type} onChange={(e) => setForm({ ...form, due_type: e.target.value })}><option value="payable">Payable</option><option value="receivable">Receivable</option></select><input required type="number" step="any" placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /><select value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })}><option value="">No party</option>{parties.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select><button className="primary">Add</button></form><div className="dueList">{dues.map((d) => <div key={d.id}><span>{d.title}<small>{d.party_name || 'No party'} - {d.due_date} - {d.status}</small></span><strong>{currency(d.amount)}</strong><button onClick={() => remove(d.id)}><Trash2 size={15} /></button></div>)}</div></Panel>
}

function SettingsPanel({ accounts, notes, save, remove, changePassword }) {
  const [note, setNote] = useState({ title: '', body: '', reminder_date: '' })
  const [account, setAccount] = useState({ name: '', account_type: 'cash', opening_balance: 0, is_active: true })
  return <Panel title="Admin login and settings" icon={Settings}>
    <form className="inlineForm" onSubmit={changePassword}><input required type="password" name="old_password" placeholder="Old password" /><input required type="password" name="new_password" placeholder="New password" /><button className="primary">Change password</button></form>
    <form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('accounts', account); setAccount({ ...account, name: '', opening_balance: 0 }) }}><input required placeholder="Account name" value={account.name} onChange={(e) => setAccount({ ...account, name: e.target.value })} /><select value={account.account_type} onChange={(e) => setAccount({ ...account, account_type: e.target.value })}><option value="cash">Cash</option><option value="bank">Bank</option><option value="easypaisa">Easypaisa</option><option value="jazzcash">JazzCash</option></select><input type="number" step="any" placeholder="Opening balance" value={account.opening_balance} onChange={(e) => setAccount({ ...account, opening_balance: e.target.value })} /><button className="primary">Add account</button></form>
    <form className="inlineForm" onSubmit={(e) => { e.preventDefault(); save('notes', note); setNote({ title: '', body: '', reminder_date: '' }) }}><input required placeholder="Note title" value={note.title} onChange={(e) => setNote({ ...note, title: e.target.value })} /><input required placeholder="Reminder note" value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} /><input type="date" value={note.reminder_date} onChange={(e) => setNote({ ...note, reminder_date: e.target.value })} /><button className="primary">Add note</button></form>
    <SimpleRows rows={accounts.map((a) => [a.id, a.name, a.account_type, currency(a.current_balance)])} remove={(id) => remove('accounts', id)} />
    <SimpleRows rows={notes.map((n) => [n.id, n.title, n.body, n.reminder_date])} remove={(id) => remove('notes', id)} />
  </Panel>
}

function BackupPanel({ backups, createBackup }) {
  return <Panel title="Backup system" icon={Download}><div className="backupBox"><p>Manual backup creates a copy of SQLite database and stores record in backend.</p><button className="primary" onClick={createBackup}><Download size={18} /> Create manual backup</button></div><SimpleRows rows={backups.map((b) => [b.id, b.backup_type, b.file, b.created_at])} /></Panel>
}

function SimpleRows({ rows, remove }) {
  return <div className="simpleList">{rows.map((row) => <div key={row[0]}>{row.slice(1).map((cell) => <span key={cell}>{cell || '-'}</span>)}{remove && <button onClick={() => remove(row[0])}><Trash2 size={15} /></button>}</div>)}</div>
}
