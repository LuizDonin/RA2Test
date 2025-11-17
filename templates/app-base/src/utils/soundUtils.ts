/**
 * Utility functions for playing sounds
 */

/**
 * Plays an audio file from the assets/sounds directory
 * @param soundName - Name of the sound file (e.g., 'click.mp3')
 * @param volume - Volume level (0.0 to 1.0), default is 0.7
 */
export const playSound = (soundName: string, volume: number = 0.7): void => {
  try {
    // Get base URL
    const getBaseUrl = () => {
      const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
      const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
      return b === '/' ? '' : b.endsWith('/') ? b.slice(0, -1) : b
    }

    const baseUrl = getBaseUrl()
    const normalizePath = (path: string) => {
      if (baseUrl === '') {
        return path.startsWith('/') ? path : `/${path}`
      }
      const cleanPath = path.startsWith('/') ? path.slice(1) : path
      return `${baseUrl}/${cleanPath}`
    }

    const soundPath = normalizePath(`assets/sounds/${soundName}`)
    const audio = new Audio(soundPath)
    audio.volume = Math.max(0, Math.min(1, volume))
    audio.play().catch((error) => {
      console.warn(`Failed to play sound ${soundName}:`, error)
    })
  } catch (error) {
    console.warn(`Error creating audio for ${soundName}:`, error)
  }
}

/**
 * Plays the click sound
 */
export const playClickSound = (): void => {
  playSound('click.mp3', 0.7)
}

/**
 * Plays the error sound
 */
export const playErrorSound = (): void => {
  playSound('erro.mp3', 0.7)
}

/**
 * Plays the success/correct answer sound
 */
export const playSuccessSound = (): void => {
  playSound('acerto.mp3', 0.7)
}

export const playPhotoSound = (): void => {
  playSound('camera.mp3', 0.7)
}
