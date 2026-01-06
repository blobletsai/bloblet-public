# Gameplay Rules & How to Play

> **Status:** Player Guide (Canonical)  
> **Last Verified:** 2025-11-28T14:28:01Z (UTC)

<div className="img-container">
  <img src="/img/infographics/gameplay-rules-how-to-play.jpeg" alt="Gameplay Rules Infographic" />
</div>

## 1. How to Play (Quick Loop)

Bloblet is a survival arena. You wake up your bloblet, charge it, and risk your Reward Points (RP) in battles against other players.

**Your loop looks like this:**
- Connect your wallet and become a holder with RP.
- **Get RP** to start: use the **Faucet** (1,000 RP), **Top-Up** (25–1,000 RP), or win **Battles**.
- Visit the **Life Hub** and **Energize** to wake your bloblet and charge boosters.
- If you are brand new with **no weapon or shield yet**, you can use **Fast-Forward Nourish** twice per UTC day to run up to 3 Energize rolls back-to-back until you land your first drop; it then locks Nourish for a short time (see §3.3).
- Join battles where both sides put RP at **stake**.
- Win RP and loot when you land good fights; lose RP and gear if you misplay or get unlucky.
- Keep coming back to Energize. If you go dark for too long, you drift toward “dead wallet” territory and fall out of the world.

There is no pay-to-win shortcut. You cannot swipe a card to buy stronger weapons or shields. You earn everything through Energize, battles, and the Luck Bucket.

## 2. Your Resources

### 2.1 Reward Points (RP)
- **What they are:** Your in-game currency and life bar.
- **Where they come from:**  
  - Winning PvP battles (you take RP from other players).  
  - Faucet or test stipends in Sandbox mode.  
  - Buy Points / top-ups (when available in your environment).
- **What they do:**  
  - Pay for **Energize** at the Life Hub.  
  - Pay battle **stakes**.  
  - Pay for personalization (rename, custom avatar, landmarks).
- **Risk:** If you hold RP, you are challengeable. Hoarding RP means you are inviting fights.

### 2.2 Gear: Weapons and Shields
- **Weapons (Offense):** Give you **Offense Power (OP)**.
- **Shields (Defense):** Give you **Defense Power (DP)**.
- Gear comes in tiers (for example OP 1–8, DP 1–8). Higher tier = stronger.
- You equip one weapon and one shield. Only the **equipped** pair matters in combat.

### 2.3 Boosters (Temporary Power)
- **What they are:** Short-lived power buffs you get when you **Energize**.
- **How they work:**
  - Each Energize bumps your current booster level, up to a **max of 3**.
  - Boosters apply equally to offense and defense during battles.
  - Boosters last for a fixed **window of time** after Energize.
- **Why they matter:** A fully boosted bloblet can punch far above its raw gear stats, especially in close fights.

## 3. Life Hub, Care, and Energize

Energize happens at the **Life Hub**. It is your bloblet’s pit stop.

### 3.1 Energize Cost and Cooldown
- **Cost:** Each Energize debits **5 RP**. When the Reward Ledger is on (production-style), you also get a **+1 RP Care Upkeep credit**, so the **net cost is 4 RP**.
- **Cooldown:** After you Energize, you must wait **15 minutes** before you can Energize again (`CARE_COOLDOWN_MIN` / `CARE_COOLDOWN_MS`).
- **Booster Window:** Boosters remain active for **15 minutes** after you Energize (`CARE_BOOSTER_WINDOW_MIN` / `CARE_BOOSTER_WINDOW_MS`).
- **Booster Cap:** Boosters stack up to **Level 3**. Further Energize actions refresh the timer and keep you maxed, but do not push you higher than 3.

These numbers can be tuned by the game over time, but the current defaults are reflected in the HUD and in this guide.

