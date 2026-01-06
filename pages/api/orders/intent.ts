import type { NextApiRequest, NextApiResponse } from 'next'

import { getSessionFromRequest } from '@/src/server/auth'
import { resolveEconomyConfig } from '@/src/config/economy'
import { rateLimiter } from '@/src/server/rateLimit'
import { supaAdmin } from '@/src/server/supa'
import { resolveChainKind, getChainAdapter } from '@/src/server/chains'
import { getCachedGateBalance, refreshGateBalance } from '@/src/server/chains/gateCache'
import { gateThresholdRaw, gateUnits } from '@/src/server/chains/gate'
import { withPgClient } from '@/src/server/pg'
import {
  REWARD_LEDGER_ENABLED,
  fetchRewardBalances,
  roundPoints,
} from '@/src/server/rewards'
import { chargeCostPoints } from '@/src/shared/care'
import { normalizeChainAddress } from '@/src/server/address'
import { rewardLedgerDecimals, rewardPointsToTokenAmountRaw, tokenAmountToLedgerPoints } from '@/src/shared/points'
import { appConfig } from '@/src/config/app'
import { ordersConfig } from '@/src/config/orders'

const EPSILON = 1e-6
import {
  completeBlobletRename,
  completeLandmarkRename,
  createAvatarOrder,
  serializeInstantOrder,
  InsufficientRewardPointsError,
} from '@/src/server/orders/services/marketplace'
import {
  ensureRewardLedgerEnabled,
  getRewardBalanceSnapshot,
} from '@/src/server/orders/services/ledgerSpend'

type OrderType =
  | 'rename'
  | 'prop'
  | 'clip'
  | 'persona_upgrade'
  | 'avatar_custom'
  | 'care'
  | 'reward_topup'
  | 'prop_name'

function expiryIso() {
  const minutes = ordersConfig.intent.orderExpirationMinutes
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

let applyTriggerLogged = false

function scheduleAvatarTimeout(orderId: number | null | undefined) {
  const id = Number(orderId)
  if (!Number.isFinite(id) || id <= 0) return
  const baseUrl = appConfig.urls.internalApiBase
  const secret = appConfig.secrets.internalApi
  if (!baseUrl || !secret) return
  const autoMinutes = ordersConfig.intent.avatarAutoFinalizeMinutes
  if (!Number.isFinite(autoMinutes) || autoMinutes <= 0) return
  const timeoutMs = Math.max(autoMinutes * 60 * 1000, 60_000)
  const apiUrl = baseUrl.replace(/\/$/, '')

  const timer = setTimeout(() => {
    fetch(`${apiUrl}/api/orders/status?id=${id}`, {
      headers: { 'x-internal-auth': secret },
      keepalive: true,
    })
      .then(async (res) => {
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        const status = typeof json?.status === 'string' ? json.status.toLowerCase() : ''
        if (status !== 'generated' && status !== 'alive_ready') return
        return fetch(`${apiUrl}/api/orders/finalize`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-internal-auth': secret,
          },
          body: JSON.stringify({ orderId: id }),
          keepalive: true,
        })
      })
      .catch(() => {})
  }, timeoutMs)
  if (typeof timer === 'object' && typeof (timer as any).unref === 'function') {
    ;(timer as any).unref()
  }
}

