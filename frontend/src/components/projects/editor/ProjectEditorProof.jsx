/**
 * ProjectEditorProof — Step 2 / "Proof & Polish" content.
 *
 * Optional details: onchain contract info, links + accent color, team
 * members with shares, milestones, hackathon claims. The "show
 * optional" toggle is owned by the parent.
 */

import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/common/Card";
import { Input, Textarea, Select, Checkbox } from "@/components/common/Input";
import Button from "@/components/common/Button";
import AccentColorPicker from "@/components/projects/AccentColorPicker";

const HACKATHON_OUTCOMES = [
  { value: "", label: "Select proof type" },
  { value: "payout_tx", label: "Prize payout transaction" },
  { value: "announcement", label: "Public winner announcement" },
  { value: "submission_page", label: "Submission page" },
  { value: "wallet_signature", label: "Wallet-linked claim" },
  { value: "repo_contract_match", label: "Repo + contract match" },
  { value: "mixed", label: "Mixed evidence" },
];

const VERIFICATION_STATUSES = [
  { value: "self_attested", label: "Self-attested" },
  { value: "evidence_attached", label: "Evidence attached" },
  { value: "wallet_linked", label: "Wallet linked" },
  // `payout_verified` is deliberately not offered here: it may only be set by
  // the payout verification pipeline after a real on-chain receipt is matched.
  // Self-selecting it would corrupt the credibility signal the platform is
  // built on, so it is read-only in the editor.
];

