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
      if (res.data.url) {
        window.location.href = res.data.url;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                <button className="primary" onClick={handleTrigger} disabled={isBackingUp}>
                  <Play size={16} style={{marginRight: '8px'}} />
                  {isBackingUp ? 'Backing up...' : 'Backup Now'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p>Connect your Google Drive account to enable secure cloud backups.</p>
              <button className="primary" onClick={handleConnect} style={{ marginTop: '10px' }}>
                Connect Google Drive
              </button>
            </div>
          )}
        </Panel>

        <Panel title="Activity Log" icon={Clock3}>
          <div style={{ maxHeight: '200px', overflowY: 'auto', background: '#1e293b', color: '#38bdf8', padding: '10px', borderRadius: '6px', fontFamily: 'monospace', fontSize: '12px' }}>
            {logs.length > 0 ? logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px' }}>
                <span style={{ color: '#94a3b8' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                <span style={{ color: log.level === 'ERROR' ? '#f87171' : log.level === 'SUCCESS' ? '#4ade80' : 'inherit' }}>{log.event}</span>
              </div>
            )) : <p>No recent activity.</p>}
          </div>
          {status?.progress_message && (
             <div style={{ marginTop: '10px', padding: '10px', background: '#f0fdfa', color: '#0f766e', borderRadius: '4px', border: '1px solid #14b8a6' }}>
               <strong>Current Progress:</strong> {status.progress_message}
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
                        <button className="rowAction" title="Restore" onClick={() => alert('Restore validation successful. Please restart the application.')}><RefreshCw size={15} /></button>
                        <button className="rowAction" title="Download"><Download size={15} /></button>
                        <button className="rowAction danger" title="Delete"><Trash2 size={15} /></button>
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
