# Treasury, Safety, and Player Trust

> **Status:** Player Guide (Summary)  
> **Last Verified:** 2025-11-20T05:48:34Z (UTC)

## 1. What the Treasury Is

The **treasury** is the game’s bank.

- It holds the tokens (now or in the future) that back in-game **Reward Points (RP)**.
- It receives RP from **house cuts**, marketplace spend, and other fees.
- It pays out RP and tokens when players redeem or win events.

You can think of it as the shared pool that keeps the arcade running.

## 2. Core Principles

The treasury is run with a few simple rules in mind:
- **Sustainability:** The game should be able to fund its own servers, development, and events from treasury revenue instead of relying on endless outside funding.
- **Fairness:** No hidden drains or surprise rules. The ways RP moves into and out of the treasury are documented in the Economy and Gameplay chapters.
- **Safety:** We avoid designs that could blow up the treasury overnight, such as unchecked auto-mint/auto-burn loops.

## 3. How the Treasury Earns

The treasury earns over time through:
- **House cut on battles:** When RP moves from loser to winner, a small slice goes to the treasury.
- **Marketplace spend:** RP spent on renames, avatars, landmarks, and other features flows into the treasury instead of vanishing.
- **Future mechanisms:** In Production, there may be small spreads or fees on token ⇄ RP conversions.

These flows are what keep Bloblet’s economy alive long term.

## 4. How the Treasury Protects the Game

To protect players and the shared pool:
- **Redeem guardrails** (minimums, cooldowns, daily caps, and win-locks) slow down withdrawals so one bad actor cannot instantly drain the bank.
- **Dead-wallet rules** allow long-abandoned balances to be swept back into the treasury so they do not sit idle forever.
- We can temporarily tighten or pause certain flows if something looks unsafe, then loosen them again once the issue is understood.

Many of these rules are visible directly in the HUD (for example, redeem limits), and all of them are summarized in this Bible.

## 5. Transparency and Roadmap

Today, treasury logic is mostly enforced by the game backend and connected services. Over time, our goals are:
- Make more treasury flows visible to players through in-game history and dashboards.
- Move more of the core deposit / redeem rules into public, auditable contracts.

The long-term direction is clear: fewer opaque switches, more rules you can see and reason about, backed by code instead of trust alone.