export default function ProjectEditorProof({
  form,
  setField,
  updateArrayItem,
  addArrayItem,
  removeArrayItem,
  addHackathon,
  updateHackathon,
  removeHackathon,
}) {
  const [showOptional, setShowOptional] = useState(false);
  const totalShare = form.teamMembers.reduce((sum, m) => sum + (parseInt(m.share) || 0), 0);
  const tokenLaunchMetWins = form.hackathons.filter((h) => h.outcome === "winner").length;

  return (
    <>
      <button
        type="button"
        className="w-full flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800 border border-blue-200 dark:border-gray-700 rounded-lg px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 hover:from-blue-100 hover:to-indigo-100 transition-colors"
        onClick={() => setShowOptional(!showOptional)}
      >
        <span className="flex items-center gap-2">
          {showOptional ? "Hide" : "Show"} optional details
          <span className="text-xs text-blue-600 dark:text-blue-400 font-normal">— projects with links get 3× more backer views</span>
        </span>
        {showOptional ? <ChevronUpIcon className="w-5 h-5" /> : <ChevronDownIcon className="w-5 h-5" />}
      </button>

      {showOptional && (
        <>
          <Card className="p-6 space-y-5">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Onchain</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Contract address (optional)"
                value={form.contractAddress}
                onChange={(e) => setField("contractAddress", e.target.value)}
                placeholder="0x... (leave blank if not deployed yet)"
              />
              <Input
                label="Deployment tx (optional)"
                value={form.deploymentTxHash}
                onChange={(e) => setField("deploymentTxHash", e.target.value)}
                placeholder="0x..."
              />
            </div>
          </Card>

          <Card className="p-6 space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Links & Team</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Backers look for signals that you are real and active. A Twitter/X account shows your builder journey.
                Discord shows community engagement. A website shows you care about users, not just code.
              </p>
            </div>

            <AccentColorPicker value={form.accentColor} onChange={(val) => setField("accentColor", val)} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Input
                  label="Twitter / X"
                  value={form.twitter}
                  onChange={(e) => setField("twitter", e.target.value)}
                  placeholder="https://x.com/yourhandle"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Build in public. Backers follow your progress here.</p>
              </div>
              <div>
                <Input
                  label="Discord"
                  value={form.discord}
                  onChange={(e) => setField("discord", e.target.value)}
                  placeholder="https://discord.gg/yourserver"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Shows you have a community. Backers love early traction.</p>
              </div>
              <div>
                <Input
                  label="Website"
                  value={form.website}
                  onChange={(e) => setField("website", e.target.value)}
                  placeholder="https://yourapp.com"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Landing page, docs, or demo — any link where users can try it.</p>
              </div>
            </div>

            <Input
              label="Tags (comma separated)"
              value={form.tags}
              onChange={(e) => setField("tags", e.target.value)}
              placeholder="payments, defi, wallets"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Checkbox
                label="Open source"
                checked={form.isOpenSource}
                onChange={(e) => setField("isOpenSource", e.target.checked)}
              />
              <Checkbox
                label="Looking for funding"
                checked={form.lookingForFunding}
                onChange={(e) => setField("lookingForFunding", e.target.checked)}
              />

              {form.ecosystem === "solana" && (
                <div className="md:col-span-2">
                  <div className="bg-gradient-to-br from-emerald-50 to-amber-50 border border-emerald-200 p-4 rounded-xl">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xl mt-0.5">🚀</span>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">Token Launch Readiness</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Launch a project token on Bags once you&apos;ve proven traction. Tokens launched after reaching milestones tend to perform better with backers.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <ReadinessCard
                        label="Hackathon Wins"
                        value={tokenLaunchMetWins}
                        target={2}
                        met={tokenLaunchMetWins >= 2}
                        hint={tokenLaunchMetWins >= 2 ? "✓ Met" : "Wins needed"}
                      />
                      <ReadinessCard label="Backers" value="0" target="5" met={false} hint="After launch" />
                      <ReadinessCard
                        label="Description"
                        value={form.description.trim().length >= 50 ? "✓" : `${Math.min(Math.round(form.description.trim().length / 50 * 100), 99)}%`}
                        target=""
                        met={form.description.trim().length >= 50}
                        hint={form.description.trim().length >= 50 ? "Complete" : "Min 50 chars"}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-white/70 border border-emerald-100">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Launch token on Bags</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {form.launchOnBags ? "Token will be created when you submit." : "Enable to configure your token."}
                        </p>
                      </div>
                      <Checkbox
                        label=""
                        checked={form.launchOnBags}
                        onChange={(e) => setField("launchOnBags", e.target.checked)}
                      />
                    </div>

                    {form.launchOnBags && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-white/70 border border-emerald-100">
                        <Input
                          label="Token Name"
                          placeholder="e.g. PledgeBond Token"
                          value={form.bagsTokenMetadata.name}
                          onChange={(e) => setField("bagsTokenMetadata", { ...form.bagsTokenMetadata, name: e.target.value })}
                        />
                        <Input
                          label="Token Symbol"
                          placeholder="e.g. SHIP"
                          value={form.bagsTokenMetadata.symbol}
                          onChange={(e) => setField("bagsTokenMetadata", { ...form.bagsTokenMetadata, symbol: e.target.value.toUpperCase() })}
                        />
                        <div className="sm:col-span-2">
                          <Textarea
                            label="Token Description"
                            placeholder="Describe the utility or vision for your project token..."
                            value={form.bagsTokenMetadata.description}
                            onChange={(e) => setField("bagsTokenMetadata", { ...form.bagsTokenMetadata, description: e.target.value })}
                            rows={2}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {form.lookingForFunding && (
              <Input
                label="Funding amount (optional)"
                value={form.fundingAmount}
                onChange={(e) => setField("fundingAmount", e.target.value)}
                placeholder="$500 - $5,000"
              />
            )}

            <TeamMembers
              teamMembers={form.teamMembers}
              totalShare={totalShare}
              updateArrayItem={updateArrayItem}
              addArrayItem={addArrayItem}
              removeArrayItem={removeArrayItem}
            />
          </Card>

          <Milestones
            milestones={form.milestones}
            updateArrayItem={updateArrayItem}
            addArrayItem={addArrayItem}
            removeArrayItem={removeArrayItem}
          />

          <HackathonClaims
            hackathons={form.hackathons}
            addHackathon={addHackathon}
            updateHackathon={updateHackathon}
            removeHackathon={removeHackathon}
          />
        </>
      )}
    </>
  );
}

function ReadinessCard({ label, value, target, met, hint }) {
  return (
    <div className="p-3 rounded-lg bg-white/70 border border-emerald-100 text-center">
      <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase mb-1">{label}</p>
      <p className="text-lg font-bold">
        <span className={met ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400 dark:text-gray-500"}>{value}</span>
        {target !== "" && <span className="text-gray-300 dark:text-gray-500 text-sm">/{target}</span>}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>
    </div>
  );
}

function TeamMembers({ teamMembers, totalShare, updateArrayItem, addArrayItem, removeArrayItem }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Team Members & Shares</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addArrayItem("teamMembers", { address: "", share: 0 })}
          leftIcon={<PlusIcon className="w-4 h-4" />}
        >
          Add Member
        </Button>
      </div>

      <div className="space-y-3">
        {teamMembers.map((member, idx) => (
          <div key={idx} className="flex flex-col sm:flex-row items-start gap-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
            <div className="flex-1 w-full">
              <Input
                label="Wallet Address / GitHub"
                value={member.address || ""}
                onChange={(e) => updateArrayItem("teamMembers", idx, { ...member, address: e.target.value })}
                placeholder="0x... or username"
              />
            </div>
            <div className="w-full sm:w-32">
              <Input
                label="Share %"
                type="number"
                min="0"
                max="100"
                value={member.share || 0}
                onChange={(e) => updateArrayItem("teamMembers", idx, { ...member, share: parseInt(e.target.value) || 0 })}
                placeholder="%"
              />
            </div>
            <div className="sm:pt-7">
              {teamMembers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeArrayItem("teamMembers", idx)}
                  className="text-red-500 dark:text-red-400 hover:text-red-700 dark:text-red-300"
                >
                  <TrashIcon className="w-5 h-5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between items-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Set 100% for single developers. For teams, total must equal 100% for automated splits.
        </p>
        <div className={`text-sm font-bold ${totalShare === 100 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}`}>
          Total Share: {totalShare}%
        </div>
      </div>
    </div>
  );
}

function Milestones({ milestones, updateArrayItem, addArrayItem, removeArrayItem }) {
  return (
    <Card className="p-6 space-y-5">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Milestones</h3>
      <div className="space-y-2">
        {milestones.map((m, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={m}
              onChange={(e) => updateArrayItem("milestones", idx, e.target.value)}
              placeholder="What will you ship next?"
              className="flex-1"
            />
            {milestones.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeArrayItem("milestones", idx)}
                leftIcon={<TrashIcon className="w-4 h-4" />}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => addArrayItem("milestones")}
        leftIcon={<PlusIcon className="w-4 h-4" />}
      >
        Add milestone
      </Button>
    </Card>
  );
}

function HackathonClaims({ hackathons, addHackathon, updateHackathon, removeHackathon }) {
  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hackathon proof</h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            This is a core PledgeBond signal. Add structured evidence that ties your repo, wallet, and public win/submission history together.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={addHackathon} leftIcon={<PlusIcon className="w-4 h-4" />}>
          Add claim
        </Button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-medium mb-1">What strong proof looks like</div>
        <ul className="list-disc pl-5 space-y-1 text-amber-800">
          <li>Hackathon name + result (winner, finalist, bounty, submitted)</li>
          <li>Public submission or announcement URL</li>
          <li>Payout wallet and prize transaction hash when available</li>
          <li>Repo and contract/deployment references that match the claim</li>
        </ul>
      </div>

      {hackathons.length === 0 ? (
        <div className="text-gray-600 dark:text-gray-400">No hackathon claims yet. Add one if this project was submitted to or won a hackathon.</div>
      ) : (
        <div className="space-y-4">
          {hackathons.map((h, idx) => (
            <Card key={idx} className="p-4 bg-gray-50 border border-gray-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">Hackathon claim {idx + 1}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Attach enough evidence for backers and reviewers to trust the claim.</div>
                </div>
                <Button type="button" variant="ghost" onClick={() => removeHackathon(idx)} leftIcon={<TrashIcon className="w-4 h-4" />}>
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Input label="Hackathon name" value={h.name} onChange={(e) => updateHackathon(idx, "name", e.target.value)} placeholder="ETHGlobal Cannes / Celo Camp / Superteam..." />
                <Input label="Track or bounty" value={h.track || ""} onChange={(e) => updateHackathon(idx, "track", e.target.value)} placeholder="DeFi, Infra, AI x Crypto, Payments..." />
                <Input label="Outcome" value={h.outcome} onChange={(e) => updateHackathon(idx, "outcome", e.target.value)} placeholder="Winner / finalist / bounty winner / submitted" />
                <Input label="Prize amount (optional)" value={h.prizeAmount || ""} onChange={(e) => updateHackathon(idx, "prizeAmount", e.target.value)} placeholder="$2,500 USDC" />
                <Input
                  label="Submission URL"
                  value={h.submissionUrl || h.url || ""}
                  onChange={(e) => {
                    updateHackathon(idx, "submissionUrl", e.target.value);
                    updateHackathon(idx, "url", e.target.value);
                  }}
                  placeholder="Devpost / DoraHacks / hackathon submission page"
                />
                <Input label="Announcement URL" value={h.announcementUrl || ""} onChange={(e) => updateHackathon(idx, "announcementUrl", e.target.value)} placeholder="X/Twitter, Farcaster, official winners page" />
                <Input label="Evidence URL" value={h.evidenceUrl || ""} onChange={(e) => updateHackathon(idx, "evidenceUrl", e.target.value)} placeholder="Demo video, judging page, blog post, screenshot thread" />
                <Input label="Repo used for submission" value={h.repoUrl || ""} onChange={(e) => updateHackathon(idx, "repoUrl", e.target.value)} placeholder="https://github.com/owner/repo" />
                <Input label="Payout wallet" value={h.payoutWallet || ""} onChange={(e) => updateHackathon(idx, "payoutWallet", e.target.value)} placeholder="0x... or Solana address that received prize funds" />
                <Input label="Prize payout tx hash" value={h.payoutTxHash || ""} onChange={(e) => updateHackathon(idx, "payoutTxHash", e.target.value)} placeholder="Onchain payout transaction hash" />
                <Input label="Payout received at" value={h.payoutAt} onChange={(e) => updateHackathon(idx, "payoutAt", e.target.value)} placeholder="2025-12-01" />
                <Input label="Contract or deployment reference" value={h.contractAddress || ""} onChange={(e) => updateHackathon(idx, "contractAddress", e.target.value)} placeholder="0x... or program address tied to this submission" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <Select label="Primary proof type" value={h.proofType || ""} onChange={(e) => updateHackathon(idx, "proofType", e.target.value)}>
                  {HACKATHON_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
                <Select label="Verification status" value={h.verificationStatus || "self_attested"} onChange={(e) => updateHackathon(idx, "verificationStatus", e.target.value)}>
                  {VERIFICATION_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </div>

              <div className="mt-4">
                <Textarea
                  label="Why this proves the claim"
                  value={h.notes}
                  onChange={(e) => updateHackathon(idx, "notes", e.target.value)}
                  placeholder="Explain how the payout wallet, repo, submission, and announcement tie back to this project."
                  rows={3}
                />
              </div>

              <div className="mt-4">
                <Textarea
                  label="Judge feedback / extra context"
                  value={h.judgingNotes || ""}
                  onChange={(e) => updateHackathon(idx, "judgingNotes", e.target.value)}
                  placeholder="Optional: judge comments, award rationale, context for reviewers."
                  rows={2}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </Card>
  );
}
