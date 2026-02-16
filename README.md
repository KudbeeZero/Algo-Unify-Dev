# GrowPod Empire V1.0

A blockchain-based idle/farming game built on **Algorand TestNet**. Players manage virtual hydroponic grow pods, cultivating plants through a 10-day growth cycle to harvest **$BUD** tokens. Features genetic breeding mechanics, terpene discovery, pest/disease management, and a dual-token economy.

## Tech Stack

- **Smart Contracts**: Algorand TypeScript 1.0 (PuyaTs) - migrated from PyTeal
- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS (dark cyberpunk theme)
- **Wallet**: Pera Wallet Connect (@perawallet/connect)
- **Backend**: Express.js + PostgreSQL (Drizzle ORM)

## Token Economy

### $BUD (Harvest Commodity Token)
- **Total Supply Cap**: 10,000,000,000 (10B) with 6 decimals
- **Minted**: Only on harvest (0.25g base = 250,000,000 units per mature plant)
- **Burns**: Cleanup (500 $BUD), Breeding (1,000 $BUD), Store items, Upgrades

### $TERP (Terpene Rights/Governance Token)
- **Fixed Supply**: 100,000,000 (100M) with 6 decimals
- **Minted**: On rare/unique terpene-minor profiles at harvest (5,000–50,000 reward)
- **Staking**: 40% perpetual royalties on strain seed sales

## Core Gameplay

1. **Mint Pod**: Create soulbound GrowPod NFT (non-transferable until first harvest)
2. **Plant Seed**: Random DNA hash with hidden terpene/minor profile
3. **Water**: 2-hour cooldown, 10 waters = ready to harvest
4. **Harvest**: Mint $BUD based on yield calculation, check for rare $TERP
5. **Cleanup**: Burn 500 $BUD + 1 ALGO to reset pod for next cycle
6. **Breed**: Combine two plants in Combiner Lab (1,000 $BUD) for hybrid seeds

## Deployment Steps

### 1. Prerequisites
```bash
# Install AlgoKit
pip install algokit

# Install Python dependencies
pip install py-algorand-sdk pyteal

# Get TestNet ALGO from faucet
# https://bank.testnet.algorand.network/
```

### 2. Set Environment Variables
```bash
export ALGO_MNEMONIC="your twenty five word mnemonic here"
```

### 3. Compile Smart Contract
```bash
cd contracts
python contract.py
```

This generates:
- `approval.teal` - Main contract logic
- `clear.teal` - Clear state program

### 4. Deploy Contract (AlgoKit)
```bash
# Build the contract
algokit build

# Deploy to TestNet
algokit deploy --network testnet
```

### 5. Bootstrap ASAs ($BUD and $TERP)
```bash
python contracts/bootstrap.py
```

Save the output Asset IDs and update:
- `CONTRACT_CONFIG` in `client/src/hooks/use-algorand.ts`
- Environment variables for scripts

### 6. Set ASA IDs in Contract
```bash
export GROWPOD_APP_ID=<your_app_id>
export BUD_ASSET_ID=<bud_asset_id>
export TERP_ASSET_ID=<terp_asset_id>

python contracts/bootstrap.py  # If APP_ID is set, it will call set_asa_ids
```

### 7. Run Frontend
```bash
npm install
npm run dev
```

---

## CI/CD Pipeline

This project uses GitHub Actions for continuous integration and deployment. The pipeline ensures code quality and automates TestNet deployments.

### Pipeline Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Feature    │     │   Pull      │     │   Merge     │
│  Branch     │────▶│   Request   │────▶│   to Main   │
│  (dev)      │     │  (review)   │     │  (deploy)   │
└─────────────┘     └─────────────┘     └─────────────┘
                       │                    │
                       ▼                    ▼
                ┌─────────────┐     ┌─────────────┐
                │    CI       │     │     CD      │
                │  (build,    │     │  (deploy    │
                │   test,     │     │  testnet)   │
                │   lint)     │     │             │
                └─────────────┘     └─────────────┘
