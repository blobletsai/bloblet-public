# RNG Fairness

> **Status:** Player Guide (Summary)  
> **Last Verified:** 2025-11-20T05:48:34Z (UTC)

<div className="img-container">
  <img src="/img/infographics/rng-fairness.jpeg" alt="RNG Fairness Infographic" />
</div>

## 1. What Randomness Controls

Randomness in Bloblet affects two main places:
- **Battles:** Luck nudges your attack and defense rolls up or down within a small band.
- **Energize drops:** The Luck Bucket decides when you hit or miss on loot.

In both cases, the rules are the same for everyone. There are no secret “rigged” paths or VIP shortcuts.

## 2. Battle Luck: Controlled Variance

Every battle roll has two parts:
- Your **Base power** (gear + boosters).
- A **luck multiplier** that can move the outcome up or down by a limited amount.

That multiplier:
- Lives inside a fixed band (about plus or minus 20%).
- Is applied to both players using the same formula.
- Is driven by a secure random source, not a predictable “fake” random.

Result: strong gear and good prep matter a lot, but there is always a real chance for close upsets.

## 3. The Tie Band: Fair Coin Flips

When two rolls end up extremely close together:
- The battle is treated as a **Clash** inside a narrow **tie band**.
- Inside this band, the winner is chosen by a clean **50/50 coin flip**.

This prevents slightly stronger builds from becoming literally unkillable. If you bring a competitive loadout and catch someone in the tie band, you have a real shot at winning.

## 4. Luck Bucket: Protection Against Bad Streaks

The Luck Bucket under Energize protects you from endless cold streaks:
- Each miss fills your personal bucket.
- Each hit empties it and gives you loot.
- Over time, your effective odds stay close to the advertised rate.

Short hot or cold streaks are expected—just like in any game—but the bucket keeps the long-term behavior fair.

## 5. Transparency

The high-level rules in this Bible match the logic used by the game:
- You can see the effects of luck in your own battle history and Energize stats.
- As tooling improves, we plan to surface more views of your personal odds, streaks, and outcomes so you can sanity-check how the system treats you over time.

If live behavior ever appears to disagree with these rules, we treat that as a bug, not as “working as intended.”