### 3.2 Overdue Care
- If you ignore your bloblet and do not Energize for a long stretch, you eventually become **overdue**.
- Once your 15-minute booster window expires, you are **blocked from launching new attacks** until you Energize again. **Defenders can be idle/sleeping** as long as they meet the RP minimum.
- Overdue bloblets are easy targets if someone else challenges them while their boosters are gone.
- Staying in rhythm with Energize is part of survival. If you want to keep winning, you need to keep showing up.

### 3.3 Fast-Forward Nourish (Newcomers)

Fast-Forward Nourish is a Life Hub shortcut for brand-new players who have **no weapon or shield yet**. It accelerates your first drops without changing the math.

- **Allowance:** Available only while you have zero gear. You get **2 bursts per UTC day**.
- **What it does:** Each burst chains up to **3 normal Nourish/Energize attempts** and stops as soon as you land a drop.
- **Cost and odds:** No extra fee. Every attempt uses the **same Nourish cost, odds, and Luck Bucket accumulator** as a standard Energize.
- **Time debt:** After a burst, you owe time before you can Nourish again: **15/30/45 minutes** based on **how many attempts you actually used**. The debt blocks all Nourish until it clears.
- **Availability:** Gated by a feature flag (currently on in preview, off in production until rollout).

## 4. The Luck Bucket and Loot Drops

Every Energize is also a roll on your **Luck Bucket** for gear upgrades. Energize grants temporary **Boosters** to your Offense/Defense Power (OP/DP) and simultaneously rolls for permanent gear.

<div className="img-container">
  <img src="/img/diagrams/luck-bucket.svg" alt="Luck Bucket Diagram: Bad Luck Protection" />
</div>

### 4.1 Base Chance and Protection Against Bad Luck
- Each Energize has a **base drop chance of 20%**.
- You have a **personal Luck Bucket**:
  - On a **miss**, your bucket fills up and your next chance is higher.
  - On a **hit**, your bucket empties and you start building it again.
- With a 20% base and the accumulator on, you are **guaranteed a drop within 5 Energize actions** (the bucket reaches 100% on the 5th try if you keep missing).
- Over multiple Energize actions, this system:
  - Keeps average drop rates fair.  
  - Protects you from absurdly long dry streaks.  
  - Still allows for short good-luck or bad-luck runs in the moment.

You can think of it like this: your visible “luck” bar in the HUD is the share of that bucket you currently have filled. The closer it is to full, the closer you are to a guaranteed drop.

### 4.2 What Drops and What It Upgrades
- **One slot per Energize:** Each successful roll upgrades **either** your weapon or your shield.
- **Shield-first bias:** If you have **no shield**, your first drops prefer filling that slot so you are not naked on defense.
- **Weaker-slot rule:** If you have both:
  - The system looks at your equipped weapon OP and shield DP.
  - It prefers to upgrade the weaker of the two, so your loadout converges instead of leaving a single obvious weak link.
- **Ties:** If both are equal, the upgrade slot is effectively a coin flip.

### 4.3 Auto-Equip and Stash
- When you win new gear:
  - If the new item is **strictly better** than what you are wearing, it auto-equips.
  - Otherwise, it goes to your **stash**.
- You can always open your Gear or Manage Loadout UI and choose which items to equip.
- **Stash is safe:** Only your **equipped** weapon and shield are ever at risk in battle.

## 5. Battles, Luck, and Stakes

### 5.1 Who Can Battle Whom (Eligibility)

To enter a PvP battle:
- You must have at least **5 RP** to put at stake. If either side is below 5 RP, the match is rejected.
- The **attacker must be energized/covered or within the current 15-minute window**. Once overdue, attackers are blocked until they Energize again. **Defenders can be idle/sleeping** as long as they still have the minimum RP.
- The defender gets a brief **global cooldown after a loss**: if they lost a battle in the last **5 minutes** (`PVP_DEFENDER_GLOBAL_COOLDOWN_MIN`), new challenges bounce until that window clears.
- Your bloblet must be **alive** (not a dead / pruned wallet).

