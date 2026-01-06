# Player-Facing Configuration

> **Status:** Player Guide (Summary)  
> **Last Verified:** 2025-11-20T05:48:34Z (UTC)

This page is intentionally light on technical detail. It explains how configuration affects **you** as a player, not how the stack is wired.

## 1. Where the Rules Live

For day-to-day play, you can treat these as your sources of truth:
- **Gameplay:** See [Gameplay Rules & How to Play](../01-gameplay/rules.md) for Energize, Luck Bucket, boosters, and battles.
- **Economy:** See [Economy Rules](../02-economy/rules.md) for RP, treasury behavior, Sandbox vs Production, and redeem guardrails.
- **Fairness & Safety:** See the Security docs for treasury, RNG, and wallet-safety promises.

The game client reads its configuration from a central config layer. When we adjust numbers (like cooldowns or prices), we update that layer first, then refresh these docs so they match what you see in the HUD.

## 2. Modes and Environments

Bloblet runs in different environments (for example, Sandbox vs Production), but you never need to touch configuration files or environment variables yourself.

As a player, you mainly experience this as:
- **Sandbox:** Lower stakes, faucet enabled, cheaper prices, faster iteration while we hunt bugs and tune balance.
- **Production:** Real token stakes, stricter redeem rules, and more conservative pricing.

Your current mode is always reflected in:
- The HUD (for example, whether faucet is available).
- The Economy and Gameplay rules in this Bible.

## 3. How Changes Are Rolled Out

When we change configuration that affects players:
- We update the central config layer.
- We run tests and smoke-checks in Sandbox.
- We update these docs with the new defaults and a fresh “Last Verified” date.

If a change is significant (for example, major balance or price shifts), we will also call it out in patch notes and community channels.

## 4. Getting Help

If something you see on-screen seems to disagree with this Bible:
- Trust the **live HUD** first for exact cooldowns, caps, and prices.
- Use the in-game help widget or FAQ to double-check how a rule is supposed to work.
- If it still feels off, report it through the official channels so we can investigate and correct either the config or the docs.
