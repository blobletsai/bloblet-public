export function getUserFriendlyError(error: string | undefined, status?: number): string {
  if (!error) return status ? `Request failed (${status})` : 'Request failed'

  const errorMap: Record<string, string> = {
    'unauthorized': 'Please verify your wallet first',
    'holder required': 'Must hold tokens to perform this action',
    'rate limited': 'Too many requests. Please wait a moment',
    'address mismatch': 'Wallet address mismatch. Please reconnect',
    'Invalid name': 'Please enter a valid name (1-32 characters)',
    'Invalid propId': 'Invalid property selected',
    'Invalid characters': 'Name contains invalid characters',
    'Missing prompt': 'Please enter a description for your avatar',
    'Invalid action': 'Invalid care action selected',
    'wrong_step': 'Action out of sequence',
    'care_cooldown': 'Care action still running',
    'not found': 'Item not found',
    'already exists': 'This name is already taken',
    'insufficient balance': 'Insufficient token balance',
    'order expired': 'Order expired. Please try again',
    'payment required': 'Payment required to proceed',
    'preview not ready': 'Preview is still generating. Please wait',
    'generation failed': 'Generation failed. Please try again'
  }

  // Check for exact match first
  if (errorMap[error]) return errorMap[error]

  // Check if error contains any known phrases
  for (const [key, value] of Object.entries(errorMap)) {
    if (error.toLowerCase().includes(key)) return value
  }

  // Return original error if no match found, but capitalize first letter
  return error.charAt(0).toUpperCase() + error.slice(1)
}
