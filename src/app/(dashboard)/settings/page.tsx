import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import SettingsContent from './_components/SettingsContent';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');
  return <SettingsContent />;
}
