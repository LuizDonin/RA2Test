import React, { useEffect } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { initializeGlobal } from '../../utils/globalInit'
import '../../styles/tutorial-screen.css'

interface TutorialScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

export const TutorialScreen: React.FC<TutorialScreenProps> = ({
  onNavigate
}) => {
  // Inicializar A-Frame quando a tela montar (caso não tenha sido inicializado na CoverScreen)
  useEffect(() => {
    console.log('🎬 TutorialScreen montada - verificando A-Frame...')
    // Verificar se já foi inicializado
    const scene = document.querySelector('a-scene')
    if (!scene) {
      console.log('🎬 A-Frame não encontrado - inicializando...')
      initializeGlobal()
        .then(() => {
          console.log('✅ A-Frame inicializado na TutorialScreen')
        })
        .catch((error) => {
          console.error('❌ Erro ao inicializar A-Frame na TutorialScreen:', error)
        })
    } else {
      console.log('✅ A-Frame já estava inicializado')
    }
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

  const bgImage = normalizePath('assets/images/bg-capa.png')
  const tutorialPanelImage = normalizePath('assets/images/tutorial-panel.png')
  const btnComecarImage = normalizePath('assets/images/btn-comecar.png')

  return (
    <div
      className="tutorial-screen"
      style={{
        backgroundImage: `url("${bgImage}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Imagem central do tutorial */}
      <div className="tutorial-panel-container">
        <img
          src={tutorialPanelImage}
          alt="Tutorial Panel"
          className="tutorial-panel-image"
        />
      </div>

      {/* Botão Começar RA */}
      <div className="tutorial-button-container">
        <button
          className="tutorial-button-comecar"
          onClick={() => onNavigate('ar', 'fade', 'right')}
          style={{
            backgroundImage: `url("${btnComecarImage}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center'
          }}
        />
      </div>
    </div>
  )
}