function triggerOrderApply(orderId: number | null | undefined) {
  const id = Number(orderId)
  if (!Number.isFinite(id) || id <= 0) return
  const baseUrl = appConfig.urls.internalApiBase
  const secret = appConfig.secrets.internalApi
  if (!baseUrl || !secret) {
    if (!applyTriggerLogged) {
      console.warn('[orders.intent] skipping order apply trigger (missing internal API base or secret)')
      applyTriggerLogged = true
    }
    return
  }
  const url = `${baseUrl.replace(/\/$/, '')}/api/orders/apply`
  const payload = JSON.stringify({ orderId: id })
  fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-internal-auth': secret,
    },
    body: payload,
    keepalive: true,
  })
    .then((res) => {
      if (!res.ok && !applyTriggerLogged) {
        applyTriggerLogged = true
        res.text().then((body) => {
          console.warn('[orders.intent] order apply trigger responded with non-OK status', {
            orderId: id,
            status: res.status,
            body: body?.slice(0, 200) || null,
          })
        }).catch(() => {})
      }
    })
    .catch((err) => {
      if (!applyTriggerLogged) {
        applyTriggerLogged = true
        console.error('[orders.intent] order apply trigger failed', {
          orderId: id,
          error: err?.message || String(err),
        })
      }
    })
}

