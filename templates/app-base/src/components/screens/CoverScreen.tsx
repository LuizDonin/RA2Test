import React, { useEffect } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { initializeGlobal } from '../../utils/globalInit'
import { playClickSound } from '../../utils/soundUtils'
import '../../styles/cover-screen.css'

interface CoverScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

export const CoverScreen: React.FC<CoverScreenProps> = ({
  onNavigate,
  backgroundImage
}) => {
  // Inicializar A-Frame quando a tela montar
  useEffect(() => {
    console.log('🎬 CoverScreen montada - inicializando A-Frame...')
    initializeGlobal()
      .then(() => {
        console.log('✅ A-Frame inicializado na CoverScreen')
      })
      .catch((error) => {
        console.error('❌ Erro ao inicializar A-Frame na CoverScreen:', error)
      })
  }, [])

  // Get base URL from vite config or use current location
  const getBaseUrl = () => {
    const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
    const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
    return b === '/' ? '' : b.endsWith('/') ? b.slice(0, -1) : b
  }

  const baseUrl = getBaseUrl()
  // Garantir que o caminho comece com / se baseUrl estiver vazio
  const normalizePath = (path: string) => {
    if (baseUrl === '') {
      return path.startsWith('/') ? path : `/${path}`
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${baseUrl}/${cleanPath}`
  }

  const bgImage = backgroundImage || normalizePath('assets/images/bg-capa.png')
  const headerImage = normalizePath('assets/images/header-capa.png')
  const bottomImage = normalizePath('assets/images/bottom-capa.png')
  const btnJogarImage = normalizePath('assets/images/btn-jogar.png')

  return (
    <>
      <LandscapeBlocker />
      <div
        className="cover-screen"
        style={{
          backgroundImage: `url("${bgImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Header Image */}
      <div className="cover-header-image">
        <img
          src={headerImage}
          alt="Header"
          className="cover-header-img"
        />
      </div>

      {/* Button - Começar Tutorial */}
      <div className="cover-content">
        <button
          className="cover-button-jogar"
          onClick={() => {
            playClickSound()
            onNavigate('tutorial', 'zoom-out', 'right')
          }}
          style={{
            backgroundImage: `url(${btnJogarImage})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        />
      </div>

      {/* Bottom Image */}
      <div className="cover-bottom-image">
        <img
          src={bottomImage}
          alt="Bottom"
          className="cover-bottom-img"
        />
      </div>
    </div>
    </>
  )
}