```

### CI Workflow (`.github/workflows/ci.yml`)

Triggers on: **push to main** and **pull requests to main**

**Jobs:**
1. **Build Smart Contract** - Compiles TypeScript contract using Puya compiler
2. **Run Unit Tests** - Executes tests against AlgoKit LocalNet
3. **Lint & Type Check** - Ensures code quality and type safety
4. **TEAL Security Audit** - Analyzes compiled TEAL for security issues

### CD Workflow (`.github/workflows/deploy-testnet.yml`)

Triggers on: **successful merge to main** or **tag push** (`v*`)

**Jobs:**
1. **Deploy to Algorand TestNet** - Builds and deploys contract
2. **Verify Deployment** - Confirms contract is live on TestNet

### Local Development Scripts

| Script | Description |
|--------|-------------|
| `npm run contracts:build` | Compile smart contract |
| `npm run contracts:test` | Run unit tests against LocalNet |
| `npm run contracts:lint` | Run ESLint |
| `npm run contracts:lint:fix` | Auto-fix lint issues |
| `npm run contracts:format` | Format code with Prettier |
| `npm run contracts:check-types` | TypeScript type checking |
| `npm run contracts:audit-teal` | Run TEAL security audit |
| `npm run contracts:localnet:start` | Start AlgoKit LocalNet |
| `npm run contracts:localnet:stop` | Stop AlgoKit LocalNet |
| `npm run contracts:deploy:testnet` | Deploy to TestNet |
| `npm run contracts:deploy:mainnet` | Deploy to MainNet |

### Setting Up GitHub Secrets

For the CI/CD pipeline to work, configure these secrets in your GitHub repository:

1. Navigate to **Settings → Secrets and variables → Actions**
2. Add the following secrets:

| Secret | Description | Required |
|--------|-------------|----------|
| `DEPLOYER_MNEMONIC` | 25-word wallet mnemonic for deployment | ✅ |
| `DISPENSER_MNEMONIC` | Dispenser wallet for funding | ✅ |
| `ALGORAND_INDEXER_TOKEN` | Indexer API token (MainNet only) | Optional |
| `ALGORAND_ARCHIVE_NODE_TOKEN` | Archive node token (MainNet only) | Optional |

### Setting Up Branch Protection

See [`.github/BRANCH_PROTECTION.md`](.github/BRANCH_PROTECTION.md) for detailed instructions.

Basic requirements:
- Require pull request reviews before merging
- Require CI to pass before merging
- Prevent direct pushes to main

### Triggering Deployments

**Automatic Deployment (on merge):**
- Merge a PR to `main` after CI passes
- CD workflow automatically deploys to TestNet

**Manual Deployment:**
- Go to **Actions → CD - Deploy to TestNet**
- Click **Run workflow**
- Use the redeploy option to update without new App ID

**Version Tag Deployment:**
- Create a version tag: `git tag v1.0.0 && git push --tags`
- This triggers deployment and creates a GitHub release

### TestNet Deployed Contract

| Asset | ID |
|-------|-----|
| GrowPod App ID | 755243944 |
| BUD Token | 755243947 |
| TERP Token | 755243948 |
| SLOT Token | 755243949 |
| Contract Address | CWGAVWZRVKKFHRYZHEPQPELVJMFNW2QMIWNEB2H3ZXCKOXRIPKWCW2IBRI |
| Admin Wallet | HW6U3RKLOYEW2X2L4DERSJHBPG6G6UTKDWBSS2MKPZJOSAWKLP72NTIMNQ |

---

## Contract Scripts

| Script | Description |
|--------|-------------|
| `contracts/contract.py` | Main smart contract (PyTeal) |
| `contracts/bootstrap.py` | Create $BUD and $TERP ASAs |
| `contracts/mint.py` | Mint soulbound GrowPod NFT |
| `contracts/water.py` | Water plant (24h cooldown) |
| `contracts/harvest.py` | Harvest + check $TERP reward |
| `contracts/clean.py` | Cleanup pod (burn 500 $BUD + 1 ALGO) |
| `contracts/breed.py` | Breed plants (burn 1,000 $BUD) |

## Frontend Pages

- **Dashboard**: Pod status, balances, quick actions
- **Seed Vault**: View stored mystery/hybrid seeds
- **Combiner Lab**: Breed two plants for hybrid seeds
- **Supply Store**: Buy nutrients/controls with $BUD
- **Cure Vault**: Cure $BUD for bonus yields

## Environment Variables

```bash
# Required for deployment
ALGO_MNEMONIC=<25-word-mnemonic>

# Set after deployment
GROWPOD_APP_ID=<contract_app_id>
GROWPOD_APP_ADDRESS=<contract_address>
BUD_ASSET_ID=<bud_asa_id>
TERP_ASSET_ID=<terp_asa_id>

# Database
DATABASE_URL=<postgresql_connection_string>
```

## TestNet Fast Mode

For faster testing on TestNet, enable **Fast Mode** in the Dashboard to reduce cooldowns:

| Cooldown | MainNet (Default) | TestNet Fast Mode |
|----------|-------------------|-------------------|
| Water    | 24 hours (86400s) | 2 hours (7200s)   |

### How to Enable
1. Go to the **Dashboard**
2. Find the **Quick Stats** card
3. Check the **Fast Mode (TestNet)** checkbox
4. Water cooldowns will now use 2-hour intervals

### Technical Details
- The smart contract accepts an optional `cooldown_seconds` argument (args[1]) for the water methods
- When Fast Mode is enabled, the frontend passes `7200` seconds to the contract
- When disabled (default), it uses `86400` seconds (24 hours)
- This only affects the water action; nutrients still use 6h cooldown
- **Security**: The contract enforces a minimum cooldown of 2 hours (7200s) on-chain to prevent abuse

## Security Features

- **Configurable Water Cooldown**: 24h default, 2h for TestNet fast mode, enforced on-chain
- **Atomic Burns**: $BUD burns grouped with actions (cleanup, breed)
- **Soulbound NFTs**: Clawback mechanism prevents transfers
- **DNA Uniqueness**: Cryptographic hashing for plant genetics
- **Inner Transactions**: $BUD/$TERP minting via contract

## Network

- **Chain ID**: 416002 (Algorand TestNet)
- **Algod API**: https://testnet-api.algonode.cloud
- **Explorer**: https://testnet.algoexplorer.io

## License

MIT
