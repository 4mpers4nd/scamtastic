import Header from '@/components/Header';
import ApplicationForm from '@/components/ApplicationForm';

export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[]; invite?: string | string[] }>;
}) {
  const params = await searchParams;
  const referralCode = Array.isArray(params.ref) ? params.ref[0] : params.ref;
  const invitationCode = Array.isArray(params.invite) ? params.invite[0] : params.invite;

  return (
    <>
      <Header />
      <main className="formWrap">
        <ApplicationForm
          referralCode={referralCode ?? ''}
          invitationCode={invitationCode ?? ''}
        />
      </main>
    </>
  );
}