To prevent farming:
- There is a **pair cooldown** of about **60 minutes**. After two wallets fight, they cannot immediately rematch over and over.
- Very aggressive, repeated targeting of the same wallet can trigger additional anti-farm behavior, described below.

### 5.2 How Rolls Work

Each battle has an **Attacker** and a **Defender**.

For each side we compute:
- **Base stat:**
  - Attacker: weapon OP + booster level.
  - Defender: shield DP + booster level.
- **Luck multiplier:**
  - A random multiplier within a **±20% band**.
  - This applies equally on both sides; nobody gets secret extra luck.

Your final **Roll** is essentially:
```text
Roll = round(Base × LuckMultiplier)
```

### 5.3 Tie Band and Coin Flips

Most of the time, higher Roll wins.

When the two Rolls are extremely close:
- If the difference is inside a small **tie band**, the battle is considered a **Clash**.
- In a Clash, the winner is decided by a clean **50/50 coin flip**.

This ensures:
- Stronger gear and boosters matter.
- Slightly weaker players still have a non-zero chance to upset favorites in razor-close fights.

### 5.4 Stakes: RP Transfers

Every battle has **real stakes in RP**:
- When you lose, you lose a slice of your RP balance.
- When you win, you gain that same slice from your opponent.

Defaults:
- **Transfer rate:** About **10%** of the loser’s RP balance is transferred.
- **Minimum transfer:** **5 RP** minimum (`PVP_MIN_TRANSFER` / `MIN_TRANSFER`), so low-balance wins still feel meaningful.
- **House cut:** **10% of the transfer** goes to the treasury (`HOUSE_CUT_BPS`). If you fight the **same opponent 3+ times in an hour** (`PVP_PAIR_FREQ_LIMIT_1H`), an extra **5% surcharge** (`PVP_PAIR_HOUSE_SURCHARGE_BPS`) kicks in for that pair. The rest goes to the winner.

The exact percentages can be tuned, but the shape of the rule stays the same: losers pay, winners take, and the house earns a cut to keep the game running.

### 5.5 Loot: Stealing Gear

In addition to RP, battles can move gear:
- **Standard win:**
  - If the **attacker** wins, they can steal the defender’s **shield**.
  - If the **defender** wins, they can steal the attacker’s **weapon**.
- **Critical win:**
  - On a small fixed chance, a win is a **critical**.
  - Critical wins can steal **both** weapon and shield from the loser.

Stolen items:
- Are auto-equipped if they are strictly better than your current piece.
- Otherwise go into your stash.

## 6. Anti-Farm and Dead Wallets

### 6.1 Anti-Farm Basics

The game actively resists farming and abuse:
- **Pair cooldown:** You cannot spam the same wallet over and over; after a fight, there is a cooldown before that pair can match again.
- **Pair frequency limits:** If you ignore everyone else and tunnel on a single defender, the system can push more of the RP into the **house cut** instead of letting you farm them risk-free (extra 5% house cut after **3 battles per hour** versus the same opponent).

These rules keep battles competitive and stop one-sided harassment.

### 6.2 Dead Wallet Consequences

Bloblet enforces a “use it or lose it” policy for long-abandoned wallets:
- If a wallet has been inactive for **60 minutes** and is marked dead:
  - It is pruned from the world map and leaderboards.
  - Its remaining RP balance is **confiscated to the treasury** under the dead-wallet rules while `PUNISH_DEAD_WALLETS` is on (the default).
- This keeps the active world clean and prevents stale, unplayed balances from clogging the economy.

To come back:
- Simply reconnect your wallet and play again (for example, Energize or claim/top-up when available).
- You effectively respawn as an active holder and can start rebuilding your RP and gear.

Staying awake, staying energized, and staying in the fight are the only real “meta” in Bloblet. There are no hidden pay-to-win items—just your bloblet, your effort, and your relationship with the Luck Bucket.
