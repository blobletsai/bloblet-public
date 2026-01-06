# Economy Rules: RP, Treasury, and Modes

> **Status:** Player Guide (Canonical)  
> **Last Verified:** 2025-11-20T10:30:29Z (UTC)

<div className="img-container">
  <img src="/img/infographics/economy-rules-rp-treasury-modes.jpeg" alt="Economy Rules Infographic" />
</div>

## 1. Big Picture: RP and the Treasury

Bloblet runs on **Reward Points (RP)** backed by a central **treasury**.

- **RP** is your in-game currency. You earn it from wins and top-ups, and you spend it on Energize, personalization, and world features.
- The **treasury** is the game’s bank. It holds the real tokens (now or in the future) and tracks how much RP belongs to each wallet.
- A simple internal **ledger** records deposits, redeems, and other changes to your RP so we can keep things consistent and auditable.

The goal is a self-sustaining arcade: battles move RP between players, treasury fees and marketplace spend fund the project, and clear guardrails stop anyone from draining the bank overnight.

## 2. Sandbox vs Production

Bloblet supports two high-level economy modes. What you see in the HUD depends on which mode is active for your environment.

### 2.1 Sandbox Mode (Test / Faucet — **Current Live Profile**)

Sandbox is for **testing and early players**. It uses a special **sandbox BPLAY token**:

- Minted by the treasury purely for the game.
- **Not tradable** on external markets.
- Only obtained by:
  - Claiming from the **faucet**.
  - Winning from other players in battles.

The purpose of Sandbox:
- Let you stress-test the loop (Energize, Luck Bucket, battles, redeems) with **no real-money risk**.
- Allow the team to find bugs and security issues before wiring in a real, tradable project token.

**Current Sandbox settings (source: `src/config/economy.ts`, `.env.template`):**
- Faucet: **Enabled**, **1,000 RP** grant, **1 claim** per wallet.
- Holder gate: **300 tokens** (`ECONOMY_SANDBOX_GATE_MIN_TOKENS`).
- Reward top-ups: **25–1,000 RP** per order.
- Pricing:
  - Rename bloblet: **25 RP**.
  - Custom avatar: **150 RP**.
  - Landmark base price: **75 RP**, **+25 RP** per level.
  - Landmark premium: **20%** on prime spots.
- Energize: **5 RP** charge cost per action (`CARE_CHARGE_COST_POINTS`) with a **+1 RP Care Upkeep credit** in ledger-enabled environments (net **4 RP**).

Sandbox prices are deliberately cheap so you can experiment freely.

### 2.2 Production Mode (Main Token, Future)

Production is the **future main token** world.

Once the project token is live and integrated:
- You will acquire the real SPL project token on supported markets.
- You will **send tokens to the treasury** to convert them into RP for gameplay.
- You will be able to **redeem RP back** into the project token from the treasury, within strict guardrails.

Production economics (faucet status, top-up ranges, holder gates, and exact prices) are **still being finalized**. Treat the live HUD as the source of truth; this Bible will be updated once Production values are confirmed.

When the main token launches:
- The **live HUD** and in-game flows are the source of truth for Production prices and limits.
- This chapter will be updated to match those live values, but you should always trust what you see in the app first.

## 3. How RP Flows In and Out

### 3.1 Getting RP

You can gain RP in several ways (depending on mode and your region):
- **PvP wins:** When you win battles, you take a slice of your opponent’s RP.
- **Sandbox faucet:** In Sandbox, you can claim a one-time faucet grant to jump-start your balance.
- **Reward top-ups (Buy Points):** You can top up your RP balance within configured min/max limits.

Over time, the mix of these sources may change, but they all flow through the same treasury ledger.

### 3.2 Spending RP

You spend RP on:
- **Energize:** Pay **5 RP** per Energize (**net 4 RP** when the +1 RP Care Upkeep credit posts) to charge boosters and roll the Luck Bucket.
- **Battles:** Every fight puts some of your RP at stake; you can win or lose meaningful chunks.
- **Personalization:**
  - Rename your bloblet.
  - Unlock or update custom avatars.
  - Buy and rename landmarks in the world.
- **Future features:** Events, special arenas, cosmetic items, and other RP sinks.

All of these RP spends either move RP to another player or into the treasury.

## 4. Treasury Revenue and Self-Sustainability

The treasury earns RP so the project can pay its own way.

Main revenue streams:
- **House cut from battles:** When RP moves from loser to winner, a fixed slice goes to the treasury as a **house cut**.
- **Marketplace spend:** RP spent on renames, avatars, landmarks, and other world features flows into the treasury.
- **Conversion margins (future):** In Production, there may be a small spread between token ⇄ RP conversions, depending on how the pool is managed.

What this revenue is for:
- Infrastructure (servers, storage, monitoring).
- Ongoing development and bug fixes.
- Events, competitions, and community rewards.
- Potential token burns or other mechanisms decided with players.

The core promise: this is not designed as a one-shot “mint and vanish” game. The treasury is meant to keep the arcade alive.

## 5. Redeem Rules and Anti–Bank-Run Guardrails

When redemptions are enabled in your environment, you can convert RP back into the project token by redeeming through the treasury. This is always surrounded by guardrails.

Current default rules:

| Rule | Default | What it means for you |
| :--- | :--- | :--- |
| **Minimum** | **10 RP** | You must redeem at least this much in a single action. Tiny “dust” redeems are blocked. |
| **In-play floor** | **0 RP** | By default, the system does not force you to leave RP behind. Operators can raise this floor so you always leave some RP in the arena. |
| **Cooldown** | **60 minutes** | After a redeem, you must wait before redeeming again. No rapid-fire cash-outs. |
| **Daily cap** | **20% of balance** | In a rolling 24-hour window, you can redeem at most around one-fifth of your RP. |
| **Win lock** | **60 minutes** | RP you just won in battle cannot be redeemed immediately. You must hold it for about an hour first. |

These limits work together to:
- Stop one player (or bot) from yanking all of their RP out at once.
- Give the treasury time to respond to unusual activity.
- Keep gameplay and rewards sustainable for everyone still in the arena.

Your HUD and flows like Redeem or Buy Points surface these rules for your specific environment.

## 6. Future: More On-Chain, More Transparency

Right now, the treasury and reward ledger live primarily in the game backend and connected services. As the project matures, more of this logic is intended to move into:
- Public, auditable contracts that enforce deposit and redeem rules.
- Transparently visible balances and flows for the treasury and reward pools.

The north star is simple: you should not have to “trust the devs” blindly. The rules that govern RP and the treasury should be clear, documented here, and increasingly backed by code you (or others) can inspect.
