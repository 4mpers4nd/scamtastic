import { TestEmailForm } from '@/components/AdminActionForms';

export default function AdminSettings() {
  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// CONFIGURATION</div>
        <h1>Administration settings</h1>
        <p>Environment configuration is managed outside the application.</p>
      </div>
      <section className="adminPanel">
        <h2>Activation email</h2>
        <p>
          Application approval creates one-time Supabase Auth invite or magic links and
          sends them through Resend. Configure <code>RESEND_API_KEY</code>,
          <code> EMAIL_FROM</code>, and <code>NEXT_PUBLIC_SITE_URL</code> before sending
          invitations.
        </p>
        <p>
          The test message is sent only to your verified administrator email. It does not
          accept a recipient address and is limited to one send every five minutes per
          administrator instance.
        </p>
        <TestEmailForm />
        <p>
          Do not paste secrets into this dashboard. Configure service credentials only in
          Vercel server-side environment variables.
        </p>
      </section>
    </>
  );
}
