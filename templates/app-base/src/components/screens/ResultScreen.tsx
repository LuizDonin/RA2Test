import React from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { playClickSound } from '../../utils/soundUtils'
import '../../styles/tutorial-screen.css'

interface ResultScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  onNavigate
}) => {
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

  const bgImage = normalizePath('assets/images/bg.png')
  const finalPanelImage = normalizePath('assets/images/final-panel.png')
  const restartBtnImage = normalizePath('assets/images/restart-btn.png')

  const handleRestart = () => {
    playClickSound()
    onNavigate('cover', 'fade', 'left')
  }

  return (
    <>
      <LandscapeBlocker />
      <div
        className="tutorial-screen"
        style={{
          backgroundImage: `url("${bgImage}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        {/* Imagem central do painel final */}
        <div className="tutorial-panel-container">
          <img
            src={finalPanelImage}
            alt="Final Panel"
            className="tutorial-panel-image"
          />
        </div>

        {/* Botão Recomeçar */}
        <div className="tutorial-button-container">
          <button
            className="tutorial-button-comecar"
            onClick={handleRestart}
            style={{
              backgroundImage: `url("${restartBtnImage}")`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>
    </>
  )
}