function validate(type: OrderType, params: any) {
  if (type === 'rename') {
    const name = String(params?.name || '').trim()
    if (!name || name.length > 32) throw new Error('Invalid name')
    return { name }
  }
  if (type === 'prop') {
    const kw = Array.isArray(params?.keywords)
      ? (params.keywords as string[])
      : String(params?.keywords || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (!kw.length) throw new Error('Missing keywords')
    return { keywords: kw.slice(0, 8) }
  }
  if (type === 'clip') {
    const text = String(params?.text || '').trim()
    const seconds = Math.max(1, Math.min(120, Number(params?.seconds || 10)))
    if (!text) throw new Error('Missing text')
    return { text, seconds }
  }
  if (type === 'persona_upgrade') {
    const traits = String(params?.traits || '').trim()
    if (!traits) throw new Error('Missing traits')
    return { traits }
  }
  if (type === 'avatar_custom') {
    const promptRaw = String(params?.promptRaw || '').trim()
    const stylePreset = String(params?.stylePreset || '').trim().toLowerCase() || null
    if (!promptRaw || promptRaw.length < 3) throw new Error('Missing prompt')
    const allowed = new Set(['cinematic','painterly','comic','cyberpunk','noir','none',''])
    const preset = allowed.has(stylePreset || '') ? (stylePreset || null) : null
    return { promptRaw, stylePreset: preset }
  }
  if (type === 'care') {
    return {}
  }
  if (type === 'reward_topup') {
    const variants = [params?.amount, params?.points, params?.quote, params?.value]
    const candidate = variants
      .map((value) => Number(value))
      .find((value) => Number.isFinite(value))
    const amount = roundPoints(candidate ?? Number.NaN)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('invalid_amount')
    return { points: amount }
  }
  if (type === 'prop_name') {
    const propId = Number(params?.propId)
    const name = String(params?.name || '').trim()
    if (!Number.isFinite(propId) || propId <= 0) throw new Error('Invalid propId')
    if (!name || name.length > 32) throw new Error('Invalid name')
    // Basic character set: letters, numbers, spaces, hyphen, underscore, apostrophe
    if (!/^[A-Za-z0-9 _'\-]+$/.test(name)) throw new Error('Invalid characters')
    return { propId, name }
  }
  throw new Error('Unsupported type')
}

type SerializedOrder = {
  id: number
  type: string | null
  status: string
  quoteAmount: number
  expiresAt: string | null
  confirmedAt: string | null
  appliedAt: string | null
  txHash: string | null
}

function serializeOrder(row: any | null): SerializedOrder | null {
  if (!row) return null
  return {
    id: Number(row.id),
    type: row.type != null ? String(row.type) : null,
    status: String(row.status || 'pending'),
    quoteAmount: Number(row.quote_amount ?? 0),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
    appliedAt: row.applied_at ? String(row.applied_at) : null,
    txHash: row.tx_hash ? String(row.tx_hash) : null,
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed')
    // Require session
    const sess = getSessionFromRequest(req)
    if (!sess || !sess.address) return res.status(401).json({ error: 'unauthorized' })
    const ip = (req.headers['x-forwarded-for'] as string) || 'orders'
    const { success } = await rateLimiter.limit(`orders:intent:${ip}`)
    if (!success) return res.status(429).json({ error: 'rate limited' })

    const body = req.body || {}
    const bodyAddressRaw = String(body.address || '').trim()
    const sessionAddressRaw = String(sess.address || '').trim()
    const chainKind = resolveChainKind()
    const chain = getChainAdapter(chainKind)
    const sessionCanonical = (() => {
      try {
        return normalizeChainAddress(sessionAddressRaw, chainKind)
      } catch {
        return ''
      }
    })()
    if (!sessionCanonical) {
      return res.status(400).json({ error: 'invalid_address' })
    }
    if (bodyAddressRaw) {
      const bodyCanonical = (() => {
        try {
          return normalizeChainAddress(bodyAddressRaw, chainKind)
        } catch {
          return ''
        }
      })()
      if (!bodyCanonical || bodyCanonical !== sessionCanonical) {
        return res.status(403).json({ error: 'address mismatch' })
      }
    }
    const address = sessionCanonical
    const addressCased = sessionCanonical
    const addressCanonical = sessionCanonical
    // Optional: require holder status
    const requireHolder = ordersConfig.flags.requireHolder
    let holderStatus = !!sess.isHolder
    if (requireHolder && !holderStatus) {
      let snapshot = null
      try {
        snapshot = await getCachedGateBalance(addressCanonical)
        if (snapshot?.isHolder) holderStatus = true
      } catch (err) {
        console.warn('[orders.intent] holder cache lookup failed', {
          addressCanonical,
          chainKind,
          error: (err as any)?.message || String(err),
        })
      }
      if (!holderStatus) {
        try {
          const refreshed = await refreshGateBalance(addressCanonical)
          if (refreshed?.isHolder) holderStatus = true
        } catch (err) {
          console.warn('[orders.intent] holder refresh failed', {
            addressCanonical,
            chainKind,
            error: (err as any)?.message || String(err),
          })
        }
      }
    }
    if (requireHolder && !holderStatus) return res.status(403).json({ error: 'holder required' })
    const type = String(body.type || '') as OrderType
    const params = body.params || {}
    const sourceRaw = typeof body.source === 'string' ? body.source.trim() : ''
    const telemetrySource = sourceRaw ? sourceRaw.slice(0, 64) : null
    if (!type) return res.status(400).json({ error: 'invalid payload' })

    // Lookup product in DB (source of truth for products and prices)
    const supa = supaAdmin()
    const economy = resolveEconomyConfig()

    // Expire any older pending orders for this wallet so the newest order is always authoritative.
    try {
      await supa
        .from('orders')
        .update({ status: 'expired', reason: 'superseded_by_new_order' })
        .eq('chain_kind', chainKind)
        .eq('address_canonical', addressCanonical)
        .eq('status', 'pending')
        .is('tx_hash', null)
    } catch (err) {
      console.error('[orders.intent] failed to expire previous pending orders', {
        addressCanonical,
        chainKind,
        error: (err as any)?.message || String(err),
      })
    }

    const requiresCatalogProduct =
      type !== 'reward_topup' && type !== 'rename' && type !== 'avatar_custom' && type !== 'prop_name'
    let prod: any | null = null
    if (requiresCatalogProduct) {
      const { data: prodRow, error: prodErr } = await supa
        .from('products')
        .select('id,is_active,amount_tokens')
        .eq('id', type)
        .maybeSingle()
      if (prodErr) throw prodErr
      if (!prodRow || prodRow.is_active !== true) return res.status(404).json({ error: 'product not found' })
      prod = prodRow
    } else {
      try {
        const { data: prodRow } = await supa
          .from('products')
          .select('id,is_active,amount_tokens')
          .eq('id', 'reward_topup')
          .maybeSingle()
        if (prodRow && prodRow.is_active === false) {
          return res.status(403).json({ error: 'reward_topup_disabled' })
        }
        prod = prodRow || null
      } catch (err) {
        console.warn('[orders.intent] reward_topup product lookup failed', {
          addressCanonical,
          chainKind,
          error: (err as any)?.message || String(err),
        })
      }
    }

    const cleanParams = validate(type, params)
    if (telemetrySource) {
      try {
        ;(cleanParams as any).source = telemetrySource
      } catch {
        // params may be an immutable primitive; ignore
      }
    }

    // Compute quote; allow dynamic pricing for prop_name
    let quote = Number(prod?.amount_tokens || 0)
    const paymentWindowMinutes = ordersConfig.intent.orderExpirationMinutes

    if (type === 'rename') {
      quote = roundPoints(economy.pricing.renameRp)
    }

    if (type === 'care') {
      const defaultPrice = Number.isFinite(Number(prod?.amount_tokens))
        ? Number(prod?.amount_tokens)
        : chargeCostPoints()
      quote = Math.max(0, defaultPrice)
      ;(cleanParams as any).unitPrice = quote
    }
    if (type === 'avatar_custom') {
      quote = roundPoints(economy.pricing.customAvatarRp)
    }
    if (type === 'reward_topup') {
      const requested = roundPoints(Number((cleanParams as any).points || 0))
      if (!Number.isFinite(requested) || requested <= 0) {
        return res.status(400).json({ error: 'invalid_amount' })
      }
      const minPoints = roundPoints(economy.rewardTopUp.minRp)
      if (requested < minPoints) {
        return res.status(400).json({ error: 'amount_too_low', minPoints })
      }
      quote = requested
      ;(cleanParams as any).minPoints = minPoints

      // Preflight balance checks block Solana flows due to case-sensitivity and
      // wallet state variability. Enforce payment strictly at confirm-time.
      const preflightEnabled = chainKind !== 'sol'
      const gateTokens = gateUnits()
      if (preflightEnabled && gateTokens > 0) {
        try {
          const balance = await chain.fetchGateBalance(address)
          const tokenDecimals = (() => {
            const rpcDec = Number.isFinite(balance.decimals) ? Math.max(0, Math.floor(Number(balance.decimals))) : NaN
            const envDec = Number.isFinite(chain.metadata.tokenDecimals)
              ? Math.max(0, Math.floor(Number(chain.metadata.tokenDecimals)))
              : NaN
            if (Number.isFinite(rpcDec)) {
              if (Number.isFinite(envDec) && envDec !== rpcDec) {
                console.warn('[orders.intent] token decimals mismatch (env vs rpc)', { envDec, rpcDec })
              }
              return rpcDec
            }
            return Number.isFinite(envDec) ? envDec : 0
          })()
          const ledgerDecimals = rewardLedgerDecimals()
          const quoteRaw = rewardPointsToTokenAmountRaw(quote, tokenDecimals, ledgerDecimals)
          const thresholdRaw = gateThresholdRaw(tokenDecimals)
          if (quoteRaw > balance.raw) {
            const payload: any = {
              error: 'insufficient_token_balance',
              requested: quote,
              tokenBalance: tokenAmountToLedgerPoints(balance.raw, tokenDecimals, ledgerDecimals),
              gateTokens,
            }
            return res.status(402).json(payload)
          }
          if (thresholdRaw > 0n && balance.raw - quoteRaw < thresholdRaw) {
            return res.status(400).json({
              error: 'would_drop_below_gate',
              requested: quote,
              tokenBalance: tokenAmountToLedgerPoints(balance.raw, tokenDecimals, ledgerDecimals),
              gateTokens,
            })
          }
        } catch (err) {
          console.warn('[orders.intent] reward_topup gate check failed', {
            addressCanonical,
            chainKind,
            error: (err as any)?.message || String(err),
          })
        }
      }
    }

    if (type === 'prop_name') {
      try {
        const propId = Number((cleanParams as any).propId)
        const { data: propRow } = await supa
          .from('bloblets')
          .select('prop_id,rename_count,landmark_price_rp')
          .eq('prop_id', propId)
          .eq('entity_type', 'landmark')
          .eq('chain_kind', chainKind)
          .maybeSingle()
        if (!propRow) throw new Error('prop_not_found')
        // Load product config overrides
        let base = roundPoints(economy.pricing.landmarkBaseRp)
        let step = roundPoints(economy.pricing.landmarkStepRp)
        let premiumPct = Math.max(0, Number(economy.pricing.landmarkPremiumPct ?? 0))
        try {
          const { data: cfg } = await supa
            .from('product_configs')
            .select('params')
            .eq('product_id', 'prop_name')
            .maybeSingle()
          if (cfg && (cfg as any).params) {
            const p = (cfg as any).params
            if (Number.isFinite(Number(p.base))) base = Number(p.base)
            if (Number.isFinite(Number(p.step))) step = Number(p.step)
            if (Number.isFinite(Number(p.premiumPct))) premiumPct = Math.max(0, Number(p.premiumPct))
          }
        } catch {}
        const rc = Math.max(0, Number((propRow as any).rename_count || 0))
        const lastPrice = Math.max(0, Number((propRow as any).landmark_price_rp || 0))
        const stepPrice = base + step * rc
        const premiumPrice = lastPrice > 0 ? Math.ceil(lastPrice * (1 + premiumPct)) : base
        quote = roundPoints(Math.max(stepPrice, premiumPrice))
        ;(cleanParams as any).renameCount = rc
        ;(cleanParams as any).base = base
        ;(cleanParams as any).step = step
        ;(cleanParams as any).premiumPct = premiumPct
        ;(cleanParams as any).minPrice = quote
        ;(cleanParams as any).lastPrice = lastPrice
        ;(cleanParams as any).stepPrice = stepPrice
      } catch (e: any) {
        return res.status(404).json({ error: e?.message || 'prop_not_found' })
      }
    }

    if (type === 'rename') {
      try {
        await ensureRewardLedgerEnabled()
      } catch {
        return res.status(503).json({ error: 'reward_ledger_disabled' })
      }
      const currentBalance = await getRewardBalanceSnapshot(addressCanonical)
      if (currentBalance + EPSILON < quote) {
        return res.status(402).json({
          error: 'insufficient_balance',
          quoteAmount: quote,
          ledgerBalance: currentBalance,
          message: `Rename requires ${quote} RP. Current balance ${currentBalance} RP.`,
        })
      }

      try {
        const result = await completeBlobletRename({
          addressCanonical,
          addressCased,
          chainKind,
          name: (cleanParams as any).name,
          priceRp: quote,
          paramsJson: cleanParams,
          source: telemetrySource,
        })

        return res.status(200).json({
          ok: true,
          paymentRequired: false,
          quoteAmount: quote,
          order: serializeInstantOrder(result.order),
          ledgerBalanceBefore: result.ledger.balanceBefore,
          ledgerBalanceAfter: result.ledger.balanceAfter,
          message: `Rename applied. Remaining balance ${result.ledger.balanceAfter} RP.`,
        })
      } catch (err: any) {
        if (err instanceof InsufficientRewardPointsError) {
          const current = await getRewardBalanceSnapshot(addressCanonical)
          return res.status(402).json({
            error: 'insufficient_balance',
            quoteAmount: quote,
            ledgerBalance: current,
          })
        }
        console.error('[orders.intent] rename failed', {
          addressCanonical,
          chainKind,
          error: err?.message || String(err),
        })
        return res.status(500).json({ error: err?.message || 'rename_failed' })
      }
    }

    if (type === 'avatar_custom') {
      try {
        await ensureRewardLedgerEnabled()
      } catch {
        return res.status(503).json({ error: 'reward_ledger_disabled' })
      }
      // Note: Balance check removed - payment happens at finalize, not at preview generation
      // This allows users to generate previews for free and only pay when they apply
      const currentBalance = await getRewardBalanceSnapshot(addressCanonical)

      try {
        const result = await createAvatarOrder({
          addressCanonical,
          addressCased,
          chainKind,
          priceRp: quote,
          paramsJson: cleanParams,
          source: telemetrySource,
        })
        const orderId = result?.order?.id
        triggerOrderApply(orderId)
        scheduleAvatarTimeout(orderId)
        return res.status(200).json({
          ok: true,
          paymentRequired: false,
          quoteAmount: quote,
          order: serializeInstantOrder(result.order),
          ledgerBalanceBefore: currentBalance,
          ledgerBalanceAfter: currentBalance, // Balance unchanged - debit happens at finalize
          message: `Preview generation started. You'll pay ${quote} RP when you apply the preview.`,
        })
      } catch (err: any) {
        if (err instanceof InsufficientRewardPointsError) {
          const current = await getRewardBalanceSnapshot(addressCanonical)
          return res.status(402).json({
            error: 'insufficient_balance',
            quoteAmount: quote,
            ledgerBalance: current,
          })
        }
        console.error('[orders.intent] avatar order failed', {
          addressCanonical,
          chainKind,
          error: err?.message || String(err),
        })
        return res.status(500).json({ error: err?.message || 'avatar_order_failed' })
      }
    }

    if (type === 'prop_name') {
      try {
        await ensureRewardLedgerEnabled()
      } catch {
        return res.status(503).json({ error: 'reward_ledger_disabled' })
      }

      const currentBalance = await getRewardBalanceSnapshot(addressCanonical)
      if (currentBalance + EPSILON < quote) {
        return res.status(402).json({
          error: 'insufficient_balance',
          quoteAmount: quote,
          ledgerBalance: currentBalance,
          message: `Landmark rename requires ${quote} RP. Current balance ${currentBalance} RP.`,
        })
      }

      try {
        const renameCount = Number((cleanParams as any).renameCount || 0)
        const base = Number((cleanParams as any).base || economy.pricing.landmarkBaseRp)
        const step = Number((cleanParams as any).step || economy.pricing.landmarkStepRp)
        const premiumPct = Math.max(
          0,
          Number((cleanParams as any).premiumPct ?? economy.pricing.landmarkPremiumPct ?? 0),
        )
        const result = await completeLandmarkRename({
          addressCanonical,
          addressCased,
          chainKind,
          propId: Number((cleanParams as any).propId),
          newName: (cleanParams as any).name,
          expectedCount: renameCount,
          basePriceRp: base,
          stepPriceRp: step,
          premiumPct,
          priceRp: quote,
          paramsJson: cleanParams,
          source: telemetrySource,
        })

        return res.status(200).json({
          ok: true,
          paymentRequired: false,
          quoteAmount: quote,
          order: serializeInstantOrder(result.order),
          ledgerBalanceBefore: result.ledger.balanceBefore,
          ledgerBalanceAfter: result.ledger.balanceAfter,
          message: `Landmark renamed. Remaining balance ${result.ledger.balanceAfter} RP.`,
        })
      } catch (err: any) {
        if (err instanceof InsufficientRewardPointsError) {
          const current = await getRewardBalanceSnapshot(addressCanonical)
          return res.status(402).json({
            error: 'insufficient_balance',
            quoteAmount: quote,
            ledgerBalance: current,
          })
        }
        const errorMessage = err?.message || 'prop_name_failed'
        const status =
          errorMessage === 'prop_not_found'
            ? 404
            : errorMessage === 'price_mismatch' || errorMessage === 'price_changed'
            ? 409
            : 500
        if (status >= 500) {
          console.error('[orders.intent] prop name failed', {
            addressCanonical,
            chainKind,
            error: errorMessage,
          })
        }
        return res.status(status).json({ error: errorMessage })
      }
    }
    const expires = expiryIso()

    let ledgerBalance: number | null = null
    let paymentRequired = true

    if (type === 'care') {
      if (REWARD_LEDGER_ENABLED) {
        try {
          ledgerBalance = await withPgClient(async (client) => {
            const balances = await fetchRewardBalances(client, [addressCanonical], { lockRows: false })
            const snapshot = balances.get(addressCanonical)
            return roundPoints(snapshot?.currentBalance ?? 0)
          })
        } catch (err) {
          console.error('[orders.intent] failed to read ledger balance', {
            addressCanonical,
            chainKind,
            error: (err as any)?.message || String(err),
          })
        }
      }
      paymentRequired = !REWARD_LEDGER_ENABLED || (ledgerBalance ?? 0) + 1e-6 < quote
      if (!paymentRequired) {
        const message = `Ledger balance ${ledgerBalance} points covers the ${quote} point energize.`
        return res.status(200).json({
          ok: true,
          paymentRequired: false,
          quoteAmount: quote,
          ledgerBalance,
          order: null,
          expiresAt: null,
          paymentWindowMinutes,
          message,
        })
      }
    }

    // Ensure bloblet exists and is alive (fresh holder verification allows immediate flip)
    const { data: bl } = await supa
      .from('bloblets')
      .select('address,is_alive')
      .eq('chain_kind', chainKind)
      .eq('address_canonical', addressCanonical)
      .maybeSingle()
    if (!bl) {
      if (holderStatus) {
        try {
          const { pickAppearance } = await import('@/src/shared/appearance')
          const ap = pickAppearance(addressCanonical, 'bottom')
          await supa.from('bloblets').upsert({
            address: addressCased,
            address_cased: addressCased,
            address_canonical: addressCanonical,
            chain_kind: chainKind,
            is_alive: true,
            tier: 'bottom',
            appearance_id: ap.id,
            avatar_alive_url_256: ap.url,
            last_seen_at: new Date().toISOString(),
          } as any, { onConflict: 'address' })
        } catch {}
      } else {
        return res.status(404).json({ error: 'bloblet not found' })
      }
    } else if (!bl.is_alive) {
      if (holderStatus) {
        try {
          await supa
            .from('bloblets')
            .update({ is_alive: true, last_seen_at: new Date().toISOString() } as any)
            .eq('chain_kind', chainKind)
            .eq('address_canonical', addressCanonical)
        } catch {}
      } else {
        return res.status(403).json({ error: 'bloblet inactive' })
      }
    }

    const addressForOrders = String((bl as any)?.address_cased || (bl as any)?.address || addressCased || addressCanonical)

    const { data: row, error } = await supa
      .from('orders')
      .insert({
        address: addressForOrders,
        address_cased: addressCased,
        address_canonical: addressCanonical,
        chain_kind: chainKind,
        type,
        params: cleanParams as any,
        quote_amount: quote,
        status: 'pending',
        expires_at: expires,
      })
      .select('*')
      .maybeSingle()
    if (error) throw error

    const message =
      type === 'care'
        ? `Send ${quote} tokens from wallet ${addressCased} within ${paymentWindowMinutes} minutes to confirm your energize payment.`
        : type === 'reward_topup'
        ? `Send ${quote} tokens from wallet ${addressCased} within ${paymentWindowMinutes} minutes to credit BlobCoin.`
        : `Quote: buy ${quote} tokens from wallet ${addressCased} within the next ${paymentWindowMinutes} minutes to confirm.`
    const payload: Record<string, any> = {
      ok: true,
      order: serializeOrder(row),
      message,
      paymentRequired,
      quoteAmount: quote,
      paymentWindowMinutes,
      expiresAt: row?.expires_at ?? expires,
    }
    if (type === 'care') {
      payload.ledgerBalance = ledgerBalance
    }
    if (type === 'reward_topup') {
      payload.minPoints = (cleanParams as any).minPoints
    }
    return res.status(200).json(payload)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'intent failed' })
  }
}
