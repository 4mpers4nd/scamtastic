import { supabaseServer } from '@/lib/server';
import {
  ActivationRetryForm,
  ApplicationReviewForm,
} from '@/components/AdminActionForms';

type Application = {
  id: string;
  username: string;
  email: string;
  reason: string;
  referral_code: string | null;
  referrer_username: string | null;
  comments: string | null;
  status: string;
  referral_valid: boolean;
  submitted_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string | null;
  activation_status: string;
  history: Array<{ action: string; created_at: string; admin_id: string }>;
};

export default async function AdminApplications({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[]; q?: string | string[] }>;
}) {
  const params = await searchParams;
  const allowedStatuses = ['all', 'pending', 'approved', 'rejected'];
  const requestedStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const requestedQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = allowedStatuses.includes(requestedStatus ?? '') ? requestedStatus! : 'pending';
  const query = (requestedQuery ?? '').trim().slice(0, 100);
  const db = await supabaseServer();
  const { data, error } = await db.rpc('admin_list_applications', {
    p_status: status,
    p_search: query,
  });
  if (error) throw error;
  const applications = data as Application[];

  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// ACCESS CONTROL</div>
        <h1>Applications</h1>
        <p>Review requests before inviting applicants to verify their email.</p>
      </div>
      <div className="adminToolbar">
        <nav className="filterLinks" aria-label="Filter applications">
          {allowedStatuses.map((filter) => (
            <a
              key={filter}
              className={status === filter ? 'active' : ''}
              href={`/admin/applications?status=${filter}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
            >
              {filter[0].toUpperCase() + filter.slice(1)}
            </a>
          ))}
        </nav>
        <form className="searchForm" action="/admin/applications">
          <input type="hidden" name="status" value={status} />
          <label className="visuallyHidden" htmlFor="application-search">
            Search applications
          </label>
          <input
            id="application-search"
            name="q"
            type="search"
            maxLength={100}
            defaultValue={query}
            placeholder="Search username or email"
          />
          <button className="button secondary">Search</button>
        </form>
      </div>
      {applications.length === 0 ? (
        <p className="emptyState adminPanel">No applications match this filter.</p>
      ) : (
        <section className="adminCards">
          {applications.map((application) => (
            <details className="adminPanel applicationCard" key={application.id}>
              <summary className="panelHeading applicationSummary">
                <div>
                  <h2>{application.username}</h2>
                  <p>{application.email}</p>
                </div>
                <span className={`statusBadge ${application.status}`}>{application.status}</span>
              </summary>
              <div className="applicationDetails">
                <p className="applicationReason">{application.reason}</p>
                <dl className="detailList">
                  <div>
                    <dt>Submitted</dt>
                    <dd>
                      <time dateTime={application.submitted_at}>
                        {new Date(application.submitted_at).toLocaleString()}
                      </time>
                    </dd>
                  </div>
                  <div>
                    <dt>Referral</dt>
                    <dd>
                      {application.referral_code
                        ? `${application.referral_code}${application.referrer_username ? ` · ${application.referrer_username}` : ''} · ${application.referral_valid ? 'valid' : 'inactive'}`
                        : 'None'}
                    </dd>
                  </div>
                  {application.comments && (
                    <div>
                      <dt>Additional comments</dt>
                      <dd>{application.comments}</dd>
                    </div>
                  )}
                  {application.reviewed_at && (
                    <div>
                      <dt>Reviewed</dt>
                      <dd>
                        <time dateTime={application.reviewed_at}>
                          {new Date(application.reviewed_at).toLocaleString()}
                        </time>
                      </dd>
                    </div>
                  )}
                  {application.history.length > 0 && (
                    <div>
                      <dt>Application history</dt>
                      <dd>
                        {application.history.map((entry) => (
                          <p key={`${entry.action}-${entry.created_at}`}>
                            {entry.action} · {new Date(entry.created_at).toLocaleString()}
                          </p>
                        ))}
                      </dd>
                    </div>
                  )}
                  {application.status === 'approved' && (
                    <div>
                      <dt>Activation</dt>
                      <dd>{application.activation_status}</dd>
                    </div>
                  )}
                </dl>
                <ApplicationReviewForm
                  id={application.id}
                  status={application.status}
                  notes={application.admin_notes}
                />
                {application.status === 'approved' &&
                  application.activation_status !== 'claimed' && (
                    <ActivationRetryForm id={application.id} />
                  )}
              </div>
            </details>
          ))}
        </section>
      )}
    </>
  );
}
