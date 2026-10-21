import Header from '@/components/Header';
import ApplicationForm from '@/components/ApplicationForm';

export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const params = await searchParams;
  const invitationCode = Array.isArray(params.invite) ? params.invite[0] : params.invite;

  return (
    <>
      <Header />
      <main className="formWrap">
        <ApplicationForm invitationCode={invitationCode ?? ''} />
      </main>
    </>
  );
}
