import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

interface ARSceneAFrameProps {
  className?: string
  onSceneReady?: () => void
}

export interface ARSceneAFrameRef {
  addEntity: (data: any) => string
  removeEntity: (id: string) => void
  getScene: () => any
  captureScreenshot: () => string
  setCameraFacing: (facing: 'environment' | 'user') => void
}

// Contador global para garantir IDs únicos
let entityIdCounter = 0

export const ARSceneAFrame = forwardRef<ARSceneAFrameRef, ARSceneAFrameProps>(({
  className = '',
  onSceneReady
}, ref) => {
  const sceneRef = useRef<any>(null)
  const [sceneReady, setSceneReady] = useState(false)

  useEffect(() => {
    // A-Frame Scene já foi criado no globalInit.ts - apenas verificar se existe
    const checkScene = () => {
      const sceneEl = document.querySelector('a-scene#ar-scene-main')
      if (sceneEl) {
        sceneRef.current = sceneEl
        setSceneReady(true)
        if (onSceneReady) {
          onSceneReady()
        }

        requestAnimationFrame(() => {
          const vrButton = document.querySelector('.a-enter-vr-button') as HTMLElement | null
          if (vrButton) {
            vrButton.style.display = 'none'
            vrButton.style.visibility = 'hidden'
          }
        })
      } else {
        // Se não estiver pronto, tentar novamente
        setTimeout(checkScene, 100)
      }
    }

    checkScene()
  }, [onSceneReady])

  useImperativeHandle(ref, () => ({
    addEntity: (data: any) => {
      const sceneEl = sceneRef.current || document.querySelector('a-scene#ar-scene-main')
      if (sceneEl) {
        const entity = document.createElement('a-entity')
        Object.keys(data).forEach(key => {
          entity.setAttribute(key, typeof data[key] === 'object' ? Object.entries(data[key]).map(([k, v]) => `${k}: ${v}`).join('; ') : data[key])
        })
        // Usar contador + timestamp + número aleatório para garantir unicidade
        entityIdCounter++
        const uniqueId = `entity-${Date.now()}-${entityIdCounter}-${Math.random().toString(36).substr(2, 9)}`
        entity.id = uniqueId
        sceneEl.appendChild(entity)
        return entity.id
      }
      return ''
    },
    removeEntity: (id: string) => {
      const entity = document.getElementById(id)
      if (entity) {
        entity.remove()
      }
    },
    getScene: () => {
      return sceneRef.current || document.querySelector('a-scene#ar-scene-main')
    },
    captureScreenshot: () => {
      const sceneEl = sceneRef.current || document.querySelector('a-scene#ar-scene-main')
      if (sceneEl) {
        const renderer = (sceneEl as any).renderer
        if (renderer && renderer.domElement) {
          return renderer.domElement.toDataURL('image/png')
        }
      }
      return ''
    },
    setCameraFacing: (facing: 'environment' | 'user') => {
      // A câmera é gerenciada pelo globalInit, apenas aceitar a mudança
      console.log('Camera facing changed to:', facing)
    }
  }), [])

  return (
    <div className={`ar-scene-aframe ${className}`} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
      {/* A-Frame Scene já foi criado no globalInit.ts - apenas verificar se existe */}
      {sceneReady && document.querySelector('a-scene#ar-scene-main') ? (
        <div style={{ width: '100%', height: '100%' }}>
          {/* A-Frame Scene já está no DOM, renderizado pelo globalInit */}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#fff'
        }}>
          Aguardando A-Frame...
        </div>
      )}
    </div>
  )
})

ARSceneAFrame.displayName = 'ARSceneAFrame'
