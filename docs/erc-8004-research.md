# ERC-8004 (Trustless Agents) Research — Synthesis Hackathon

**Researched**: 2026-03-18
**Status**: ERC-8004 is DRAFT, but contracts are live on mainnet + testnets

---

## 1. Contract Addresses

### Base Mainnet (Chain ID: 8453)
| Contract | Address |
|---|---|
| **Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| **Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |
| **Validation Registry** | TBD (not yet deployed on Base — only Identity + Reputation confirmed) |

### Ethereum Mainnet (Chain ID: 1)
| Contract | Address |
|---|---|
| **Identity Registry** | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| **Reputation Registry** | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

### Ethereum Sepolia Testnet (Chain ID: 11155111)
| Contract | Address |
|---|---|
| **Identity Registry** | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| **Reputation Registry** | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

### Base Sepolia Testnet (Chain ID: 84532)
| Contract | Address |
|---|---|
| **Identity Registry** | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |
| **Reputation Registry** | `0x8004B663056A597Dffe9eCcC1965A193B7388713` |

> Same vanity addresses deployed across all chains using CREATE2.
> Mainnet addresses start `0x8004A169...` / `0x8004BAa1...`
> Testnet addresses start `0x8004A818...` / `0x8004B663...`

---

## 2. Agent Identifier Format

```
agentRegistry = eip155:{chainId}:{identityRegistryAddress}
```

Examples:
- Base Mainnet: `eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Ethereum Mainnet: `eip155:1:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- Base Sepolia: `eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e`

---

## 3. Identity Registry — Function Signatures

### Registration (3 overloads)
```solidity
function register() external returns (uint256 agentId)

function register(string agentURI) external returns (uint256 agentId)

function register(
    string agentURI,
    MetadataEntry[] calldata metadata
) external returns (uint256 agentId)

struct MetadataEntry {
    string metadataKey;
    bytes metadataValue;
}
```

### Agent URI & Metadata
```solidity
function setAgentURI(uint256 agentId, string calldata newURI) external
function getMetadata(uint256 agentId, string memory metadataKey) external view returns (bytes memory)
function setMetadata(uint256 agentId, string memory metadataKey, bytes memory metadataValue) external
```

### Agent Wallet (EIP-712 signature required)
```solidity
function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata signature) external
function getAgentWallet(uint256 agentId) external view returns (address)
function unsetAgentWallet(uint256 agentId) external
```

### Standard ERC-721
```solidity
function ownerOf(uint256 tokenId) external view returns (address)
function tokenURI(uint256 tokenId) external view returns (string memory)
function balanceOf(address owner) external view returns (uint256)
function approve(address to, uint256 tokenId) external
function transferFrom(address from, address to, uint256 tokenId) external
function safeTransferFrom(address from, address to, uint256 tokenId) external
function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external
function setApprovalForAll(address operator, bool approved) external
function isApprovedForAll(address owner, address operator) external view returns (bool)
function getApproved(uint256 tokenId) external view returns (address)
```

### Events
```solidity
event Registered(uint256 indexed agentId, string agentURI, address indexed owner)
event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)
event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)
```

---

## 4. Reputation Registry — Function Signatures

### Submit Feedback
```solidity
function giveFeedback(
    uint256 agentId,
    int128 value,          // signed fixed-point score
    uint8 valueDecimals,   // 0-18
    string calldata tag1,  // optional category
    string calldata tag2,  // optional subcategory
    string calldata endpoint,     // optional, emitted in event only
    string calldata feedbackURI,  // optional, emitted in event only
    bytes32 feedbackHash          // optional, emitted in event only
) external
```

### Manage Feedback
```solidity
function revokeFeedback(uint256 agentId, uint64 feedbackIndex) external

function appendResponse(
    uint256 agentId,
    address clientAddress,
    uint64 feedbackIndex,
    string calldata responseURI,
    bytes32 responseHash
) external
```

