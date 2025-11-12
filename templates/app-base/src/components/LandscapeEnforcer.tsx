import React, { useState, useEffect } from 'react'

interface LandscapeEnforcerProps {
  enabled?: boolean
}

export const LandscapeEnforcer: React.FC<LandscapeEnforcerProps> = ({ enabled = true }) => {
  const [isPortrait, setIsPortrait] = useState(false)

  const checkOrientation = () => {
    if (!enabled) {
      setIsPortrait(false)
      return
    }

    const width = window.innerWidth
    const height = window.innerHeight
    const isCurrentlyPortrait = height > width
    
    setIsPortrait(isCurrentlyPortrait)

    // Aplicar classe CSS ao body quando em portrait
    if (isCurrentlyPortrait) {
      document.body.classList.add('force-landscape-mode')
    } else {
      document.body.classList.remove('force-landscape-mode')
    }
  }

  useEffect(() => {
    if (!enabled) {
      document.body.classList.remove('force-landscape-mode')
      return
    }

    // Verificar orientação inicial
    checkOrientation()

    // Adicionar listeners com debounce
    let resizeTimeout: NodeJS.Timeout
    let orientationTimeout: NodeJS.Timeout

    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        checkOrientation()
      }, 100)
    }

    const handleOrientationChange = () => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 300)
    }

    const handleScreenOrientationChange = () => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 300)
    }

    const handleMediaQueryChange = (e: MediaQueryListEvent) => {
      clearTimeout(orientationTimeout)
      orientationTimeout = setTimeout(() => {
        checkOrientation()
      }, 100)
    }

    // Listeners
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleOrientationChange)
    
    if (window.screen && window.screen.orientation) {
      window.screen.orientation.addEventListener('change', handleScreenOrientationChange)
    }
    
    const mediaQuery = window.matchMedia('(orientation: portrait)')
    mediaQuery.addEventListener('change', handleMediaQueryChange)

    // Verificar periodicamente
    const intervalCheck = setInterval(() => {
      checkOrientation()
    }, 2000)

    return () => {
      clearTimeout(resizeTimeout)
      clearTimeout(orientationTimeout)
      clearInterval(intervalCheck)
      
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleOrientationChange)
      if (window.screen && window.screen.orientation) {
        window.screen.orientation.removeEventListener('change', handleScreenOrientationChange)
      }
      mediaQuery.removeEventListener('change', handleMediaQueryChange)
      
      // Limpar classe ao desmontar
      document.body.classList.remove('force-landscape-mode')
    }
  }, [enabled])

  // Só renderizar o overlay quando em portrait
  if (!enabled || !isPortrait) return null

  return (
    <div 
      className="landscape-enforcer"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999999,
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'center',
        padding: '20px',
        boxSizing: 'border-box',
        pointerEvents: 'auto'
      }}
    >
      {/* Ícone de rotação */}
      <div 
        style={{
          width: '80px',
          height: '80px',
          marginBottom: '20px',
          fontSize: '60px',
          animation: 'rotate-landscape 2s ease-in-out infinite'
        }}
      >
        📱
      </div>
      
      {/* Texto informativo */}
      <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>
        Gire seu dispositivo
      </h2>
      
      <p style={{ margin: '0', fontSize: '16px', opacity: 0.9 }}>
        Para uma melhor experiência de Realidade Aumentada, 
        mantenha seu dispositivo na orientação paisagem (horizontal).
      </p>
      
      {/* CSS para animação */}
      <style>
        {`
          @keyframes rotate-landscape {
            0%, 100% { transform: rotate(90deg); }
            50% { transform: rotate(0deg); }
          }
        `}
      </style>
    </div>
  )
}

