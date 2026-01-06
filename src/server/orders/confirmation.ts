import type { ConfirmOrderParams, ConfirmOrderResult, OrderLogContext } from '@/src/server/orders/types'
import { serializeOrder } from '@/src/server/orders/services/serialization'
import { loadPendingOrder } from '@/src/server/orders/services/order-fetcher'
import { resolveTreasuryContext } from '@/src/server/orders/services/treasury'
import type { TreasuryContext } from '@/src/server/orders/services/treasury'
import { verifyOrderTransfer } from '@/src/server/orders/services/verify-transfer'
import {
  applyPropNameOrder,
  applyRenameOrder,
  applyRewardTopupOrder,
  confirmCareOrder,
  confirmGenericOrder,
  confirmUnsupportedBundle,
} from '@/src/server/orders/services/apply'
import { ordersConfig } from '@/src/config/orders'

export async function confirmOrder(params: ConfirmOrderParams): Promise<ConfirmOrderResult> {
  const { supa, chainKind, chain, orderId, txHash, internal, sessionAddressKey } = params

  try {
    const loaded = await loadPendingOrder({
      supa,
      chainKind,
      orderId,
      txHash,
      internal,
      sessionAddressKey,
    })

    if (loaded.kind === 'response') {
      return loaded.response
    }

    const { order, addressRaw, addressCanonical, addressCased } = loaded.value
    const orderType = String((order as any).type || '')
    const logBase: OrderLogContext = { orderId, txHash, chainKind, type: orderType, internal: !!internal }
    const allowTestConfirmations = internal && ordersConfig.flags.allowTestConfirmations
    const skipOnchainValidation = Boolean(
      internal &&
        (orderType === 'care' ||
          orderType === 'care_bundle' ||
          (allowTestConfirmations && orderType === 'reward_topup')),
    )

    const treasury = resolveTreasuryContext({ chainKind, chain, log: logBase })
    if (!isTreasuryContext(treasury)) {
      return treasury
    }

    const verification = await verifyOrderTransfer({
      chain,
      order,
      addressRaw,
      tokenAddress: treasury.tokenAddress,
      recipients: treasury.recipients,
      memoFragment: treasury.memoFragment,
      decimals: treasury.decimals,
      skipOnchainValidation,
      log: logBase,
    })

    if (verification.kind === 'pending' || verification.kind === 'error') {
      return verification.response
    }

    const { data: used } = await supa
      .from('orders')
      .select('id')
      .eq('tx_hash', txHash)
      .neq('id', orderId)
      .maybeSingle()
    if (used) {
      console.warn('[orders.confirm] tx already used', { ...logBase, conflictingOrderId: used.id })
      return { statusCode: 409, body: { error: 'tx already used' } }
    }

    const type = orderType
    if (type === 'rename') {
      return applyRenameOrder({
        supa,
        chain,
        order,
        orderId,
        txHash,
        addressCased,
        addressCanonical,
        log: logBase,
      })
    }

    if (type === 'prop_name') {
      return applyPropNameOrder({
        supa,
        order,
        orderId,
        txHash,
        addressCased,
        log: logBase,
      })
    }

    if (type === 'reward_topup') {
      return applyRewardTopupOrder({
        supa,
        chain,
        order,
        orderId,
        txHash,
        addressCased,
        addressCanonical,
        log: logBase,
      })
    }

    if (type === 'care') {
      return confirmCareOrder({ supa, order, orderId, txHash, log: logBase })
    }

    if (type === 'care_bundle') {
      return confirmUnsupportedBundle(logBase)
    }

    return confirmGenericOrder({
      supa,
      order,
      orderId,
      txHash,
      log: logBase,
    })
  } catch (e: any) {
    console.error('[orders.confirm] unexpected error', {
      orderId,
      txHash,
      chainKind,
      error: e?.message || String(e),
    })
    return { statusCode: 500, body: { error: e?.message || 'confirm failed' } }
  }
}

export const __ordersConfirmationTestables = {
  serializeOrder,
}

function isTreasuryContext(
  value: TreasuryContext | ConfirmOrderResult,
): value is TreasuryContext {
  return (
    value != null &&
    typeof (value as any).tokenAddress === 'string' &&
    Array.isArray((value as any).recipients)
  )
}
