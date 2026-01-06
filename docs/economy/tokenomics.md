# Economy Rules

> **Status:** Canonical Reference  
> **Source of Truth:** `src/config/economy.ts`  
> **Last Verified:** 2025-11-20T10:30:29Z (UTC)  
> **PHASE:** Mainnet Sandbox (current live profile)

<div className="img-container">
  <img src="/img/infographics/economy-rules.jpeg" alt="Economy Rules Infographic" />
</div>

## 1. Mainnet Sandbox Economy

The Bloblet economy runs in a **Mainnet Sandbox**.

<div className="img-container">
  <img src="/img/diagrams/economy-flow.svg" alt="Economy Flow Diagram: Player, Bank, Treasury" />
</div>

The BPLAY token is a live Mainnet SPL Token used for testing within our closed sandbox economy. It currently has **no market value** and is **not tradable on external exchanges**.

The two main engines of this sandbox are:

### 1.1. Treasury (Simulated Revenue)
*   **Purpose:** Simulates protocol revenue capture from house cuts and fees.
*   **Policy:** In the sandbox, these funds are simply removed from circulation to control inflation.

### 1.2. Bank (Reward Points)
*   **Purpose:** Manages the ledger of Reward Points (RP) for gameplay.
*   **Guardrails:** Strict limits (minimums, cooldowns, caps) prevent abuse and ensure economic stability.
*   **Future:** Will migrate to an on-chain contract for full auditability once stable.

## 2. Reward Points (RP)

RP is the primary in-game currency.

### 2.1 Acquisition (Getting RP)
*   **Sandbox:** 
    *   **Faucet:** One-time grant of **1,000 RP**.
    *   **Top-Up:** Purchase RP packs (**25–1,000 RP**).
*   **Production:** Players will convert project tokens to RP via the Treasury (rates TBD).
*   **Gameplay:** Win battles to steal RP from opponents.

### 2.2 Utility
*   **Spend:** Energize (Care), Personalization, Landmarks.
*   **Display:** Balances are off-chain and visible in the HUD.

## 3. Pricing & Costs

All costs are configured in `src/config/economy.ts`. Values below reflect the **Sandbox profile** (current live).

### 3.1. Core Actions
| Action | Cost | Config Key |
| :--- | :--- | :--- |
| **Energize (Care)** | 5 RP (net 4 RP after +1 RP Care Upkeep credit) | `CARE_CHARGE_COST_POINTS` |

### 3.2. Personalization
| Feature | Cost | Config Key |
| :--- | :--- | :--- |
| **Rename Bloblet** | 25 RP | `RENAME_RP` |
| **Custom Avatar** | 150 RP | `CUSTOM_AVATAR_RP` |

### 3.3. Landmarks (World)
| Feature | Cost | Config Key |
| :--- | :--- | :--- |
| **Landmark Base** | 75 RP | `LANDMARK_BASE_RP` |
| **Landmark Step** | 25 RP | `LANDMARK_STEP_RP` (Cost increase per level) |
| **Premium** | 20% | `LANDMARK_PREMIUM_PCT` |

### 3.4. Production Values
Production tokenomics are **not finalized**. The live HUD and flows will be the source of truth when Production launches; this file will be updated once numbers are confirmed.

## 4. Rewards & Faucets

### 4.1. Faucet
*   **Grant:** **1,000 RP** (`FAUCET_RP`).
*   **Gas:** **0** (no extra gas stipend in Sandbox).
*   **Limit:** **1 claim** per wallet (`FAUCET_MAX_CLAIMS`).

### 4.2. Top-Up
*   **Min:** **25 RP** (`REWARD_TOPUP_MIN_RP`)
*   **Max:** **1,000 RP** (`REWARD_TOPUP_MAX_RP`)

### 4.3. Holder Gate
*   **Sandbox Gate:** **300 tokens** required to count as a holder (`GATE_MIN_TOKENS` / `ECONOMY_SANDBOX_GATE_MIN_TOKENS`).

## 5. Redemption Guardrails

<div className="img-container">
  <img src="/img/diagrams/fairness-tiles.svg" alt="Guardrails and Safety" />
</div>

To withdraw RP (Redeem), players must meet strict criteria:

| Rule | Value | Description |
| :--- | :--- | :--- |
| **Minimum** | 10 RP | `REDEEM_MIN_POINTS`. Minimum withdrawal size. |
| **Floor** | 0 RP | `INPLAY_FLOOR_POINTS`. Must leave this much behind. |
| **Cooldown** | 60 min | `REDEEM_COOLDOWN_MIN`. Time between redeems. |
| **Daily Cap** | 20% | `REDEEM_DAILY_CAP_BPS`. Max % of balance redeemable per 24h. |
| **Win Lock** | 60 min | `REDEEM_WIN_LOCK_MIN`. Delay before newly won points can be withdrawn. |
