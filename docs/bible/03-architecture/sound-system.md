# Sound System Architecture

> **Goal:** Provide immersive, thematic audio feedback (UI & Ambience) using high-quality AI-generated assets hosted on Cloudflare R2.

## 1. Architecture Overview

The sound system is built on three pillars:
1.  **Assets:** MP3 files generated via ElevenLabs (Kie.ai) and hosted on Cloudflare R2 (`sfx/` folder).
2.  **Configuration:** A centralized manifest in `src/config/sounds.ts` mapping semantic keys to R2 URLs.
3.  **Consumption:** A global `useSound` hook in `src/hooks/useSound.ts` that manages playback, preloading, and user preferences (mute).

## 2. Configuration (`src/config/sounds.ts`)

The single source of truth for audio assets.

```typescript
export const SOUND_ASSETS = {
  ui_hover: "https://.../sfx/ui_hover.mp3",
  ui_select: "https://.../sfx/ui_select.mp3",
  // ...
  bg_ambience: "https://.../sfx/bg_ambience.mp3" // Looping background
} as const
```

## 3. Usage in Components

### Basic SFX (UI Interaction)
Use the `useSound` hook to play one-shot effects.

```tsx
import { useSound } from '@/src/hooks/useSound'

export function MyButton() {
  const { play } = useSound()
  
  return (
    <button 
      onMouseEnter={() => play('ui_hover', 0.2)} // Low volume for hover
      onClick={() => play('ui_select')}
    >
      Click Me
    </button>
  )
}
```

### Background Ambience (Loop)
For continuous background audio (like `bg_ambience`), the hook handles looping automatically if the key is recognized as a loop.

*Note: Browsers block autoplay. You must trigger the start of the loop on a user interaction (e.g., the first click on the page).*

```tsx
// Example: Starting ambience in the main layout
useEffect(() => {
  const startAmbience = () => {
    play('bg_ambience', 0.3)
    document.removeEventListener('click', startAmbience)
  }
  document.addEventListener('click', startAmbience)
}, [play])
```

## 4. Asset Generation Pipeline

We use a custom script `scripts/sound/generate_sfx.mjs` to generate consistent, high-quality assets using the **ElevenLabs Sound Effect V2** model (via Kie.ai).

### How to Generate New Sounds
1.  Open `scripts/sound/generate_sfx.mjs`.
2.  Add a new entry to the `SOUND_MANIFEST` array:
    ```javascript
    {
      id: 'new_sound_id',
      filename: 'sfx/new_sound.mp3',
      duration: 1.5, // Seconds
      prompt: 'Descriptive prompt matching the Bloblet personality...'
    }
    ```
3.  Run the script:
    ```bash
    node scripts/sound/generate_sfx.mjs
    ```
4.  The script will:
    *   Call the AI API.
    *   Download the result.
    *   Upload it to Cloudflare R2.
    *   Print the final public URL.
5.  Copy the URL into `src/config/sounds.ts`.

### "Director's Cut" Prompt Strategy
To ensure the game sounds thematic and not generic/cheap, use these guidelines for prompts:

*   **Keywords:** `Cute`, `Organic`, `Liquid`, `Glass`, `Chime`, `Soft`, `Ethereal`, `Whimsical`.
*   **Avoid:** `8-bit`, `Retro`, `Arcade`, `Laser`, `Explosion` (unless modified by "soft" or "magical"), `Mechanical`.
*   **Tone:** The sound should feel like touching a living, digital creature, not a machine.

**Example Prompts:**
*   *Bad:* "8-bit select sound."
*   *Good:* "A cheerful water droplet 'bloop' mixed with a crystal chime. High-pitched, happy, and liquid."

## 5. Global Mute
The `useSound` hook persists the user's mute preference in `localStorage` (`bloblets_sound_muted`). Toggling mute updates all active components immediately via a listener pattern.