### Read Feedback
```solidity
function getSummary(
    uint256 agentId,
    address[] calldata clientAddresses,  // REQUIRED, non-empty (Sybil defense)
    string tag1,
    string tag2
) external view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)

function readFeedback(
    uint256 agentId,
    address clientAddress,
    uint64 feedbackIndex
) external view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)

function readAllFeedback(
    uint256 agentId,
    address[] calldata clientAddresses,
    string tag1,
    string tag2,
    bool includeRevoked
) external view returns (
    address[] memory clients,
    uint64[] memory feedbackIndexes,
    int128[] memory values,
    uint8[] memory valueDecimals,
    string[] memory tag1s,
    string[] memory tag2s,
    bool[] memory revokedStatuses
)

function getClients(uint256 agentId) external view returns (address[] memory)
function getLastIndex(uint256 agentId, address clientAddress) external view returns (uint64)
function getResponseCount(uint256 agentId, address clientAddress, uint64 feedbackIndex, address[] responders) external view returns (uint64 count)
function getIdentityRegistry() external view returns (address identityRegistry)
```

### Events
```solidity
event NewFeedback(
    uint256 indexed agentId,
    address indexed clientAddress,
    uint64 feedbackIndex,
    int128 value,
    uint8 valueDecimals,
    string indexed indexedTag1,
    string tag1, string tag2,
    string endpoint, string feedbackURI, bytes32 feedbackHash
)
event FeedbackRevoked(uint256 indexed agentId, address indexed clientAddress, uint64 indexed feedbackIndex)
event ResponseAppended(uint256 indexed agentId, address indexed clientAddress, uint64 feedbackIndex, address indexed responder, string responseURI, bytes32 responseHash)
```

### Key Constraint
> The feedback submitter MUST NOT be the agent owner or an approved operator for agentId.

---

## 5. Validation Registry — Function Signatures

### Request & Respond
```solidity
function validationRequest(
    address validatorAddress,
    uint256 agentId,
    string requestURI,
    bytes32 requestHash
) external  // MUST be called by owner/operator of agentId

function validationResponse(
    bytes32 requestHash,
    uint8 response,        // 0-100 (0=failed, 100=passed)
    string responseURI,
    bytes32 responseHash,
    string tag             // e.g. "soft finality", "hard finality"
) external  // MUST be called by the original validatorAddress
```

### Read Validation
```solidity
function getValidationStatus(bytes32 requestHash) external view returns (
    address validatorAddress, uint256 agentId, uint8 response,
    bytes32 responseHash, string tag, uint256 lastUpdate
)

function getSummary(
    uint256 agentId,
    address[] calldata validatorAddresses,
    string tag
) external view returns (uint64 count, uint8 avgResponse)

function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory requestHashes)
function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory requestHashes)
function getIdentityRegistry() external view returns (address)
```

### Events
```solidity
event ValidationRequest(address indexed validatorAddress, uint256 indexed agentId, string requestURI, bytes32 indexed requestHash)
event ValidationResponse(address indexed validatorAddress, uint256 indexed agentId, bytes32 indexed requestHash, uint8 response, string responseURI, bytes32 responseHash, string tag)
```

---

## 6. Agent Registration File Schema (JSON hosted at agentURI)

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "string",
  "description": "string",
  "image": "string",
  "services": [
    {
      "name": "string",
      "endpoint": "string",
      "version": "string",
      "skills": ["string"],
      "domains": ["string"]
    }
  ],
  "x402Support": true,
  "active": true,
  "registrations": [
    {
      "agentId": 1,
      "agentRegistry": "eip155:8453:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432"
    }
  ],
  "supportedTrust": ["reputation", "validation"]
}
```

---

## 7. Uniswap V3 on Sepolia Testnet

| Contract | Sepolia Address |
|---|---|
| **UniswapV3Factory** | `0x0227628f3F023bb0B980b67D528571c95c6DaC1c` |
| **SwapRouter02** | `0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E` |
| **QuoterV2** | `0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3` |
| **UniversalRouter** | `0x3A9D48AB9751398BbFa63ad67599Bb04e4BdF98b` |

> Note: The original `SwapRouter` (V3-only) is NOT deployed on Sepolia. Use `SwapRouter02` instead.

---

## 8. USDC on Sepolia Testnet

| Detail | Value |
|---|---|
| **Contract Address** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| **Faucet URL** | https://faucet.circle.com/ |
| **Faucet Limit** | 20 USDC per address, per chain, every 2 hours |
| **Decimals** | 6 |

> Alternative address seen in some sources: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` — verify on Sepolia Etherscan before use. Circle's faucet is the authoritative source.

