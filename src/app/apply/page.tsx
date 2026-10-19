import Header from '@/components/Header';
import ApplicationForm from '@/components/ApplicationForm';

export default async function Apply({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const referralCode = Array.isArray(params.ref) ? params.ref[0] : params.ref;

  return (
    <>
      <Header />
      <main className="formWrap">
        <ApplicationForm referralCode={referralCode ?? ''} />
      </main>
    </>
  );
}
