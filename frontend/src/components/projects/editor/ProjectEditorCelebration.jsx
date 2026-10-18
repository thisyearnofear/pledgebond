/**
 * ProjectEditorCelebration — Confetti + share card shown after a
 * successful new-project submission.
 */

import { useState } from "react";
import { CheckCircleIcon, ClipboardDocumentIcon, ShareIcon } from "@heroicons/react/24/outline";
import Confetti from "@/components/common/Confetti";
import { Card } from "@/components/common/Card";
import Button from "@/components/common/Button";

export default function ProjectEditorCelebration({ slug, ecosystem, name, currentUser }) {
  const [copied, setCopied] = useState(false);
  const profileHandle = currentUser?.reloadUserInfo?.screenName || currentUser?.displayName || "you";
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/u/${profileHandle}`;
  const projectUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/projects/${ecosystem}/${slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    const text = `Just shipped ${name.trim()} on PledgeBond! Check it out:`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(projectUrl)}`, "_blank");
  };

  return (
    <>
      <Confetti duration={4000} count={80} />
      <Card className="p-8 mt-6 text-center space-y-5 border-2 border-green-200 bg-gradient-to-br from-green-50 via-white to-blue-50">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircleIcon className="w-10 h-10 text-green-600 dark:text-green-400" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Project shipped!</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Your project is live. Share it to get backers and build momentum.</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-2 max-w-md mx-auto">
          <code className="text-sm text-gray-700 dark:text-gray-300 flex-1 text-left truncate">{shareUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 dark:text-gray-300 transition-colors"
            title="Copy link"
          >
            {copied ? <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400" /> : <ClipboardDocumentIcon className="w-5 h-5" />}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button onClick={() => { window.location.href = projectUrl; }}>View your project</Button>
          <Button variant="outline" onClick={handleShare}><ShareIcon className="w-4 h-4 mr-1" /> Share on X</Button>
          <Button variant="ghost" onClick={() => { window.location.href = "/projects/new"; }}>Submit another</Button>
        </div>
      </Card>
    </>
  );
}
