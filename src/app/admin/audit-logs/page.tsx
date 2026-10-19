import { supabaseServer } from '@/lib/server';

type AuditLog = {
  id: number;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export default async function AdminAuditLogs() {
  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_list_audit_logs');
  if (error) throw error;
  const logs = data as AuditLog[];

  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// ACCOUNTABILITY</div>
        <h1>Audit logs</h1>
        <p>Append-only record of recent administrative changes.</p>
      </div>
      {logs.length === 0 ? (
        <p className="emptyState adminPanel">No administrative activity recorded.</p>
      ) : (
        <div className="tableWrap">
          <table className="adminTable">
            <thead>
              <tr><th>When</th><th>Action</th><th>Target</th><th>Administrator</th><th>Metadata</th></tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time></td>
                  <td><code>{log.action}</code></td>
                  <td>{log.target_type}: {log.target_id}</td>
                  <td><code>{log.admin_id}</code></td>
                  <td><code>{JSON.stringify(log.metadata)}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
