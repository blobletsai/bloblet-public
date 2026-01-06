export const VISUAL_THEME = {
  colors: {
    // Text
    textPrimary: '#ffffff',
    textDark: '#140314',
    
    // Backgrounds
    pillBg: 'rgba(0,0,0,0.8)',
    pillBgLight: 'rgba(0,0,0,0.6)',
    pillBgHighlight: 'rgba(0,0,0,0.75)',
    pillBgSelected: 'rgba(255,157,225,0.25)',
    pillBgScout: 'rgba(16,6,40,0.82)',
    
    // Identity / Rings
    selfRing: '#7dd3fc',
    selfRingPulse: 'rgba(125, 211, 252, 0.75)',
    selfRingBg: '#e0f2fe',
    
    opponentRing: '#ff9de1',
    opponentRingPulse: 'rgba(255, 157, 225, 0.75)',
    opponentRingBg: 'rgba(255,157,225,0.45)',

    scoutReticle: 'rgba(255, 255, 255, 0.9)'
  },
  typography: {
    // Fonts
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Inter, Arial',
    
    // Sizes
    sizeZoomLabelMin: 13,
    sizeZoomLabelMax: 16,
    sizeHighlight: 13,
    sizeScout: 13,
    
    // Weights
    weightBold: '600',
    weightNormal: '400'
  },
  layout: {
    labelPadX: 8,
    labelPadY: 5,
    pillRadius: 6
  },
  animation: {
    fadeInSpeed: 0.08,  // Alpha increment per frame
    fadeOutSpeed: 0.12  // Alpha decrement per frame
  }
}
