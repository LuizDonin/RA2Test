import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { FaceTracker } from '../FaceTracker'
import { ARSceneAFrame } from '../ARSceneAFrame'
import { LandscapeEnforcer } from '../LandscapeEnforcer'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import '../../styles/ar-screen.css'

interface ARScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

const PELICANO_INITIAL_POSITION = { x: 0, y: 1.6, z: -3 }

export const ARScreen: React.FC<ARScreenProps> = ({
  onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarAFrame = config.usarAFrame !== false
  const usarVideo = config.usarVideo !== false
  const usarFaceTracking = config.usarFaceTracking !== false

  const [arLoading, setArLoading] = useState(true)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const pelicanoKeysRef = useRef<Record<string, boolean>>({})
  const pelicanoMoveAnimationRef = useRef<number | null>(null)
  const pelicanoPositionRef = useRef<{ x: number, y: number, z: number }>({ ...PELICANO_INITIAL_POSITION })
  const pelicanoHandlersRef = useRef<{
    handleKeyDown: ((e: KeyboardEvent) => void) | null
    handleKeyUp: ((e: KeyboardEvent) => void) | null
  }>({ handleKeyDown: null, handleKeyUp: null })

  useEffect(() => {
    if (!usarVideo) {
      setArLoading(false)
      return
    }

    async function setupCamera() {
      try {
        const video = document.getElementById('arjs-video') as HTMLVideoElement
        if (!video || !video.srcObject) {
          console.warn('Vídeo global não encontrado, aguardando...')
          await new Promise(resolve => setTimeout(resolve, 1000))
          const retryVideo = document.getElementById('arjs-video') as HTMLVideoElement
          if (!retryVideo || !retryVideo.srcObject) {
            console.error('Vídeo ainda não disponível')
            setArLoading(false)
            return
          }
        }

        const videoElement = video || (document.getElementById('arjs-video') as HTMLVideoElement)
        if (videoElement && videoElement.srcObject) {
          videoElement.classList.add('ar-video-visible')
          videoRef.current = videoElement
          mediaStreamRef.current = videoElement.srcObject as MediaStream

          setArLoading(false)
        } else {
          console.error('Vídeo não tem stream')
          setArLoading(false)
        }
      } catch (err) {
        console.error('Erro ao configurar câmera:', err)
        setArLoading(false)
      }
    }

    setupCamera()

    return () => {
      // Não limpar aqui - deixar o vídeo para o FaceTracker
    }
  }, [usarVideo])

  const getBaseUrl = () => {
    const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
    const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
    return b === '/' ? '' : b.endsWith('/') ? b.slice(0, -1) : b
  }

  const baseUrl = useMemo(() => getBaseUrl(), [])
  const normalizePath = useCallback((path: string) => {
    if (baseUrl === '') {
      return path.startsWith('/') ? path : `/${path}`
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${baseUrl}/${cleanPath}`
  }, [baseUrl])

  // Adiciona imagem dos binóculos nos assets apenas (não mais na cena 3D)
  useEffect(() => {
    if (!usarAFrame) return

    const sceneEl = document.querySelector('a-scene#ar-scene-main') as any
    if (!sceneEl) {
      console.warn('A-Frame Scene não encontrado')
      return
    }

    // Adicionar câmera
    let camera = document.getElementById('camera')
    if (!camera) {
      camera = document.createElement('a-entity')
      camera.id = 'camera'
      camera.setAttribute('camera', 'active: true')
      camera.setAttribute('look-controls', 'enabled: true; reverseMouseDrag: false; touchEnabled: true; magicWindowTrackingEnabled: true; pointerLockEnabled: false; touchSensitivity: 1; mouseSensitivity: 1')
      camera.setAttribute('wasd-controls', 'enabled: false')
      camera.setAttribute('position', '0 1.6 0')
      sceneEl.appendChild(camera)
    }

    // Adicionar luzes
    let ambientLight = sceneEl.querySelector('#ambient-light')
    if (!ambientLight) {
      ambientLight = document.createElement('a-entity')
      ambientLight.id = 'ambient-light'
      ambientLight.setAttribute('light', 'type: ambient; color: #888')
      sceneEl.appendChild(ambientLight)
    }

    let directionalLight = sceneEl.querySelector('#directional-light')
    if (!directionalLight) {
      directionalLight = document.createElement('a-entity')
      directionalLight.id = 'directional-light'
      directionalLight.setAttribute('light', 'type: directional; color: #fff; intensity: 0.6')
      directionalLight.setAttribute('position', '1 1 1')
      sceneEl.appendChild(directionalLight)
    }

    // Adicionar head-cube (seguir rotação da cabeça)
    let headCube = document.getElementById('head-cube')
    if (!headCube) {
      headCube = document.createElement('a-entity')
      headCube.id = 'head-cube'
      headCube.setAttribute('geometry', 'primitive: box; width: 0.3; height: 0.3; depth: 0.3')
      headCube.setAttribute('material', 'color: #FF6B6B; opacity: 0; transparent: true')
      headCube.setAttribute('position', '0 1 -1.2')
      headCube.setAttribute('rotation', '0 0 0')
      sceneEl.appendChild(headCube)
    }

    // Adicionar assets caso não existam
    let assets = sceneEl.querySelector('a-assets')
    if (!assets) {
      assets = document.createElement('a-assets')
      sceneEl.appendChild(assets)
    }

    // Pelicano (mantido)
    let pelicanoImg = assets.querySelector('#pelicanoTexture')
    if (!pelicanoImg) {
      pelicanoImg = document.createElement('img')
      pelicanoImg.id = 'pelicanoTexture'
      pelicanoImg.src = normalizePath('assets/images/pelicano.png')
      pelicanoImg.setAttribute('crossorigin', 'anonymous')
      assets.appendChild(pelicanoImg)
    }

    // Binóculos asset (mantido apenas para referência; imagem real será na tela, não mais como a-image)
    let binoculosImg = assets.querySelector('#binoculosTexture')
    if (!binoculosImg) {
      binoculosImg = document.createElement('img')
      binoculosImg.id = 'binoculosTexture'
      binoculosImg.src = normalizePath('assets/images/binoculos.png')
      binoculosImg.setAttribute('crossorigin', 'anonymous')
      assets.appendChild(binoculosImg)
    }

    // Pelicano entity
    let pelicano = document.getElementById('pelicano-entity')
    if (!pelicano) {
      pelicano = document.createElement('a-image')
      pelicano.id = 'pelicano-entity'
      pelicano.setAttribute('src', '#pelicanoTexture')
      pelicano.setAttribute('width', '0.8')
      pelicano.setAttribute('height', '0.8')
      pelicano.setAttribute('position', `${PELICANO_INITIAL_POSITION.x} ${PELICANO_INITIAL_POSITION.y} ${PELICANO_INITIAL_POSITION.z}`)
      pelicano.setAttribute('look-at', '[camera]')
      sceneEl.appendChild(pelicano)
      pelicanoPositionRef.current = { ...PELICANO_INITIAL_POSITION }
    } else {
      let position = pelicano.getAttribute('position')
      if (position && typeof position === 'string') {
        const [x, y, z] = position.split(' ').map(Number)
        pelicanoPositionRef.current = {
          x: typeof x === 'number' && !isNaN(x) ? x : PELICANO_INITIAL_POSITION.x,
          y: typeof y === 'number' && !isNaN(y) ? y : PELICANO_INITIAL_POSITION.y,
          z: typeof z === 'number' && !isNaN(z) ? z : PELICANO_INITIAL_POSITION.z
        }
      } else {
        pelicanoPositionRef.current = { ...PELICANO_INITIAL_POSITION }
        pelicano.setAttribute('position', `${PELICANO_INITIAL_POSITION.x} ${PELICANO_INITIAL_POSITION.y} ${PELICANO_INITIAL_POSITION.z}`)
      }
    }

    // REMOVE binoculos-entity (não mais na cena 3D)
    const binoculosOld = document.getElementById('binoculos-entity')
    if (binoculosOld) {
      binoculosOld.remove()
    }

    const moveSpeed = 0.1
    let pelicanoWasCentered = false

    const handleKeyDown = (e: KeyboardEvent) => {
      // Adiciona suporte para movimentação vertical com PgUp/PgDown
      let key = e.key
      if (key === 'PageUp' || key === 'PageDown') {
        pelicanoKeysRef.current[key] = true
      } else {
        pelicanoKeysRef.current[key.toLowerCase()] = true
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      // Adiciona suporte para movimentação vertical com PgUp/PgDown
      let key = e.key
      if (key === 'PageUp' || key === 'PageDown') {
        pelicanoKeysRef.current[key] = false
      } else {
        pelicanoKeysRef.current[key.toLowerCase()] = false
      }
    }

    pelicanoHandlersRef.current.handleKeyDown = handleKeyDown
    pelicanoHandlersRef.current.handleKeyUp = handleKeyUp

    const movePelicano = () => {
      const pelicanoEl = document.getElementById('pelicano-entity')
      if (!pelicanoEl) {
        pelicanoMoveAnimationRef.current = null
        return
      }

      let pos = pelicanoPositionRef.current
      let newX = pos.x
      let newY = pos.y
      let newZ = pos.z

      let moved = false
      if (pelicanoKeysRef.current['w']) {
        newZ += moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['s']) {
        newZ -= moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['a']) {
        newX -= moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['d']) {
        newX += moveSpeed
        moved = true
      }
      // Movimento vertical usando PageUp/PageDown
      if (pelicanoKeysRef.current['PageUp']) {
        newY += moveSpeed
        moved = true
      }
      if (pelicanoKeysRef.current['PageDown']) {
        newY -= moveSpeed
        moved = true
      }

      const minX = -3, maxX = 3
      const minY = 0, maxY = 4
      const minZ = -6, maxZ = 0
      newX = Math.max(minX, Math.min(maxX, newX))
      newY = Math.max(minY, Math.min(maxY, newY))
      newZ = Math.max(minZ, Math.min(maxZ, newZ))

      if (moved) {
        pelicanoPositionRef.current = { x: newX, y: newY, z: newZ }
        pelicanoEl.setAttribute('position', `${newX} ${newY} ${newZ}`)
      }

      const CENTER_THRESHOLD = 0.15;
      const atCenter =
        Math.abs(pelicanoPositionRef.current.x) < CENTER_THRESHOLD &&
        Math.abs(pelicanoPositionRef.current.y - 1.6) < CENTER_THRESHOLD;

      if (atCenter && !pelicanoWasCentered) {
        pelicanoWasCentered = true
        console.log("[DEBUG] O pelicano está no centro da cena 3D!");
      } else if (!atCenter && pelicanoWasCentered) {
        pelicanoWasCentered = false
      }

      pelicanoMoveAnimationRef.current = requestAnimationFrame(movePelicano)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    movePelicano()

    return () => {
      if (pelicanoMoveAnimationRef.current !== null) {
        cancelAnimationFrame(pelicanoMoveAnimationRef.current)
        pelicanoMoveAnimationRef.current = null
      }

      if (pelicanoHandlersRef.current.handleKeyDown) {
        window.removeEventListener('keydown', pelicanoHandlersRef.current.handleKeyDown)
      }
      if (pelicanoHandlersRef.current.handleKeyUp) {
        window.removeEventListener('keyup', pelicanoHandlersRef.current.handleKeyUp)
      }

      pelicanoKeysRef.current = {}
      pelicanoHandlersRef.current = { handleKeyDown: null, handleKeyUp: null }

      const cube = document.getElementById('head-cube')
      if (cube) {
        cube.remove()
      }
      const pelicanoEl = document.getElementById('pelicano-entity')
      if (pelicanoEl) {
        pelicanoEl.remove()
      }
      // Não remover binoculos-entity, já não existe na cena
      const cameraEl = document.getElementById('camera')
      if (cameraEl) {
        cameraEl.remove()
      }
      const ambientLightEl = sceneEl.querySelector('#ambient-light')
      if (ambientLightEl) {
        ambientLightEl.remove()
      }
      const directionalLightEl = sceneEl.querySelector('#directional-light')
      if (directionalLightEl) {
        directionalLightEl.remove()
      }
      const assetsEl = sceneEl.querySelector('a-assets')
      if (assetsEl) {
        assetsEl.remove()
      }
    }
  }, [usarAFrame, normalizePath]) // Adiciona dependência de normalizePath para atualizar corretamente

  // Caminho para imagem dos binóculos para uso na tela
  const binoculosImgPath = useMemo(() => normalizePath('assets/images/binoculos.png'), [normalizePath])

  return (
    <div className="ar-game-screen">
      {/* Landscape Enforcer - força orientação landscape */}
      <LandscapeEnforcer enabled={true} />
      
      {/* Loading overlay */}
      {arLoading && (
        <div className="ar-loading-overlay">
          <div className="ar-loading-content">
            <div className="ar-loading-spinner"></div>
            <p className="ar-loading-text">Preparando AR...</p>
          </div>
        </div>
      )}

      {/* A-Frame Scene (se habilitado) */}
      {usarAFrame && (
        <ARSceneAFrame />
      )}

      {/* Binóculos na tela, centralizado, sem escala, com tamanho nativo */}
      {/* Só mostra quando a cena AR estiver pronta, para evitar efeito de sobreposição no loading */}
      {usarAFrame && !arLoading && (
        <img
          src={binoculosImgPath}
          alt="Binóculos"
          className="ar-binoculos-overlay"
          style={{
            position: 'absolute',
            transform: 'rotateZ(-90deg)',
            pointerEvents: 'none',
            zIndex: 99999,
            maxWidth: 'none',
            maxHeight: 'none',
            width: 'auto',
            height: 'auto',
            // Não impõe altura/largura, será do tamanho natural
            // O overlay é feito por CSS absoluto sobre o canvas da cena
          }}
          draggable={false}
        />
      )}

      {/* Face Tracker (se habilitado) */}
      {usarFaceTracking && (
        <FaceTracker enabled={true} />
      )}
    </div>
  )
}
