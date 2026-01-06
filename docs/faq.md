# Bloblet Player FAQ

> **Status:** Player Guide (FAQ)  
> **Last Verified:** 2025-11-20T10:30:29Z (UTC)

This FAQ explains the core loop in plain language. For full details, see the Gameplay, Economy, and Security sections of the Bible.

## Accounts, Wallets, and Sessions

### Q: How do I connect my wallet and start playing?
A: Click the wallet button in the HUD and choose a supported wallet (for example, Phantom or Solflare). You will be asked to sign a short, zero-fee message to prove it is you. After that, you get a gameplay session and can see your bloblet, RP balance, and actions.  
See also: [Gameplay Rules & How to Play](01-gameplay/rules.md)

### Q: Is my wallet at risk when I play?
A: Bloblet never sees your private key and cannot move funds without a signature in your wallet. You always confirm important actions (like top-ups or redeems) inside your own wallet. If anything looks off, disconnect and double-check the URL before signing again.  
See also: [Wallet Safety & Sign-In](05-security/04-wallet-safety.md)

### Q: What happens if my session expires?
A: If you are inactive for a while, your session will eventually expire. When that happens, you may see prompts to reconnect or re-sign before doing actions that touch RP or tokens. Just reconnect your wallet and sign in again to continue.  
See also: [Wallet Safety & Sign-In](05-security/04-wallet-safety.md)

## Reward Points (RP) and the Treasury

### Q: What are Reward Points and how do I get them?
A: Reward Points (RP) are your in-game currency and life bar. You earn RP by winning battles, by faucet grants in Sandbox mode, and by using Buy Points or top-ups when they are available.  
See also: [Economy Rules](02-economy/rules.md)

### Q: How do I load up more RP?
A: Use the Buy Points or top-up flow in the HUD (if it is enabled for your environment). You choose an amount within the allowed range, confirm in your wallet if needed, and your RP balance increases once the order completes. In the current Sandbox profile, top-ups run from **25–1,000 RP** per order, and you count as a holder once your wallet holds **300 tokens** or more.  
See also: [Economy Rules](02-economy/rules.md)

### Q: Can I redeem RP back to tokens?
A: Yes, when redeems are enabled in your environment. You can convert RP back into the project token through the Redeem flow, subject to guardrails like minimum size, cooldowns, daily caps, and a win-lock on fresh winnings. These limits exist to protect the shared treasury.  
See also: [Economy Rules](02-economy/rules.md)

### Q: What is the treasury and why does it take a house cut?
A: The treasury is the game’s bank. It collects a small cut from each battle and from marketplace spending so the project can pay for servers, development, events, and long-term sustainability. The rest of the transferred RP always goes to the winner.  
See also: [Treasury, Safety, and Player Trust](05-security/01-treasury-policy.md)

## Sandbox vs Production

### Q: What is Sandbox mode?
A: Sandbox mode is a low-stakes environment that uses a treasury-minted sandbox token instead of a tradable project token. You can claim a faucet, test Energize and battles, and help find bugs and balance issues without risking real token value.  
See also: [Economy Rules](02-economy/rules.md)

### Q: What changes in Production?
A: In Production, the game will use a real project token. You will typically acquire it on supported markets, send it to the treasury to receive RP, and be able to redeem RP back into the token under strict limits. Faucet and pricing are stricter, and guardrails matter more because real value is at stake.  
See also: [Economy Rules](02-economy/rules.md)

## Energize, Luck Bucket, and Gear

