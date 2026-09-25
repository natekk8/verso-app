import { ManageSidebar } from "@/components/layout/manage-sidebar";

export default async function ManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = await params;
  
  return (
    <div className="flex min-h-screen bg-zinc-950">
      <ManageSidebar tournamentId={tournamentId} />
      {/* Main content - offset for sidebar on desktop, full width on mobile with bottom nav space */}
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        {children}
      </div>
    </div>
  );
}