---

## 9. WETH on Sepolia Testnet

| Detail | Value |
|---|---|
| **Contract Address** | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |
| **Etherscan** | https://sepolia.etherscan.io/token/0x7b79995e5f793a07bc00c21412e50ecae098e7f9 |

> Alternative WETH seen on Uniswap pools: `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` — this is the Uniswap-preferred WETH on Sepolia.

---

## 10. SDKs and Libraries

### JavaScript/TypeScript
```bash
npm install erc-8004-js
```

Usage:
```typescript
import { createClient } from 'erc-8004-js';

// Register agent
const { agentId, txHash } = await client.identity.registerWithURI(
  'https://example.com/agent.json'
);

// Give feedback
await client.reputation.giveFeedback({
  agentId,
  score: 95,
  tag1: 'excellent-service',
  tag2: 'fast-response',
  feedbackUri: 'ipfs://QmFeedbackData',
});

// Get summary
const summary = await client.reputation.getSummary(agentId);
```

### Python
```bash
pip install chaoschain-sdk
```

### Other SDKs
- Go SDK: https://github.com/prxs-ai/praxis-go-sdk
- Python SDK: https://github.com/prxs-ai/praxis-py-sdk
- JS SDK: https://github.com/tetratorus/erc-8004-js

---

## 11. GitHub Resources

| Resource | URL |
|---|---|
| **Official Contracts** | https://github.com/erc-8004/erc-8004-contracts |
| **Awesome ERC-8004** | https://github.com/sudeepb02/awesome-erc8004 |
| **Vistara Example** | https://github.com/vistara-apps/erc-8004-example |
| **TEE Agent (Phala)** | https://github.com/Phala-Network/erc-8004-tee-agent |
| **Cairo (Starknet)** | https://github.com/Akashneelesh/erc8004-cairo |
| **AgentStore** | https://github.com/techgangboss/agentstore |
| **ERC-8004 Org** | https://github.com/erc-8004 |
| **Spec Discussion** | https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098 |

---

## 12. Hackathon Context

### Synthesis / Trustless Agents Hackathon
- Virtual hackathon focused on ERC-8004 + AI x ETH
- Supported by Ethereum Foundation dAI team
- Agents register on Base for discovery and trust

### AI Trading Agents Hackathon (lablab.ai)
- March 30 - April 12, 2026
- Build autonomous trading/risk/yield agents with ERC-8004
- Solo or team participation

### Key Protocol Requirements
1. **EIP-155**: Chain-aware transactions
2. **EIP-712**: Typed structured data signing (for agent wallet verification)
3. **EIP-721**: NFT standard (each agent = one NFT)
4. **ERC-1271**: Smart contract signature verification

---

## 13. Architecture Notes

- **Singleton per chain**: One registry set per chain, all agents on that chain share it
- **Cross-chain identity**: An agent registered on chain A can operate on chain B; multi-chain registration optional
- **Upgradeable contracts**: UUPS proxy pattern (all three registries)
- **No Validation Registry deployments confirmed yet** for Base or testnets — Identity + Reputation are live
- **agentWallet** is auto-cleared on NFT transfer (security measure)
- **Sybil defense**: `getSummary()` requires explicit `clientAddresses[]` filter — no global aggregation
