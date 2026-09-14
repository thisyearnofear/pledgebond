# GenLayer deploy guide — MilestoneArbiter (Agent Tank, Future of Work)

1. Fund a wallet: https://testnet-faucet.genlayer.foundation/
2. Open https://studio.genlayer.com/contracts, connect wallet.
3. Paste `contracts/milestone_arbiter.py` → Run & Debug.
4. Deploy → copy contract address into `GENLAYER_CONTRACT_ADDRESS`.
5. Seed demo (in Studio console or via `/api/genlayer/submit` + `/resolve`):
   - DELIVERED: description "Ship milestone escrow UI", evidence = merged PR URL, criteria = "PR merged with escrow release path".
   - NOT_DELIVERED: description "Launch mobile app", evidence = repo root URL with no app, criteria = "Published app binary".
6. Record contract address + tx hashes for the Tank submission form.
