import { sandboxConfig } from '@/src/config/sandbox'
import { resolveChainKind } from '@/src/server/chains'
import { normalizeChainAddress } from '@/src/server/address'
import { withPgClient } from '@/src/server/pg'
import {
  applyLedgerEntries,
  fetchRewardBalances,
  roundPoints,
  type RewardLedgerEntryInput,
} from '@/src/server/rewards'

type TradeOptions = {
  chainKind?: string
  creditAmount?: number
  redeemAmount?: number
  minBalanceAfterRedeem?: number
}

type TradeSummary = {
  deposit: {
    address: string
    credited: number
    balanceBefore: number
    balanceAfter: number
    swapId: number
  }
  redeem?: {
    address: string
    debited: number
    balanceBefore: number
    balanceAfter: number
    swapId: number
    skipped?: string
  }
}

export async function simulateSandboxTrade(options: TradeOptions = {}): Promise<TradeSummary> {
  const chainKind = options.chainKind || resolveChainKind()
  const creditAmount = options.creditAmount ?? sandboxConfig.trade.depositAmount
  const redeemAmount = options.redeemAmount ?? sandboxConfig.trade.withdrawAmount
  const reserveAmount = options.minBalanceAfterRedeem ?? sandboxConfig.trade.reserveFloor

  if (!(creditAmount > 0)) {
    throw new Error('SANDBOX_TRADE_DEPOSIT must be > 0')
  }
  if (!(redeemAmount > 0)) {
    throw new Error('SANDBOX_TRADE_WITHDRAW must be > 0')
  }

  let treasuryCanonical = ''
  const treasuryRaw = sandboxConfig.trade.treasuryAddress
  if (treasuryRaw) {
    try {
      treasuryCanonical = normalizeChainAddress(treasuryRaw, chainKind)
    } catch {
      treasuryCanonical = ''
    }
  }

  return withPgClient(async (client) => {
    await client.query('BEGIN')
    try {
      const candidatesRes = await client.query(
        `select address_canonical
           from public.token_holders
          where chain_kind = $1
            and address_canonical is not null
            and address_canonical <> $2
          order by random()
          limit 8
          for update`,
        [chainKind, treasuryCanonical || ''],
      )

      const candidates = candidatesRes.rows
        .map((row) => String(row.address_canonical || '').trim())
        .filter(Boolean)
      if (candidates.length < 1) {
        throw new Error('No sandbox wallets available for trade simulation')
      }

      const depositAddress = candidates[0]!
      const redeemAddress = candidates.find((addr) => addr !== depositAddress) ?? depositAddress

      const balances = await fetchRewardBalances(client, [depositAddress, redeemAddress], { lockRows: true })
      const now = new Date()
      const nowIso = now.toISOString()

      const depositBefore = roundPoints(balances.get(depositAddress)?.currentBalance ?? 0)
      const depositLedgerEntries: RewardLedgerEntryInput[] = [
        {
          address: depositAddress,
          delta: roundPoints(creditAmount),
          reason: 'swap_credit',
          metadata: { source: 'sandbox_trade', kind: 'auto_deposit', at: nowIso },
        },
      ]

      const depositSwapRes = await client.query(
        `insert into public.treasury_swaps (
           address, direction, status, source,
           amount_points, amount_tokens,
           reference, tx_signature, tx_explorer_url, metadata,
           created_at, updated_at, confirmed_at
         )
         values ($1,'deposit','confirmed','system',$2,$2,$3,null,null,$4::jsonb,$5,$5,$5)
         returning id`,
        [
          depositAddress,
          creditAmount,
          'sandbox-auto-deposit',
          JSON.stringify({ source: 'sandbox_trade', mode: 'auto', chainKind }),
          nowIso,
        ],
      )
      const depositSwapId = Number(depositSwapRes.rows[0]?.id)

      if (depositLedgerEntries[0]) {
        depositLedgerEntries[0]!.swapId = depositSwapId
      }

      const balancesAfterDeposit = await applyLedgerEntries(client, depositLedgerEntries, {
        now,
        updateTokenHolders: true,
      })
      const depositAfter = roundPoints(balancesAfterDeposit.get(depositAddress) ?? depositBefore + creditAmount)

      let redeemSummary: TradeSummary['redeem']
      if (redeemAddress) {
        const redeemBefore = roundPoints(balances.get(redeemAddress)?.currentBalance ?? 0)
        if (redeemBefore > redeemAmount + reserveAmount) {
          const redeemDelta = roundPoints(redeemAmount)
          const withdrawRes = await client.query(
            `insert into public.treasury_swaps (
               address, direction, status, source,
               amount_points, amount_tokens,
               reference, tx_signature, tx_explorer_url, metadata,
               created_at, updated_at
             )
             values ($1,'withdraw','pending','system',$2,$2,$3,null,null,$4::jsonb,$5,$5)
             returning id`,
            [
              redeemAddress,
              redeemAmount,
              'sandbox-auto-withdraw',
              JSON.stringify({ source: 'sandbox_trade', mode: 'auto', chainKind }),
              nowIso,
            ],
          )
          const withdrawSwapId = Number(withdrawRes.rows[0]?.id)

          const withdrawEntries: RewardLedgerEntryInput[] = [
            {
              address: redeemAddress,
              delta: -redeemDelta,
              reason: 'redeem_debit',
              swapId: withdrawSwapId,
              metadata: { source: 'sandbox_trade', mode: 'auto', at: nowIso },
            },
            {
              address: redeemAddress,
              delta: roundPoints(Math.max(redeemDelta * 0.1, 1)),
              reason: 'manual_adjustment',
              metadata: { source: 'sandbox_trade', mode: 'rebate', at: nowIso },
            },
          ]

          const balancesAfterWithdraw = await applyLedgerEntries(client, withdrawEntries, {
            now,
            updateTokenHolders: true,
          })
          const redeemAfter = roundPoints(balancesAfterWithdraw.get(redeemAddress) ?? redeemBefore - redeemAmount)

          redeemSummary = {
            address: redeemAddress,
            debited: redeemAmount,
            balanceBefore: redeemBefore,
            balanceAfter: redeemAfter,
            swapId: withdrawSwapId,
          }
        } else {
          redeemSummary = {
            address: redeemAddress,
            debited: 0,
            balanceBefore: redeemBefore,
            balanceAfter: redeemBefore,
            swapId: 0,
            skipped: 'insufficient_balance',
          }
        }
      }

      await client.query('COMMIT')

      return {
        deposit: {
          address: depositAddress,
          credited: creditAmount,
          balanceBefore: depositBefore,
          balanceAfter: depositAfter,
          swapId: depositSwapId,
        },
        redeem: redeemSummary,
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  })
}
