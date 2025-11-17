import React, { useEffect, useState } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { initializeGlobal, requestDeviceOrientationPermission } from '../../utils/globalInit'
import { playClickSound } from '../../utils/soundUtils'
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
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [showBlackScreen, setShowBlackScreen] = useState(false)

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

  // Função para lidar com a navegação para ARScreen, solicitando permissão primeiro
  const handleNavigateToAR = async () => {
    if (isRequestingPermission) return

    playClickSound()
    
    // Mostrar tela preta IMEDIATAMENTE antes de qualquer coisa
    setShowBlackScreen(true)
    setIsRequestingPermission(true)
    
    try {
      // Solicitar permissão de orientação do dispositivo antes de navegar
      console.log('Solicitando permissão de orientação do dispositivo...')
      const permission = await requestDeviceOrientationPermission()
      
      if (permission === 'granted' || permission === null) {
        // Permissão concedida ou não necessária - navegar para AR
        console.log('Permissão concedida ou não necessária, navegando para ARScreen')
        onNavigate('ar', 'fade', 'right')
      } else if (permission === 'denied') {
        // Permissão negada - ainda assim navegar, mas avisar o usuário
        console.warn('Permissão de orientação negada, mas navegando mesmo assim')
        onNavigate('ar', 'fade', 'right')
      } else {
        // Prompt ainda pendente - navegar mesmo assim
        console.log('Prompt de permissão pendente, navegando para ARScreen')
        onNavigate('ar', 'fade', 'right')
      }
    } catch (error) {
      console.error('Erro ao solicitar permissão:', error)
      // Em caso de erro, navegar mesmo assim
      onNavigate('ar', 'fade', 'right')
    } finally {
      setIsRequestingPermission(false)
    }
  }

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
  const tutorialPanelImage = normalizePath('assets/images/tutorial-panel.png')
  const btnComecarImage = normalizePath('assets/images/btn-comecar.png')

  return (
    <>
      <LandscapeBlocker />
      {/* Tela preta que aparece imediatamente ao clicar em "Começar" */}
      {showBlackScreen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: '#000000',
            zIndex: 999999999,
            pointerEvents: 'none',
            transition: 'opacity 0.1s ease-out'
          }}
        />
      )}
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
          onClick={handleNavigateToAR}
          disabled={isRequestingPermission}
          style={{
            backgroundImage: `url("${btnComecarImage}")`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            opacity: isRequestingPermission ? 0.7 : 1,
            cursor: isRequestingPermission ? 'wait' : 'pointer'
          }}
        />
      </div>
    </div>
    </>
  )
}
