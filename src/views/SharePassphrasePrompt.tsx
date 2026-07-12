import { ShareRedeemView } from '@/views/ShareRedeemView'

interface SharePassphrasePromptProps {
  payload: string
}

/**
 * SharePassphrasePrompt — Route handler for share links (#/share/{payload}).
 * Delegates to ShareRedeemView which handles parsing, expiry check,
 * passphrase prompting, decryption, and navigation.
 *
 * Requirements: 6.5, 6.7, 6.9
 */
export function SharePassphrasePrompt({ payload }: SharePassphrasePromptProps) {
  return <ShareRedeemView payload={payload} />
}
