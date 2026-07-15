import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { 
  Users, ShieldAlert, Star, Ban, CheckCircle, Search, Calendar, Phone, Mail, Building, RefreshCw
} from 'lucide-react';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

export default function SuperadminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, blocked, expired, upgraded
  const [actionLoading, setActionLoading] = useState(null);
  
  // Custom trial expiry states
  const [editingExpiryId, setEditingExpiryId] = useState(null);
  const [editExpiryValue, setEditExpiryValue] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${apiBase}/superadmin/users/`, { withCredentials: true });
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load user directories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSaveExpiry = async (profileId) => {
    if (!editExpiryValue) return;
    setActionLoading(`expiry-${profileId}`);
    try {
      const res = await axios.post(`${apiBase}/superadmin/users/${profileId}/set_expiry/`, { expiry_date: editExpiryValue }, { withCredentials: true });
      if (res.data.success) {
        const todayStr = new Date().toISOString().substring(0, 10);
        const expired = res.data.trial_expiry_date < todayStr;
        setUsers(users.map(u => u.id === profileId ? { ...u, trial_expiry_date: res.data.trial_expiry_date, is_expired: expired } : u));
        setEditingExpiryId(null);
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update expiry date.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBlock = async (profileId) => {
    setActionLoading(`block-${profileId}`);
    try {
      const res = await axios.post(`${apiBase}/superadmin/users/${profileId}/toggle_block/`, {}, { withCredentials: true });
      if (res.data.success) {
        setUsers(users.map(u => u.id === profileId ? { ...u, is_blocked: res.data.is_blocked } : u));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle block status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleUpgrade = async (profileId) => {
    setActionLoading(`upgrade-${profileId}`);
    try {
      const res = await axios.post(`${apiBase}/superadmin/users/${profileId}/toggle_upgrade/`, {}, { withCredentials: true });
      if (res.data.success) {
        setUsers(users.map(u => u.id === profileId ? { ...u, is_upgraded: res.data.is_upgraded } : u));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to toggle upgrade status.');
    } finally {
      setActionLoading(null);
    }
  };

  // Metrics calculations
  const stats = useMemo(() => {
    const total = users.length;
    const upgraded = users.filter(u => u.is_upgraded).length;
    const blocked = users.filter(u => u.is_blocked).length;
    const activeTrial = users.filter(u => !u.is_upgraded && !u.is_blocked && !u.is_expired).length;
    const expired = users.filter(u => u.is_expired && !u.is_upgraded).length;
    return { total, upgraded, blocked, activeTrial, expired };
  }, [users]);

  // Filtering
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const searchStr = `${user.owner_name} ${user.business_name} ${user.username} ${user.phone}`.toLowerCase();
      const matchesSearch = searchStr.includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (statusFilter === 'active') return !user.is_blocked && !user.is_expired;
      if (statusFilter === 'blocked') return user.is_blocked;
      if (statusFilter === 'expired') return user.is_expired && !user.is_upgraded;
      if (statusFilter === 'upgraded') return user.is_upgraded;

      return true;
    });
  }, [users, searchQuery, statusFilter]);

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-PK', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {error && (
        <div className="notice error" style={{ background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', padding: '12px', borderRadius: '6px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Metrics Row */}
      <section className="statsGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div className="metric blue" style={{ background: 'var(--panel-bg)', border: 'var(--panel-border)', borderRadius: 'var(--panel-radius)', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: 'var(--panel-shadow)' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-color)', opacity: 0.7, display: 'block' }}>Total Registrations</span>
            <strong style={{ fontSize: '24px', color: 'var(--text-color)' }}>{stats.total}</strong>
          </div>
        </div>
        
        <div className="metric green" style={{ background: 'var(--panel-bg)', border: 'var(--panel-border)', borderRadius: 'var(--panel-radius)', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: 'var(--panel-shadow)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Star size={24} />
          </div>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-color)', opacity: 0.7, display: 'block' }}>Upgraded Premium</span>
            <strong style={{ fontSize: '24px', color: 'var(--text-color)' }}>{stats.upgraded}</strong>
          </div>
        </div>

        <div className="metric amber" style={{ background: 'var(--panel-bg)', border: 'var(--panel-border)', borderRadius: 'var(--panel-radius)', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: 'var(--panel-shadow)' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Calendar size={24} />
          </div>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-color)', opacity: 0.7, display: 'block' }}>Active Trials</span>
            <strong style={{ fontSize: '24px', color: 'var(--text-color)' }}>{stats.activeTrial}</strong>
          </div>
        </div>

        <div className="metric red" style={{ background: 'var(--panel-bg)', border: 'var(--panel-border)', borderRadius: 'var(--panel-radius)', padding: '20px', display: 'flex', alignItems: 'center', gap: '15px', boxShadow: 'var(--panel-shadow)' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Ban size={24} />
          </div>
          <div>
            <span style={{ fontSize: '13px', color: 'var(--text-color)', opacity: 0.7, display: 'block' }}>Blocked Users</span>
            <strong style={{ fontSize: '24px', color: 'var(--text-color)' }}>{stats.blocked}</strong>
          </div>
        </div>
      </section>

      {/* Control Actions & Search */}
      <section className="panel" style={{ background: 'var(--panel-bg)', border: 'var(--panel-border)', borderRadius: 'var(--panel-radius)', padding: '20px', boxShadow: 'var(--panel-shadow)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-color)', border: 'var(--panel-border)', padding: '8px 12px', borderRadius: '6px', minWidth: '300px' }}>
            <Search size={18} style={{ color: 'var(--text-color)', opacity: 0.6 }} />
            <input 
              type="text" 
              placeholder="Search by business, email, owner..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', color: 'var(--text-color)', fontSize: '14px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {['all', 'active', 'upgraded', 'expired', 'blocked'].map(filter => (
              <button 
                key={filter} 
                onClick={() => setStatusFilter(filter)} 
                style={{ 
                  padding: '6px 12px', 
                  borderRadius: '6px', 
                  border: 'var(--panel-border)',
                  background: statusFilter === filter ? 'var(--primary-color)' : 'transparent',
                  color: statusFilter === filter ? 'var(--primary-text)' : 'var(--text-color)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  textTransform: 'capitalize'
                }}
              >
                {filter === 'all' ? 'Show All' : filter}
              </button>
            ))}

            <button 
              onClick={fetchUsers} 
              title="Refresh"
              style={{ 
                padding: '6px 10px', 
                borderRadius: '6px', 
                border: 'var(--panel-border)',
                background: 'transparent',
                color: 'var(--text-color)',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={15} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Directory Table */}
        {loading ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-color)', opacity: 0.7 }}>Syncing registered directories...</p>
        ) : filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-color)', opacity: 0.7 }}>
            <strong>No user records match the filter.</strong>
          </div>
        ) : (
          <div className="tableWrap" style={{ overflowX: 'auto', border: 'var(--panel-border)', borderRadius: 'var(--panel-radius)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: 'var(--panel-border)', color: 'var(--text-color)', opacity: 0.8, fontSize: '13px' }}>
                  <th style={{ padding: '12px 8px', background: 'var(--bg-color)' }}>User Details</th>
                  <th style={{ padding: '12px 8px', background: 'var(--bg-color)' }}>Contact</th>
                  <th style={{ padding: '12px 8px', background: 'var(--bg-color)' }}>Joining & Expiry</th>
                  <th style={{ padding: '12px 8px', background: 'var(--bg-color)' }}>Plan Status</th>
                  <th style={{ padding: '12px 8px', background: 'var(--bg-color)' }}>Access Status</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right', background: 'var(--bg-color)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} style={{ borderBottom: 'var(--panel-border)', fontSize: '14px', color: 'var(--text-color)' }}>
                    <td style={{ padding: '12px 8px' }}>
                      <strong style={{ color: 'var(--text-color)', display: 'block' }}>{user.owner_name}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--text-color)', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Building size={12} /> {user.business_name}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <Mail size={13} style={{ color: 'var(--text-color)', opacity: 0.6 }} /> {user.username}
                      </span>
                      {user.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-color)', opacity: 0.7, marginTop: '2px' }}>
                          <Phone size={12} style={{ color: 'var(--text-color)', opacity: 0.6 }} /> {user.phone}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-color)' }}>
                        <Calendar size={13} style={{ color: 'var(--text-color)', opacity: 0.6 }} />
                        <span>Joined: {formatDate(user.joining_date)}</span>
                      </div>
                      {editingExpiryId === user.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <input 
                            type="date" 
                            value={editExpiryValue} 
                            onChange={(e) => setEditExpiryValue(e.target.value)} 
                            style={{ padding: '2px 4px', fontSize: '12px', border: 'var(--panel-border)', borderRadius: '4px', background: 'var(--bg-color)', color: 'var(--text-color)' }}
                          />
                          <button 
                            disabled={actionLoading === `expiry-${user.id}`}
                            onClick={() => handleSaveExpiry(user.id)} 
                            style={{ background: '#10b981', color: 'white', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            {actionLoading === `expiry-${user.id}` ? '...' : 'Save'}
                          </button>
                          <button 
                            onClick={() => setEditingExpiryId(null)} 
                            style={{ background: 'var(--primary-color)', color: 'var(--primary-text)', border: 'none', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-color)', opacity: 0.7, marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>Expires: {user.is_upgraded ? 'N/A (Premium)' : formatDate(user.trial_expiry_date)}</span>
                          {!user.is_portal_admin && !user.is_upgraded && (
                            <button 
                              onClick={() => {
                                setEditingExpiryId(user.id);
                                setEditExpiryValue(user.trial_expiry_date ? user.trial_expiry_date.substring(0, 10) : '');
                              }} 
                              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0, fontWeight: 'bold' }}
                            >
                              Extend/Change
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {user.is_upgraded ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          Premium
                        </span>
                      ) : user.is_expired ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          Expired Trial
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          Free Trial
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      {user.is_blocked ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          Blocked
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '3px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                          Active
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                      {user.is_portal_admin ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-color)', opacity: 0.6, fontStyle: 'italic' }}>System Superadmin</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            disabled={actionLoading !== null}
                            onClick={() => handleToggleUpgrade(user.id)}
                            style={{ 
                              background: user.is_upgraded ? 'var(--bg-color)' : '#059669', 
                              color: user.is_upgraded ? 'var(--text-color)' : 'white',
                              border: user.is_upgraded ? 'var(--panel-border)' : 'none', 
                              padding: '5px 10px', 
                              borderRadius: '4px', 
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {actionLoading === `upgrade-${user.id}` ? '...' : user.is_upgraded ? 'Downgrade' : 'Upgrade'}
                          </button>
                          
                          <button 
                            disabled={actionLoading !== null}
                            onClick={() => handleToggleBlock(user.id)}
                            style={{ 
                              background: user.is_blocked ? '#16a34a' : '#dc2626', 
                              color: 'white', 
                              border: 'none', 
                              padding: '5px 10px', 
                              borderRadius: '4px', 
                              cursor: 'pointer',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}
                          >
                            {actionLoading === `block-${user.id}` ? '...' : user.is_blocked ? 'Unblock' : 'Block'}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