### Q: What happens when I Energize?
A: Energize is your bloblet’s pit stop at the Life Hub. You spend **5 RP** (net **4 RP** after the **+1 RP Care Upkeep** credit when the ledger is enabled) to wake your bloblet, charge boosters for a **15-minute** window, and roll your personal Luck Bucket for a gear upgrade. Each Energize resets your overdue timer so you can attack again.  
See also: [Life Hub, Care, and Energize](01-gameplay/rules.md#3-life-hub-care-and-energize)

### Q: Do I need to stay energized to attack?
A: Yes. Once the **15-minute** Energize window expires, attackers become **overdue** and cannot start new battles until they Energize again. Defenders can be idle/sleeping as long as they still have the minimum RP.  
See also: [Who Can Battle Whom](01-gameplay/rules.md#51-who-can-battle-whom-eligibility)

### Q: What is the Luck Bucket?
A: The Luck Bucket is a personal bar that fills when you miss a drop and empties when you hit. Each Energize has a base chance to drop loot; misses add to your bucket so your effective odds climb over time. This protects you from endless bad luck streaks while still allowing hot or cold runs.  
See also: [The Luck Bucket and Loot Drops](01-gameplay/rules.md#4-the-luck-bucket-and-loot-drops)

### Q: What kind of loot can I get?
A: Loot from Energize upgrades your weapon or shield. If you have no shield, early drops focus on filling that slot. After that, the system tends to upgrade the weaker of your two equipped pieces, so your build stays balanced instead of leaving one obvious weak point.  
See also: [The Luck Bucket and Loot Drops](01-gameplay/rules.md#4-the-luck-bucket-and-loot-drops)

### Q: Do new items auto-equip, and can I lose them?
A: New items auto-equip only if they are strictly better than what you are wearing; otherwise they go to your stash. In battles, only your equipped weapon and shield are at risk. Your stash is safe from theft.  
See also: [Gear and Loot: Weapons and Shields](01-gameplay/rules.md#22-gear-weapons-and-shields)

## Battles, Stakes, and Fairness

### Q: How are winners decided in battles?
A: Each side gets a Roll based on gear + boosters, nudged by a small random luck multiplier. Higher Roll usually wins. If the Rolls are extremely close, the fight falls into a tie band and is resolved by a fair 50/50 coin flip.  
See also: [Battles, Luck, and Stakes](01-gameplay/rules.md#5-battles-luck-and-stakes)

### Q: What do I risk when I fight?
A: When you enter a battle, a slice of your RP is at stake. Both sides must have at least **5 RP**. Roughly **10%** of the loser’s RP transfers to the winner (minimum **5 RP**), with a **10% house cut** from that transfer. If you spam the same opponent **3+ times in an hour**, the house cut for that pair jumps by another **5%**. On top of RP, you can lose or steal equipped gear depending on who wins and whether the win is critical.  
See also: [Stakes: RP Transfers](01-gameplay/rules.md#54-stakes-rp-transfers)

### Q: Can I just farm the same weak player over and over?
A: No. There is a **60-minute pair cooldown** after each fight so the same two wallets cannot immediately rematch forever. If you push **3+ battles in an hour** against the same defender, an extra **5% house cut** kicks in for that pair. Defenders also get a brief **5-minute grace** after they lose before fresh challenges land.  
See also: [Anti-Farm and Dead Wallets](01-gameplay/rules.md#6-anti-farm-and-dead-wallets)

### Q: Does paying more money make me stronger in battle?
A: No. You cannot buy stronger weapons or shields directly. You can top up RP to play more, but actual combat power comes from your gear drops, boosters, and how you use the Luck Bucket and battle rules. Everyone follows the same formulas.  
See also: [Gameplay Rules & How to Play](01-gameplay/rules.md)

## Dead Wallets and Activity

### Q: What is a “dead wallet” in Bloblet?
A: A wallet becomes “dead” if it has been inactive for a long stretch and marked as such by the system. After **60 minutes** in a dead state, it falls off the world map and leaderboards, and any remaining RP is confiscated back to the treasury while dead-wallet punishment is enabled.  
See also: [Anti-Farm and Dead Wallets](01-gameplay/rules.md#62-dead-wallet-consequences)

### Q: How do I come back if my wallet went dead?
A: Just reconnect your wallet and play again. For example, Energize, claim from the faucet (if available), or top up. You effectively respawn as an active holder and can start rebuilding your RP and gear from there.  
See also: [Anti-Farm and Dead Wallets](01-gameplay/rules.md#62-dead-wallet-consequences)

## Troubleshooting and Support

### Q: My Loot Bucket feels off. How can I check?
A: The Luck Bucket is designed to keep your long-term drops fair, but short streaks of good or bad luck still happen. Use any in-game stats or history panels to review your recent Energize attempts. If something looks wildly inconsistent with the rules in this Bible, let the team know so they can investigate.  
See also: [RNG Fairness](05-security/02-rng-fairness.md)

### Q: I think a redeem or battle result is wrong. What should I do?
A: Capture screenshots (including your RP balance before/after and any error messages) and report the issue through official channels. We treat discrepancies between live behavior and this Bible as bugs, not “working as intended.”  
See also: [Economy Rules](02-economy/rules.md)
