import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function ShiftsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force dynamic by accessing headers
  await headers();
  
  return <>{children}</>;
}
