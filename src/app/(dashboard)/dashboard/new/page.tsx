import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import NewInvoiceForm from './_components/NewInvoiceForm';

export default async function NewInvoicePage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <NewInvoiceForm />;
}
