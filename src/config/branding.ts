/**
 * Branding Configuration
 * Centralizes logo and welcome art assets for client surfaces.
 */

interface BrandingConfig {
  logoGraphicUrl: string
  logoTextUrl: string
  welcomeArtUrl: string
  fallbackLogoUrl: string
}

function trim(value?: string | null): string {
  return (value || '').trim()
}

const FALLBACK_LOGO = '/branding/bloblets-mascot-logo.png'

export const brandingConfig: BrandingConfig = {
  logoGraphicUrl: trim(process.env.NEXT_PUBLIC_LOGO_GRAPHIC_URL) || FALLBACK_LOGO,
  logoTextUrl: trim(process.env.NEXT_PUBLIC_LOGO_TEXT_URL) || FALLBACK_LOGO,
  welcomeArtUrl: trim(process.env.NEXT_PUBLIC_WELCOME_ART_URL),
  fallbackLogoUrl: FALLBACK_LOGO,
}
