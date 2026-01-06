# Gameplay Rules

> **Status:** Canonical Reference
> **Source of Truth:** `src/server/gameplay/battle/engine.ts`
> **Last Verified:** 2025-11-19

<div className="img-container">
  <img src="/img/infographics/gameplay-rules-battle-mechanics.jpeg" alt="Battle Mechanics Infographic" />
</div>

## 1. Game Assets

The Bloblet universe revolves around three core assets that determine your survival and success:

### 1.1. Reward Points (RP)
The lifeblood of the ecosystem.
*   **Usage:** Required to perform **Energize** actions (mint items) and to pay the **Entry Fee** (Stake) for battles.
*   **Source:** Won from other players in PvP or claimed from the daily faucet.
*   **Risk:** If you hold RP, you are challengeable. There is no safe harbor for hoarders.

### 1.2. Boosters (Offense)
Temporary power-ups that increase your **Weapon Power (OP)**.
*   **Activation:** Gained automatically when you **Energize**.
*   **Duration:** Lasts for 15 minutes.
*   **Effect:** Directly adds levels to your Attack Roll. A Level 3 Booster gives a massive advantage.

### 1.3. Shields (Defense)
Defensive gear that mitigates damage and protects your RP.
*   **Defense Power (DP):** Adds to your Defense Roll.
*   **Durability:** Can be stolen by attackers if you lose a battle.
*   **Necessity:** fighting without a shield is a death sentence.

## 2. Core Philosophy: No Freebies

Bloblet gameplay is built on a strict "No Freebies" policy:
*   **Loot Generation:** Items are ONLY minted via **Energize** (Care) actions.
*   **Zero-Sum Battles:** PvP battles never mint new items. They only transfer Reward Points (RP) and steal existing gear.
*   **Survival:** There are no "safe zones" or DP gates. If you hold RP, you are challengeable.

## 3. Battle Engine

The battle resolution logic is pure and deterministic, handled by `BattleEngine.resolve()`.

### 2.1. Stats & Rolls
Each participant (Attacker and Defender) has a **Base Stat**:
*   **Attacker Base:** Weapon OP + Booster Level
*   **Defender Base:** Shield DP + Booster Level

A **Roll** is calculated as:
```typescript
Roll = Round(Base * LuckMultiplier)
```
*   **Luck Variance:** ±20% (Config: `PVP_LUCK_VARIANCE` = 0.2)
*   **Luck Multiplier:** Random value between `0.8` and `1.2`.

### 2.2. Winning Condition
*   **Winner:** The side with the higher Roll.
*   **Tie Band:** If the difference between rolls is within `0.2` (Config: `PVP_TIE_BAND`), the winner is a 50/50 coin flip.

### 2.3. Transfers (The Stakes)
The loser pays a portion of their Reward Points to the winner.
*   **Transfer Rate:** 10% of loser's balance (Config: `TRANSFER_BPS` = 1000).
*   **Minimum Transfer:** 5 RP (Config: `MIN_TRANSFER`).
*   **House Cut:** 10% of the *transfer amount* is burned/treasured (Config: `HOUSE_CUT_BPS` = 1000).

### 2.4. Loot Logic (Theft)
Winners can steal items from the loser.
*   **Standard Win:**
    *   Attacker wins -> Steals **Shield**.
    *   Defender wins -> Steals **Weapon**.
*   **Critical Win:**
    *   Chance: 5% (Config: `PVP_CRITICAL_CHANCE` = 0.05).
    *   Effect: Steals **BOTH** Weapon and Shield.
*   **Mechanic:** If the winner's slot is empty or has a lower stat than the stolen item, the stolen item is auto-equipped. Otherwise, it goes to inventory (or is burned if inventory logic dictates, but engine returns it as loot).

## 4. Care & Energize

Energize is the primary faucet for items and the mechanism to activate Boosters.

### 3.1. Costs & Limits
*   **Cost:** 5 RP per action (Config: `CARE_CHARGE_COST_POINTS`).
*   **Cooldown:** 15 minutes (Config: `CARE_COOLDOWN_MIN`).
*   **Booster Window:** 15 minutes of active coverage.
*   **Booster Cap:** Max 3 levels.

### 3.2. Drop Law (The Luck Bucket)
We use a **Deterministic Accumulator** (Bad-Luck Protection) to ensure fair distribution.
*   **Base Chance:** 20% per Energize.
*   **Accumulator:** Each miss increases your chance for the next roll.
*   **Guarantee:** You are mathematically guaranteed a drop within a fixed number of attempts (approx 5).
*   **Bias:** If you have no shield, the first drop will prioritize a Shield.

## 5. Battle Eligibility

To attack or be attacked, specific conditions must be met:

| Condition | Value | Notes |
| :--- | :--- | :--- |
| **Minimum Stake** | 5 RP | `CHALLENGEABLE_MIN_POINTS`. You cannot fight with empty pockets. |
| **Alive Status** | True | Dead/inactive wallets are excluded. |
| **Pair Cooldown** | 60 min | You cannot farm the same opponent repeatedly (`PVP_PAIR_COOLDOWN_MIN`). |
| **Overdue Guard** | Active | Attackers cannot launch battles if their own Care is overdue. |

## 6. Anti-Farm Mechanics

*   **Pair Frequency Limit:** If an attacker targets the same defender too frequently within an hour, a **Surcharge** is applied to the House Cut (up to 100%).
*   **Dead Wallet Pruning:** Wallets inactive for >60 minutes are removed from the pool, and their RP may be confiscated to the Treasury.
