import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Cloud, CheckCircle2, Clock3, HardDrive, RefreshCw, Lock, Database, Trash2, Download, AlertCircle, Play } from 'lucide-react';

const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

function Panel({ title, icon: Icon, children, actions = null }) { 
    return <section className="panel"><div className="panelTitle"><div><Icon size={19} /><h2>{title}</h2></div>{actions}</div>{children}</section> 
}

function Metric({ icon: Icon, label, value, tone }) { 
    return <div className={`metric ${tone}`}><div className="metricIcon"><Icon /></div><span>{label}</span><strong>{value}</strong></div> 
}

function EmptyState({ title, body }) { 
    return <div className="emptyState"><strong>{title}</strong><span>{body}</span></div> 
}

export default function BackupPanel() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await axios.get(`${apiBase}/backup/status/`, { withCredentials: true });
      setStatus(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${apiBase}/backup/history/`, { withCredentials: true });
      setHistory(res.data.files || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${apiBase}/backup/logs/`, { withCredentials: true });
      setLogs(res.data.logs || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchStatus(), fetchHistory(), fetchLogs()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 5000); // Live polling
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    try {
      const res = await axios.get(`${apiBase}/backup/auth/url/`, { withCredentials: true });
      if (res.data.success && res.data.auth_url) {
        window.location.href = res.data.auth_url;
      } else if (res.data.success === false) {
        alert(`${res.data.message || res.data.error}\n\nMissing: ${res.data.missing?.join(', ') || ''}`);
      }
    } catch (e) {
      alert('Failed to get auth URL');
    }
  };

  const handleTrigger = async () => {
    try {
      await axios.post(`${apiBase}/backup/trigger/`, {}, { withCredentials: true });
      alert('Backup triggered! Check activity log.');
      fetchStatus();
      fetchLogs();
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to trigger backup');
    }
  };

  const handleDisconnect = async () => {
    const confirmed = window.confirm("Disconnect Google Drive?\n\nThis will remove the saved Google account from this application.\nYour backups stored in Google Drive will NOT be deleted.");
    if (!confirmed) return;
    
    try {
      const res = await axios.post(`${apiBase}/backup/disconnect/`, {}, { withCredentials: true });
      if (res.data.success) {
        alert('Google Drive disconnected successfully.');
        setStatus(prev => ({ ...prev, connected: false, email: null }));
        fetchLogs();
      } else {
        alert(`Disconnect failed\n\nReason:\n${res.data.message || res.data.error || 'Unknown error'}`);
      }
    } catch (e) {
      alert(`Disconnect failed\n\nReason:\n${e.response?.data?.message || e.response?.data?.error || e.message}`);
    }
  };

  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestore = async () => {
    const confirmed = window.confirm("This will replace your current company data.\n\nAre you sure?");
    if (!confirmed) return;
    
    setIsRestoring(true);
    try {
      const res = await axios.post(`${apiBase}/backup/restore/`, {}, { withCredentials: true });
      if (res.data.success) {
        alert(res.data.message);
        window.location.reload();
      } else {
        alert(`Restore failed\n\nStep: ${res.data.step}\nError: ${res.data.error}`);
        setIsRestoring(false);
      }
    } catch (e) {
      alert(`Restore failed\n\nError: ${e.response?.data?.error || e.message}`);
      setIsRestoring(false);
    }
  };

  const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  };

  if (loading && !status) {
    return <p>Loading backup status...</p>;
  }

  const isBackingUp = status?.status !== 'IDLE';
  const isWorking = isBackingUp || isRestoring;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {status?.success === false && (
        <div style={{ padding: '15px', background: '#fef2f2', border: '1px solid #f87171', color: '#b91c1c', borderRadius: '6px' }}>
          <AlertCircle size={20} style={{ verticalAlign: 'middle', marginRight: '10px' }} />
          <strong>System Warning:</strong> {status.error || status.message}
        </div>
      )}

      <section className="statsGrid">
        <Metric icon={Cloud} label="Google Drive" value={status?.connected ? 'Connected' : 'Disconnected'} tone={status?.connected ? 'green' : 'amber'} />
        <Metric icon={Database} label="Last Backup" value={status?.last_backup_date ? new Date(status.last_backup_date).toLocaleString() : 'Never'} tone="blue" />
        <Metric icon={Lock} label="Encryption" value="AES-256-GCM" tone="blue" />
        <Metric icon={RefreshCw} label="Sync Status" value={status?.is_dirty ? 'Pending Changes' : 'Synced'} tone={status?.is_dirty ? 'amber' : 'green'} />
      </section>

      <div className="contentGrid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Panel title="Cloud Connection" icon={Cloud}>
          {status?.connected ? (
            <div>
              <p><strong>Connected Account:</strong> {status.email}</p>
              <p><strong>Auto Backup:</strong> {status.auto_backup_enabled ? 'Enabled' : 'Disabled'}</p>
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button className="primary" onClick={handleTrigger} disabled={isWorking}>
                  <Play size={16} style={{marginRight: '8px'}} />
                  {isBackingUp ? 'Backing up...' : 'Backup Now'}
                </button>
                <button style={{ background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer' }} onClick={handleDisconnect} disabled={isWorking}>
                  Disconnect Google Drive
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>Connect your Google Drive account to enable secure cloud backups.</p>
              <button className="primary" onClick={handleConnect} style={{ marginTop: '10px' }} disabled={isWorking}>
                Connect Google Drive
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Activity Log" icon={Activity}>
          <div className="activityLog">
            {logs.length > 0 ? logs.map((log, i) => (
              <div key={i} className="logEntry">
                <span className="logTime">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className={`logEvent ${log.level.toLowerCase()}`}>
                  {log.event}
                </span>
              </div>
            )) : <p>No recent activity.</p>}
          </div>
          {status?.progress_message && (
             <div style={{ marginTop: '10px', padding: '10px', background: '#f0fdfa', color: '#0f766e', borderRadius: '4px', border: '1px solid #14b8a6' }}>
               <strong>Current Progress:</strong> {status.progress_message}
             </div>
          )}
          {isRestoring && (
             <div style={{ marginTop: '10px', padding: '10px', background: '#fffbeb', color: '#b45309', borderRadius: '4px', border: '1px solid #f59e0b' }}>
               <strong>Restoring Database:</strong> Please wait, fetching live logs...
             </div>
          )}
        </Panel>
      </div>

      <Panel title="Backup History" icon={HardDrive}>
        {history.length > 0 ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Filename</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((file) => (
                  <tr key={file.id}>
                    <td>{new Date(file.createdTime).toLocaleString()}</td>
                    <td><strong>{file.name}</strong></td>
                    <td>{formatBytes(file.size)}</td>
                    <td><span className="pill" style={{background: '#dcfce7', color: '#166534'}}>Verified</span></td>
                    <td>
                      <div className="rowActions">
                        <button className="rowAction" title="Restore" onClick={handleRestore} disabled={isWorking}>
                          <RefreshCw size={15} />
                        </button>
                        <button className="rowAction" title="Download" disabled={isWorking}><Download size={15} /></button>
                        <button className="rowAction danger" title="Delete" disabled={isWorking}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No backups found" body="Your Google Drive history is currently empty." />
        )}
      </Panel>
    </div>
  );
}
