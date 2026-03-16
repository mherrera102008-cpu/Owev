import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/dashboard');
  }
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">InvoiceTracker</h1>
      <p className="text-muted-foreground">Automated payment reminders for small businesses</p>
      <a
        href="/sign-in"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        Sign in
      </a>
    </main>
  );
}
