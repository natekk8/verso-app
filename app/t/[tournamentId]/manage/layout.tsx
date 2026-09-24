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
    <div className="flex min-h-screen bg-background">
      <ManageSidebar tournamentId={tournamentId} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
