import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function SlugRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  try {
    const tournament = await convex.query(api.tournaments.getBySlug, { slug });
    
    if (tournament) {
      redirect(`/t/${tournament._id}/public`);
    } else {
      redirect("/");
    }
  } catch (error) {
    redirect("/");
  }
}

export const runtime = "edge";
