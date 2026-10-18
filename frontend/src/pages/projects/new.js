import { useEffect } from "react";
import { useRouter } from "next/router";

import { useUser } from "@/stores/authStore";
import { Card } from "@/components/common/Card";
import { LoadingSpinner } from "@/components/common/LoadingStates";
import ProjectEditor from "@/components/projects/ProjectEditor";

export default function NewProjectPage() {
  const router = useRouter();
  const { currentUser, loading } = useUser();

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login?redirect=/projects/new");
    }
  }, [currentUser, loading, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!currentUser) return null;

  return (
    <div className="max-w-5xl mx-auto py-8">
      <ProjectEditor />

      <Card className="p-6 mt-6 bg-surface-secondary border border-default">
        <div className="text-sm text-secondary">
          Tip: name the hackathon and add a link that proves the win — a Devpost
          page, announcement, or leaderboard entry. The verifier checks it, the win
          anchors on-chain, and the payout clock starts measuring.
        </div>
      </Card>
    </div>
  );
}
