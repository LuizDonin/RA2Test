import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { playClickSound, playSuccessSound, playErrorSound } from '../../utils/soundUtils'
import { ARSceneAFrame, ARSceneAFrameRef } from '../ARSceneAFrame'
import '../../styles/ar-screen.css'

// --- Aqui começa a parte importante pra depuração dos cliques ---

interface ARScreenProps {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

type AnimalType = 'gato' | 'cachorro' | 'galinha' | 'vaca' | 'porco'

interface AnimalConfig {
  name: AnimalType
  topImage: string
  arImage: string
}

const ANIMALS: AnimalConfig[] = [
  { name: 'gato', topImage: 'gatotop.png', arImage: 'Gato.png' },
  { name: 'cachorro', topImage: 'cachorrotop.png', arImage: 'Cachorro.png' },
  { name: 'galinha', topImage: 'galinhatop.png', arImage: 'Galinha.png' },
  { name: 'vaca', topImage: 'vacatop.png', arImage: 'Vaca.png' },
  { name: 'porco', topImage: 'porcotop.png', arImage: 'Porco.png' }
]

const TOTAL_ROUNDS = 5

const MOVE_STEP = 0.2

// EDIT: z inicial dos animais ficou mais distante (de -2 para -3.5)
const INITIAL_ANIMAL_Z = -6

export const ARScreen: React.FC<ARScreenProps> = ({
  onNavigate: _onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarVideo = config.usarVideo !== false

  const [arLoading, setArLoading] = useState(true)
  const [isFadingIn, setIsFadingIn] = useState(false)
  const [currentRound, setCurrentRound] = useState(0)
  const [sceneReady, setSceneReady] = useState(false)
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalType | null>(null)
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)

  const arSceneRef = useRef<ARSceneAFrameRef>(null)
  const animalEntitiesRef = useRef<{ left: string | null; right: string | null }>({ left: null, right: null })
  const correctEntityIdRef = useRef<string | null>(null)
  const correctEntityPosRef = useRef<{x: number, y: number, z: number}>({x: -1.5, y: 0, z: -10}) // Default fallback
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

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

  // Camera setup igual...

  useEffect(() => {
    if (!usarVideo) {
      setArLoading(false)
      setTimeout(() => {
        setIsFadingIn(true)
      }, 100)
      return
    }

    async function setupCamera() {
      try {
        // Sempre criar nova stream para garantir configuração de retrato
        // Mesmo se já existir vídeo, vamos recriar com as configurações corretas
        const existingVideo = document.getElementById('arjs-video') as HTMLVideoElement
        if (existingVideo && existingVideo.srcObject) {
          // Parar stream existente
          const existingStream = existingVideo.srcObject as MediaStream
          existingStream.getTracks().forEach(track => track.stop())
        }

        // Configuração para retrato: altura maior que largura
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 720 },
            height: { ideal: 1280 },
            facingMode: { ideal: 'environment' }
          },
          audio: false
        })

        // Reutilizar vídeo existente ou criar novo
        let video = existingVideo
        if (!video) {
          video = document.createElement('video')
          video.id = 'arjs-video'
          video.setAttribute('playsinline', '')
          video.setAttribute('autoplay', '')
          video.muted = true
          video.style.position = 'fixed'
          video.style.top = '0'
          video.style.left = '0'
          video.style.width = '100vw'
          video.style.height = '100vh'
          video.style.objectFit = 'cover'
          video.style.zIndex = '0'
          document.body.appendChild(video)
        }

        // Atualizar estilos
        video.style.display = 'block'
        video.style.visibility = 'visible'
        video.style.opacity = '0'
        video.style.transition = 'opacity 0.6s ease-in'

        video.srcObject = stream
        mediaStreamRef.current = stream
        videoRef.current = video

        try {
          await video.play()
        } catch (playErr) {
          // eslint-disable-next-line no-console
          console.warn("[ARScreen] Falha ao chamar video.play():", playErr)
          // Nada a fazer: se for AbortError, o fluxo geralmente segue normal
        }

        setArLoading(false)
        setTimeout(() => {
          setIsFadingIn(true)
          if (video) {
            video.style.opacity = '1'
          }
        }, 100)
      } catch (err) {
        // Se detectar um erro AbortError, explicar o motivo diretamente no console
        if (
          typeof window !== "undefined" &&
          err &&
          (err as any).name === "AbortError"
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            "AbortError detectado ao configurar câmera (provavelmente play() interrompido por troca de srcObject). Veja https://goo.gl/LdLk22. Normalmente não impede o funcionamento do vídeo."
          )
        } else {
          // eslint-disable-next-line no-console
          console.error('Erro ao configurar câmera:', err)
        }
        setArLoading(false)
        setTimeout(() => {
          setIsFadingIn(true)
        }, 100)
      }
    }

    setupCamera()

    return () => {
      if (videoRef.current) {
        videoRef.current.style.display = 'none'
        videoRef.current.style.visibility = 'hidden'
        videoRef.current.style.opacity = '0'
      }
    }
  }, [usarVideo])

  // Limpar animais da cena AR
  const clearAnimals = useCallback(() => {
    if (animalEntitiesRef.current.left && arSceneRef.current) {
      arSceneRef.current.removeEntity(animalEntitiesRef.current.left)
      animalEntitiesRef.current.left = null
    }
    if (animalEntitiesRef.current.right && arSceneRef.current) {
      arSceneRef.current.removeEntity(animalEntitiesRef.current.right)
      animalEntitiesRef.current.right = null
    }
    correctEntityIdRef.current = null
  }, [])

  useEffect(() => {
    if (!sceneReady) return

    const sceneEl = arSceneRef.current?.getScene()
    if (!sceneEl) return

    let camera = sceneEl.querySelector('a-camera')
    if (!camera) {
      camera = document.createElement('a-camera')
      sceneEl.appendChild(camera)
    }

    // Remover cursor visual - vamos usar touch events diretamente
    const existingCursor = camera.querySelector('a-cursor')
    if (existingCursor) {
      existingCursor.remove()
    }

    // Configurar raycaster na câmera para detectar toques
    if (!camera.hasAttribute('raycaster')) {
      camera.setAttribute('raycaster', 'objects: .clickable-animal; far: 100; interval: 0')
    }

    // Adicionar listener de toque na cena usando AFrame raycaster
    const handleTouchStart = (event: TouchEvent) => {
      if (isAnimating) return
      
      const touch = event.touches[0]
      if (!touch) return

      // Converter coordenadas de toque para coordenadas normalizadas (-1 a 1)
      const x = (touch.clientX / window.innerWidth) * 2 - 1
      const y = -(touch.clientY / window.innerHeight) * 2 + 1
      
      // Fazer raycast manualmente usando THREE.js
      const THREE = (window as any).THREE
      if (!THREE) return
      
      const raycasterObj = new THREE.Raycaster()
      const cameraObj = (camera as any).getObject3D('camera')
      if (!cameraObj) return
      
      raycasterObj.setFromCamera(
        new THREE.Vector2(x, y),
        cameraObj
      )

      // Obter todos os objetos clicáveis
      const clickableObjects = sceneEl.querySelectorAll('.clickable-animal')
      const intersections: any[] = []
      
      clickableObjects.forEach((obj: any) => {
        const obj3D = obj.getObject3D('mesh')
        if (obj3D) {
          const intersect = raycasterObj.intersectObject(obj3D, true)
          if (intersect.length > 0) {
            intersections.push({
              object: obj3D,
              el: obj,
              distance: intersect[0].distance
            })
          }
        }
      })

      // Ordenar por distância e pegar o mais próximo
      if (intersections.length > 0) {
        intersections.sort((a, b) => a.distance - b.distance)
        const closest = intersections[0]
        const animalName = closest.el.getAttribute('data-animal') as AnimalType
        
        // eslint-disable-next-line no-console
        console.log('[ARScreen] Touch detectado!', {
          animalName,
          element: closest.el,
          allAttributes: Array.from(closest.el.attributes).map((attr) => ({ 
            name: (attr as Attr).name, 
            value: (attr as Attr).value 
          }))
        })
        
        if (animalName && handleAnimalClickRef.current) {
          // Encontrar qual é o animal correto da rodada atual
          const currentAnimal = currentRound < TOTAL_ROUNDS ? ANIMALS[currentRound] : null
          if (currentAnimal) {
            // eslint-disable-next-line no-console
            console.log('[ARScreen] Comparando:', {
              clicked: animalName,
              expected: currentAnimal.name,
              isCorrect: animalName === currentAnimal.name
            })
            handleAnimalClickRef.current(animalName, currentAnimal.name, event)
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn('[ARScreen] Animal name não encontrado ou handler não disponível', { animalName, hasHandler: !!handleAnimalClickRef.current })
        }
      }
    }

    // Adicionar listener de toque na cena
    sceneEl.addEventListener('touchstart', handleTouchStart as any, { passive: false })
    
    return () => {
      sceneEl.removeEventListener('touchstart', handleTouchStart as any)
    }
  }, [sceneReady, isAnimating, currentRound])

  const handleAnimalClickRef = useRef<((clickedAnimal: AnimalType, correctAnimal: AnimalType, event?: Event) => void) | null>(null)

  // --- SPAWN com logs explícitos e tratamento ---
  const spawnAnimals = useCallback((correctAnimal: AnimalType, wrongAnimal: AnimalType) => {
    if (!arSceneRef.current || !sceneReady) {
      // eslint-disable-next-line no-console
      console.warn('[ARScreen] Não é possível spawnar animais - scene não está pronta')
      return
    }

    clearAnimals()

    const sceneEl = arSceneRef.current.getScene()
    if (!sceneEl) {
      // eslint-disable-next-line no-console
      console.warn('[ARScreen] Scene element não encontrado')
      return
    }

    // Garantir que a cena está visível
    const sceneElement = sceneEl as HTMLElement
    if (sceneElement) {
      sceneElement.style.zIndex = '1'
      sceneElement.style.display = 'block'
      sceneElement.style.visibility = 'visible'
      sceneElement.style.opacity = '1'
    }

    const correctAnimalConfig = ANIMALS.find(a => a.name === correctAnimal)!
    const wrongAnimalConfig = ANIMALS.find(a => a.name === wrongAnimal)!

    const correctOnLeft = Math.random() > 0.5

    const leftAnimal = correctOnLeft ? correctAnimalConfig : wrongAnimalConfig
    const rightAnimal = correctOnLeft ? wrongAnimalConfig : correctAnimalConfig

    // Z mais distante da camera
    const leftPos = { x: -1.5, y: 0, z: INITIAL_ANIMAL_Z }
    const rightPos = { x: 1.5, y: 0, z: INITIAL_ANIMAL_Z }

    const leftEntityId = arSceneRef.current.addEntity({
      geometry: 'primitive: plane',
      material: `src: ${normalizePath(`assets/images/${leftAnimal.arImage}`)}; transparent: true; side: double`,
      position: `${leftPos.x} ${leftPos.y} ${leftPos.z}`,
      scale: '1 1 1',
      'look-at': '[camera]',
      class: 'clickable-animal',
      'data-animal': leftAnimal.name,
      'animation__scale': 'property: scale; to: 1.1 1.1 1.1; dur: 200; startEvents: mouseenter',
      'animation__scaleback': 'property: scale; to: 1 1 1; dur: 200; startEvents: mouseleave'
    })

    const rightEntityId = arSceneRef.current.addEntity({
      geometry: 'primitive: plane',
      material: `src: ${normalizePath(`assets/images/${rightAnimal.arImage}`)}; transparent: true; side: double`,
      position: `${rightPos.x} ${rightPos.y} ${rightPos.z}`,
      scale: '1 1 1',
      'look-at': '[camera]',
      class: 'clickable-animal',
      'data-animal': rightAnimal.name,
      'animation__scale': 'property: scale; to: 1.1 1.1 1.1; dur: 200; startEvents: mouseenter',
      'animation__scaleback': 'property: scale; to: 1 1 1; dur: 200; startEvents: mouseleave'
    })

    animalEntitiesRef.current.left = leftEntityId
    animalEntitiesRef.current.right = rightEntityId

    if (correctOnLeft) {
      correctEntityIdRef.current = leftEntityId
      correctEntityPosRef.current = { ...leftPos }
    } else {
      correctEntityIdRef.current = rightEntityId
      correctEntityPosRef.current = { ...rightPos }
    }

    // Garantir que os atributos data-animal estão corretos e forçar renderização
    setTimeout(() => {
      const leftEntity = document.getElementById(leftEntityId)
      const rightEntity = document.getElementById(rightEntityId)

      if (leftEntity) {
        leftEntity.setAttribute('data-animal', leftAnimal.name)
        // eslint-disable-next-line no-console
        console.log('[ARScreen] Entity LEFT configurado:', leftAnimal.name)
      }

      if (rightEntity) {
        rightEntity.setAttribute('data-animal', rightAnimal.name)
        // eslint-disable-next-line no-console
        console.log('[ARScreen] Entity RIGHT configurado:', rightAnimal.name)
      }

      // Forçar renderização da cena após adicionar entidades
      const scene = sceneEl as any
      if (scene && scene.renderer) {
        // Forçar atualização do renderer
        scene.renderer.setSize(window.innerWidth, window.innerHeight)
        if (scene.camera) {
          scene.renderer.render(scene.object3D, scene.camera)
        }
      }

      // Disparar resize para forçar atualização
      window.dispatchEvent(new Event('resize'))
    }, 200)
  }, [sceneReady, clearAnimals, normalizePath])

  // Handler de clique customizado com log
  const handleAnimalClick = useCallback((clickedAnimal: AnimalType, correctAnimal: AnimalType, event?: Event) => {
    // eslint-disable-next-line no-console
    console.log('[ARScreen] handleAnimalClick acionado!', {clickedAnimal, correctAnimal, event, isAnimating});
    if (isAnimating) return

    setIsAnimating(true)
    playClickSound()

    const isCorrect = clickedAnimal === correctAnimal
    setSelectedAnimal(clickedAnimal)
    setFeedbackType(isCorrect ? 'success' : 'error')

    if (isCorrect) {
      playSuccessSound()
    } else {
      playErrorSound()
    }

    clearAnimals()

    setTimeout(() => {
      setSelectedAnimal(null)
      setFeedbackType(null)
      setIsAnimating(false)
      setCurrentRound(prev => {
        const nextRound = prev + 1
        if (nextRound < TOTAL_ROUNDS) {
          setTimeout(() => {
            const correctAnimal = ANIMALS[nextRound]
            const wrongAnimals = ANIMALS.filter(a => a.name !== correctAnimal.name)
            const randomWrongAnimal = wrongAnimals[Math.floor(Math.random() * wrongAnimals.length)]
            spawnAnimals(correctAnimal.name, randomWrongAnimal.name)
          }, 100)
        }
        return nextRound
      })
    }, 2000)
  }, [isAnimating, clearAnimals, spawnAnimals])

  useEffect(() => {
    handleAnimalClickRef.current = handleAnimalClick
  }, [handleAnimalClick])

  const startRound = useCallback((roundIndex: number) => {
    if (roundIndex >= TOTAL_ROUNDS) {
      setCurrentRound(0)
      return
    }

    const correctAnimal = ANIMALS[roundIndex]
    const wrongAnimals = ANIMALS.filter(a => a.name !== correctAnimal.name)
    const randomWrongAnimal = wrongAnimals[Math.floor(Math.random() * wrongAnimals.length)]

    spawnAnimals(correctAnimal.name, randomWrongAnimal.name)
  }, [spawnAnimals])

  // Quando a cena estiver pronta, garantir que está visível e renderizando
  useEffect(() => {
    if (!sceneReady) return

    const sceneEl = arSceneRef.current?.getScene()
    if (!sceneEl) return

    // Garantir que a cena está visível e renderizando
    const ensureSceneVisible = () => {
      if (sceneEl) {
        // Garantir que a cena está visível (z-index correto)
        const sceneElement = sceneEl as HTMLElement
        if (sceneElement) {
          sceneElement.style.zIndex = '1'
          sceneElement.style.display = 'block'
          sceneElement.style.visibility = 'visible'
          sceneElement.style.opacity = '1'
        }

        // Forçar renderização
        const scene = sceneEl as any
        if (scene.renderer) {
          scene.renderer.setSize(window.innerWidth, window.innerHeight)
          if (scene.camera) {
            scene.renderer.render(scene.object3D, scene.camera)
          }
        }

        // Disparar evento de resize para forçar atualização
        window.dispatchEvent(new Event('resize'))
      }
    }

    // Aguardar um pouco para garantir que tudo está pronto
    setTimeout(() => {
      ensureSceneVisible()
      
      // Aguardar mais um pouco e iniciar primeira rodada
      setTimeout(() => {
        if (currentRound === 0) {
          startRound(0)
        }
      }, 300)
    }, 200)
  }, [sceneReady, currentRound, startRound])

  const currentAnimal = currentRound < TOTAL_ROUNDS ? ANIMALS[currentRound] : null
  const topImage = currentAnimal ? normalizePath(`assets/images/${currentAnimal.topImage}`) : ''
  const selectedAnimalImage = selectedAnimal ? normalizePath(`assets/images/${ANIMALS.find(a => a.name === selectedAnimal)!.arImage}`) : ''
  const feedbackImage = feedbackType === 'success'
    ? normalizePath('assets/images/estrelas.png')
    : feedbackType === 'error'
    ? normalizePath('assets/images/erro.png')
    : ''

  // WASD controls for desktop testing – move correct animal entity in AR scene
  useEffect(() => {
    if (!sceneReady) return
    if (!correctEntityIdRef.current) return
    const handler = (e: KeyboardEvent) => {
      const id = correctEntityIdRef.current
      if (!id || !arSceneRef.current) return
      let { x, y, z } = correctEntityPosRef.current
      let moved = false
      if (e.key.toLowerCase() === 'w') {
        z -= MOVE_STEP
        moved = true
      }
      if (e.key.toLowerCase() === 's') {
        z += MOVE_STEP
        moved = true
      }
      if (e.key.toLowerCase() === 'a') {
        x -= MOVE_STEP
        moved = true
      }
      if (e.key.toLowerCase() === 'd') {
        x += MOVE_STEP
        moved = true
      }
      if (e.key === 'ArrowUp') {
        y += MOVE_STEP
        moved = true
      }
      if (e.key === 'ArrowDown') {
        y -= MOVE_STEP
        moved = true
      }
      if (moved) {
        correctEntityPosRef.current = { x, y, z }
        // @ts-expect-error
        arSceneRef.current.updateEntityPosition?.(id, `${x} ${y} ${z}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [sceneReady, currentRound])

  // For desktop test: always show the AR animals if usarVideo = false
  const desktopTestMode = !usarVideo

  // Handler explícito no desktop (direto no clique do <img> com logs)
  const handleDesktopAnimalClick = (animal: AnimalType, correct: AnimalType, event: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
    // eslint-disable-next-line no-console
    console.log('[ARScreen][DESKTOP] handleDesktopAnimalClick (img render)', { animal, correct, event, mouse: {x: event.clientX, y: event.clientY} });
    if (handleAnimalClickRef.current) {
      handleAnimalClickRef.current(animal, correct, event.nativeEvent)
    }
  }

  // Render
  return (
    <div className={`ar-game-screen ${isFadingIn ? 'ar-screen-fade-in' : 'ar-screen-fade-out'}`}>
      <LandscapeBlocker />

      {/* Loading overlay */}
      {arLoading && (
        <div className="ar-loading-overlay">
          <div className="ar-loading-content">
            <div className="ar-loading-spinner"></div>
            <p className="ar-loading-text">Preparando AR...</p>
          </div>
        </div>
      )}

      {/* AFrame Scene */}
      <ARSceneAFrame
        ref={arSceneRef}
        onSceneReady={() => {
          setSceneReady(true)
        }}
      />

      {/* Top image */}
      {currentAnimal && !selectedAnimal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 15,
            pointerEvents: 'none',
            background: 'rgba(255,255,255,0.2)',
            padding: '0.5rem'
          }}
          data-role="top-image-round"
        >
          <img
            src={topImage}
            alt={currentAnimal.name}
            style={{
              userSelect: 'none',
              pointerEvents: 'none',
              display: 'block'
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Mostra animais para teste desktop explicitamente, com logs onClick */}
      {sceneReady && !selectedAnimal && desktopTestMode && (() => {
        const idx = currentRound % ANIMALS.length
        const curr = ANIMALS[idx]
        const wrongAnimals = ANIMALS.filter(a => a.name !== curr.name)
        const other = wrongAnimals[0]
        return (
          <React.Fragment>
            <div style={{
              position: 'fixed',
              left: '10vw', top: '30vh', zIndex: 30,
              background: 'rgba(255,255,255,0.1)', padding: 8,
              cursor: 'pointer'
            }}>
              <img
                src={normalizePath(`assets/images/${curr.arImage}`)}
                alt={curr.name}
                style={{ display: 'block', cursor: 'pointer' }}
                draggable={false}
                tabIndex={0}
                onClick={e => {
                  // eslint-disable-next-line no-console
                  console.log('[ONCLICK IMG] Animal:', curr.name, 'expected:', curr.name, 'evento:', e.type, {x: e.clientX, y: e.clientY})
                  handleDesktopAnimalClick(curr.name, curr.name, e)
                }}
                onMouseDown={e => {
                  // eslint-disable-next-line no-console
                  console.log('[ONMOUSEDOWN IMG] Animal:', curr.name, e)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleDesktopAnimalClick(curr.name, curr.name, e as any)
                  }
                }}
                data-testid={`animal-img-${curr.name}`}
              />
            </div>
            <div style={{
              position: 'fixed',
              right: '10vw', top: '30vh', zIndex: 30,
              background: 'rgba(255,255,255,0.1)', padding: 8,
              cursor: 'pointer'
            }}>
              <img
                src={normalizePath(`assets/images/${other.arImage}`)}
                alt={other.name}
                style={{ display: 'block', cursor: 'pointer' }}
                draggable={false}
                tabIndex={0}
                onClick={e => {
                  // eslint-disable-next-line no-console
                  console.log('[ONCLICK IMG] Animal:', other.name, 'expected:', curr.name, 'evento:', e.type, {x: e.clientX, y: e.clientY})
                  handleDesktopAnimalClick(other.name, curr.name, e)
                }}
                onMouseDown={e => {
                  // eslint-disable-next-line no-console
                  console.log('[ONMOUSEDOWN IMG] Animal:', other.name, e)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleDesktopAnimalClick(other.name, curr.name, e as any)
                  }
                }}
                data-testid={`animal-img-${other.name}`}
              />
            </div>
          </React.Fragment>
        )
      })()}

      {/* Feedback */}
      {selectedAnimal && (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2vh',
            animation: 'fadeInScale 0.5s ease-out'
          }}
        >
          {feedbackImage && (
            <img
              src={feedbackImage}
              alt={feedbackType === 'success' ? 'Estrelas' : 'Erro'}
              style={{
                userSelect: 'none',
                pointerEvents: 'none',
                display: 'block'
              }}
              draggable={false}
            />
          )}
          <img
            src={selectedAnimalImage}
            alt={selectedAnimal}
            style={{
              userSelect: 'none',
              pointerEvents: 'none',
              display: 'block'
            }}
            draggable={false}
          />
        </div>
      )}

      {/* Dica WASD */}
      {desktopTestMode && sceneReady && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: '#333',
          background: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: '4px 16px', fontSize: 15, zIndex: 200
        }}>
          Use W A S D (e setas) para mover o animal correto na cena AR (use para teste no desktop)
        </div>
      )}

      <style>
        {`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: translate(-50%, -50%) scale(0.5);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
          }
        `}
      </style>
    </div>
  )
}
