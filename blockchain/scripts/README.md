# PledgeBond Scripts

Utility scripts for the PledgeBond platform.

## Contract deployment

- **deployTestnet.js** — deploys `HackathonRegistry` + `LiquidityRail` (impl + ERC1967 proxy), seeds hackathon #1, writes `./deployments/<network>_deployment.json`
- **smoke.js** — read-only post-deploy checks; exits non-zero on failure so it can gate a cutover
- **deploy-contracts.js**, **deployAll.js**, **deployProduction.js**, **deploy-production.sh** — legacy/one-off deployment helpers

### Deploying

```bash
ADMIN_ADDRESS=<multisig> FEE_RECIPIENT_ADDRESS=<treasury> \
  npx hardhat run scripts/deployTestnet.js --network arcTestnet

npx hardhat run scripts/smoke.js --network arcTestnet
```

| Env var | Purpose |
|---|---|
| `ADMIN_ADDRESS` | Receives `DEFAULT_ADMIN_ROLE`. **Use a multisig.** On a UUPS proxy this role can upgrade the contract to arbitrary code. The script warns if it's unset on mainnet. |
| `FEE_RECIPIENT_ADDRESS` | Receives `FEE_ROLE` and withdraws origination fees. Defaults to `ADMIN_ADDRESS`. |

## Data management

- **list-projects.js**, **list-users.js** — inspect current data
- **import-projects.js**, **migrate-to-firebase.js**, **migrate-celo-projects.js** — imports and migrations
- **delete-dummy-projects.js**, **cleanup.js** — removals
- **sync-github.js** — GitHub sync

## Permissions

- **auto-grant-permissions.js**, **grant-project-ownership.js**, **grant-project-ownership-by-github.js**, **grant-project-permissions.js**, **verify-repo-ownership.js**

## Other

- **create-project.js**, **setup-env.js**
- **deploy-firestore-rules.js**, **deploy-storage-cors.js**

## Usage

Most scripts run directly with Node:

```bash
node scripts/script-name.js
```

Hardhat scripts need a network:

```bash
npx hardhat run scripts/deployTestnet.js --network arcTestnet
```

## Notes

- Some scripts require environment variables to be set
- Check each script for its specific requirements
- **Review any deployment script before running it against a live network**