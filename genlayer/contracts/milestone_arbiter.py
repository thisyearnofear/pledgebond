# milestone_arbiter.py — PledgeBond x GenLayer Agent Tank (Future of Work)
# Deploy: paste into https://studio.genlayer.com/contracts → Deploy (testnet).
from genlayer import *


@gl.contract
class MilestoneArbiter(gl.Contract):
    owner: str
    milestone_count: u256
    descriptions: TreeMap[u256, str]
    evidence_urls: TreeMap[u256, str]
    criteria: TreeMap[u256, str]
    verdicts: TreeMap[u256, str]
    confidence: TreeMap[u256, str]
    reasons: TreeMap[u256, str]
    requesters: TreeMap[u256, str]
    finalized: TreeMap[u256, bool]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.milestone_count = u256(0)

    @gl.public.view
    def get_total(self) -> u256:
        return self.milestone_count

    @gl.public.view
    def get_verdict(self, milestone_id: u256) -> str:
        if milestone_id not in self.verdicts:
            return "PENDING"
        return self.verdicts[milestone_id]

    @gl.public.view
    def get_milestone(self, milestone_id: u256) -> dict:
        return {
            "id": int(milestone_id),
            "description": self.descriptions[milestone_id] if milestone_id in self.descriptions else "",
            "evidence_url": self.evidence_urls[milestone_id] if milestone_id in self.evidence_urls else "",
            "criteria": self.criteria[milestone_id] if milestone_id in self.criteria else "",
            "verdict": self.verdicts[milestone_id] if milestone_id in self.verdicts else "PENDING",
            "confidence": self.confidence[milestone_id] if milestone_id in self.confidence else "",
            "reason": self.reasons[milestone_id] if milestone_id in self.reasons else "",
            "requester": self.requesters[milestone_id] if milestone_id in self.requesters else "",
            "finalized": self.finalized[milestone_id] if milestone_id in self.finalized else False,
        }

    @gl.public.write
    def submit_milestone(self, description: str, evidence_url: str, criteria: str) -> u256:
        assert len(description) > 0, "Description required"
        assert len(evidence_url) > 0, "Public evidence URL required"
        mid = self.milestone_count
        self.descriptions[mid] = description
        self.evidence_urls[mid] = evidence_url
        self.criteria[mid] = criteria if len(criteria) > 0 else "Work is complete and demonstrable."
        self.verdicts[mid] = "PENDING"
        self.confidence[mid] = ""
        self.reasons[mid] = ""
        self.requesters[mid] = gl.message.sender_address
        self.finalized[mid] = False
        self.milestone_count = u256(int(mid) + 1)
        return mid
    @gl.public.write
    def resolve_milestone(self, milestone_id: u256) -> str:
        assert milestone_id in self.descriptions, "Milestone does not exist"
        description = self.descriptions[milestone_id]
        evidence_url = self.evidence_urls[milestone_id]
        criteria = self.criteria[milestone_id]
        # Validators fetch independently — no oracle. Impossible on EVM/Solana.
        web_content = gl.get_webpage(evidence_url, mode="text")
        prompt = f"""You are a freelance delivery auditor. Decide if a milestone was DELIVERED from public evidence.
DELIVERABLE: "{description}"
CRITERIA: "{criteria}"
EVIDENCE (from {evidence_url}):
---
{web_content[:3500]}
---
VERDICT: [DELIVERED or NOT_DELIVERED or INCONCLUSIVE]
CONFIDENCE: [HIGH or MEDIUM or LOW]
REASON: [One sentence with key evidence]"""
        result = gl.eq_principle_prompt_comparative(
            prompt,
            principle="Auditors reading the same criteria and evidence should reach the same verdict.",
        )
        upper = result.upper()
        verdict = "INCONCLUSIVE"
        if "VERDICT: DELIVERED" in upper:
            verdict = "DELIVERED"
        elif "VERDICT: NOT_DELIVERED" in upper:
            verdict = "NOT_DELIVERED"
        conf = "LOW"
        if "CONFIDENCE: HIGH" in upper:
            conf = "HIGH"
        elif "CONFIDENCE: MEDIUM" in upper:
            conf = "MEDIUM"
        reason = ""
        for line in result.splitlines():
            if line.upper().startswith("REASON:"):
                reason = line[7:].strip()
                break
        self.verdicts[milestone_id] = verdict
        self.confidence[milestone_id] = conf
        self.reasons[milestone_id] = reason
        self.finalized[milestone_id] = True
        return f"{verdict} (Confidence: {conf})"

    @gl.public.write
    def submit_and_resolve(self, description: str, evidence_url: str, criteria: str) -> str:
        mid = self.submit_milestone(description, evidence_url, criteria)
        verdict = self.resolve_milestone(mid)
        return f"Milestone #{int(mid)} verdict: {verdict}"

    @gl.public.write
    def challenge(self, milestone_id: u256, new_evidence_url: str) -> str:
        assert milestone_id in self.descriptions, "Milestone does not exist"
        assert self.finalized[milestone_id], "Milestone not resolved yet"
        old_content = gl.get_webpage(self.evidence_urls[milestone_id], mode="text")
        new_content = gl.get_webpage(new_evidence_url, mode="text")
        prompt = f"""Re-audit disputed milestone after new evidence.
DELIVERABLE: "{self.descriptions[milestone_id]}"
CRITERIA: "{self.criteria[milestone_id]}"
ORIGINAL: --- {old_content[:2000]} ---
NEW (from {new_evidence_url}): --- {new_content[:2000]} ---
VERDICT: [DELIVERED or NOT_DELIVERED or INCONCLUSIVE]
CONFIDENCE: [HIGH or MEDIUM or LOW]
REASON: [One sentence]"""
        result = gl.eq_principle_prompt_comparative(
            prompt,
            principle="Auditors with the same evidence should reach the same verdict.",
        )
        upper = result.upper()
        verdict = "INCONCLUSIVE"
        if "VERDICT: DELIVERED" in upper:
            verdict = "DELIVERED"
        elif "VERDICT: NOT_DELIVERED" in upper:
            verdict = "NOT_DELIVERED"
        conf = "LOW"
        if "CONFIDENCE: HIGH" in upper:
            conf = "HIGH"
        elif "CONFIDENCE: MEDIUM" in upper:
            conf = "MEDIUM"
        reason = ""
        for line in result.splitlines():
            if line.upper().startswith("REASON:"):
                reason = line[7:].strip()
                break
        self.verdicts[milestone_id] = verdict
        self.confidence[milestone_id] = conf
        self.reasons[milestone_id] = reason
        self.evidence_urls[milestone_id] = new_evidence_url
        return f"{verdict} (Confidence: {conf})"

