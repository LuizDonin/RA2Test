import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { useRA } from '../../contexts/RAContext'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { playClickSound, playSuccessSound, playErrorSound } from '../../utils/soundUtils'
import { ARSceneAFrame, ARSceneAFrameRef } from '../ARSceneAFrame'
import '../../styles/ar-screen.css'

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
const INITIAL_ANIMAL_Z = -3

function getCorrectAnimalForRound(round: number): AnimalType {
  if (round >= 0 && round < ANIMALS.length) {
    return ANIMALS[round].name
  }
  return 'gato'
}

// --- Correção bug feedback "flick" centralização ---
// Usaremos refs e state dedicado para forçar o conteúdo de feedback a aparecer já centralizado, nunca com translate incorreto

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

  // Ref para controlar quando o feedback foi realmente montado no DOM (usado para garantir centralização)
  const feedbackRef = useRef<HTMLDivElement | null>(null)
  const [feedbackMounted, setFeedbackMounted] = useState(false)

  // For top image transitions between rounds (custom logic)
  const [topImageAnim, setTopImageAnim] = useState<{
    current: AnimalConfig | null,
    next: AnimalConfig | null,
    phase: 'show-current' | 'hide-current' | 'show-next' | 'idle'
  }>({ current: ANIMALS[0], next: null, phase: 'show-current' })

  // For pausing until AR images are loaded before allowing interaction/spawn
  const [arImagesLoaded, setArImagesLoaded] = useState<{ [animal in AnimalType]?: boolean }>({})
  const [pendingARImages, setPendingARImages] = useState<{ correct: AnimalType | null, wrong: AnimalType | null }>({ correct: null, wrong: null })
  const [canDisplayAnimals, setCanDisplayAnimals] = useState(false)
  // To control timeout for animation transitions
  const animTimeoutRef = useRef<number | null>(null)

  const arSceneRef = useRef<ARSceneAFrameRef>(null)
  const animalEntitiesRef = useRef<{ left: string | null; right: string | null }>({ left: null, right: null })
  const correctEntityIdRef = useRef<string | null>(null)
  const correctEntityPosRef = useRef<{ x: number, y: number, z: number }>({ x: -1.5, y: 0, z: -10 })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)

  const animalsWorldPosRef = useRef<{
    left: { x: number, y: number, z: number } | null,
    right: { x: number, y: number, z: number } | null,
  }>({ left: null, right: null })
  const entityIdToAnimal = useRef<Record<string, AnimalType>>({})

  function worldPositionsToScreenPositions(canvas: HTMLCanvasElement | null, camObj: any) {
    if (!canvas) return []
    const res: Array<{
      x: number
      y: number
      key: string
      color: string
      animalName: AnimalType
      screenPxRadius: number
      entityId: string
    }> = []
    const width = canvas.width
    const height = canvas.height
    const THREE = (window as any).THREE
    if (!THREE || !camObj) return []
    const ANIMAL_SCREEN_RADIUS = 80
    const animalsToCheck: Array<{ id: string | null, pos: { x: number, y: number, z: number } | null, key: string, color: string }> = [
      { id: animalEntitiesRef.current.left, pos: animalsWorldPosRef.current.left, key: 'left', color: 'rgba(33, 99, 255, 0.6)' },
      { id: animalEntitiesRef.current.right, pos: animalsWorldPosRef.current.right, key: 'right', color: 'rgba(145, 200, 255, 0.6)' }
    ]

    for (const { id, pos, key, color } of animalsToCheck) {
      if (!id || !pos) continue
      const vector = new THREE.Vector3(pos.x, pos.y, pos.z)
      vector.project(camObj)
      const sx = (vector.x + 1) / 2 * width
      const sy = (1 - (vector.y + 1) / 2) * height
      const nameFromMapping = entityIdToAnimal.current[id] as AnimalType
      res.push({
        x: sx,
        y: sy,
        key: id,
        color,
        animalName: nameFromMapping ?? 'gato',
        screenPxRadius: ANIMAL_SCREEN_RADIUS,
        entityId: id,
      })
    }
    return res
  }

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
        const existingVideo = document.getElementById('arjs-video') as HTMLVideoElement
        if (existingVideo && existingVideo.srcObject) {
          const existingStream = existingVideo.srcObject as MediaStream
          existingStream.getTracks().forEach(track => track.stop())
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 720 },
            height: { ideal: 1280 },
            facingMode: { ideal: 'environment' }
          },
          audio: false
        })
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
        video.style.display = 'block'
        video.style.visibility = 'visible'
        video.style.opacity = '0'
        video.style.transition = 'opacity 0.6s ease-in'
        video.srcObject = stream
        mediaStreamRef.current = stream
        videoRef.current = video

        try { await video.play() } catch (playErr) { /* eslint-disable-next-line no-console */console.warn("[ARScreen] Falha ao chamar video.play():", playErr) }

        setArLoading(false)
        setTimeout(() => {
          setIsFadingIn(true)
          if (video) { video.style.opacity = '1' }
        }, 100)
      } catch (err) {
        if (typeof window !== "undefined" && err && (err as any).name === "AbortError") {
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

  const clearAnimals = useCallback(() => {
    if (animalEntitiesRef.current.left && arSceneRef.current) {
      const leftId = animalEntitiesRef.current.left
      arSceneRef.current.removeEntity(leftId)
      const leftEntity = document.getElementById(leftId)
      if (leftEntity) {
        leftEntity.remove()
      }
      animalEntitiesRef.current.left = null
    }
    if (animalEntitiesRef.current.right && arSceneRef.current) {
      const rightId = animalEntitiesRef.current.right
      arSceneRef.current.removeEntity(rightId)
      const rightEntity = document.getElementById(rightId)
      if (rightEntity) {
        rightEntity.remove()
      }
      animalEntitiesRef.current.right = null
    }
    correctEntityIdRef.current = null
    animalsWorldPosRef.current.left = null
    animalsWorldPosRef.current.right = null
    entityIdToAnimal.current = {}

    // Limpar qualquer entidade órfã com classe clickable-animal
    const sceneEl = arSceneRef.current?.getScene()
    if (sceneEl) {
      const orphanEntities = sceneEl.querySelectorAll('.clickable-animal')
      orphanEntities.forEach((entity: Element) => {
        entity.remove()
      })
    }
  }, [])

  /** Ensure round game logic always uses fresh currentRound value */
  const currentRoundRef = useRef<number>(0)
  useEffect(() => {
    currentRoundRef.current = currentRound
  }, [currentRound])

  useEffect(() => {
    if (!sceneReady) return

    const sceneEl = arSceneRef.current?.getScene()
    if (!sceneEl) return

    let camera = sceneEl.querySelector('a-camera')
    if (!camera) {
      camera = document.createElement('a-camera')
      sceneEl.appendChild(camera)
    }
    const existingCursor = camera.querySelector('a-cursor')
    if (existingCursor) { existingCursor.remove() }
    if (!camera.hasAttribute('raycaster')) {
      camera.setAttribute('raycaster', 'objects: .clickable-animal; far: 100; interval: 0')
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (isAnimating) return
      const touch = event.touches[0]
      if (!touch) return
      const x = (touch.clientX / window.innerWidth) * 2 - 1
      const y = -(touch.clientY / window.innerHeight) * 2 + 1
      const THREE = (window as any).THREE
      if (!THREE) return
      const raycasterObj = new THREE.Raycaster()
      const cameraObj = (camera as any).getObject3D('camera')
      if (!cameraObj) return

      raycasterObj.setFromCamera(
        new THREE.Vector2(x, y),
        cameraObj
      )

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

      if (intersections.length > 0) {
        intersections.sort((a, b) => a.distance - b.distance)
        const closest = intersections[0]
        const entityId = closest.el.id
        let animalName: AnimalType | null = null
        if (entityId && entityIdToAnimal.current[entityId]) {
          animalName = entityIdToAnimal.current[entityId]
        } else {
          animalName = (closest.el.getAttribute('data-animal') as AnimalType) || null
        }
        const logicCurrentRound = currentRoundRef.current
        const currentAnimal = logicCurrentRound < TOTAL_ROUNDS ? ANIMALS[logicCurrentRound] : null
        let expectedAnimal: AnimalType | null = null
        if (currentAnimal) {
          expectedAnimal = currentAnimal.name
        }
        if (animalName && handleAnimalClickRef.current && expectedAnimal) {
          handleAnimalClickRef.current(animalName, expectedAnimal, event)
        } else {
          // eslint-disable-next-line no-console
          console.warn('[ARScreen] Animal name não encontrado ou handler não disponível', { animalName, hasHandler: !!handleAnimalClickRef.current, expectedAnimal })
        }
      }
    }

    sceneEl.addEventListener('touchstart', handleTouchStart as any, { passive: false })
    return () => {
      sceneEl.removeEventListener('touchstart', handleTouchStart as any)
    }
  }, [sceneReady, isAnimating])

  const handleAnimalClickRef = useRef<((clickedAnimal: AnimalType, correctAnimal: AnimalType, event?: Event) => void) | null>(null)

  // SPAWN: agora espera o "canDisplayAnimals" = true, só spawna (adiciona entidades) quando ambas imagens de AR do round já carregaram.
  const spawnAnimals = useCallback((correctAnimal: AnimalType, wrongAnimal: AnimalType) => {
    setPendingARImages({ correct: correctAnimal, wrong: wrongAnimal })
    setCanDisplayAnimals(false)
  }, [])

  useEffect(() => {
    if (!pendingARImages.correct || !pendingARImages.wrong) return
    const bothLoaded =
      arImagesLoaded[pendingARImages.correct] &&
      arImagesLoaded[pendingARImages.wrong]
    if (!bothLoaded) return

    if (!arSceneRef.current || !sceneReady) {
      return
    }

    clearAnimals()

    const sceneEl = arSceneRef.current.getScene()
    if (!sceneEl) {
      return
    }

    const sceneElement = sceneEl as HTMLElement
    if (sceneElement) {
      sceneElement.style.zIndex = '1'
      sceneElement.style.display = 'block'
      sceneElement.style.visibility = 'visible'
      sceneElement.style.opacity = '1'
    }

    const correctAnimalConfig = ANIMALS.find(a => a.name === pendingARImages.correct)!
    const wrongAnimalConfig = ANIMALS.find(a => a.name === pendingARImages.wrong)!

    const correctOnLeft = Math.random() > 0.5

    const leftAnimal = correctOnLeft ? correctAnimalConfig : wrongAnimalConfig
    const rightAnimal = correctOnLeft ? wrongAnimalConfig : correctAnimalConfig

    const leftPos = { x: -1.5, y: 0.5, z: INITIAL_ANIMAL_Z }
    const rightPos = { x: 1.5, y: 0.5, z: INITIAL_ANIMAL_Z }

    const leftEntityId = arSceneRef.current.addEntity({
      geometry: 'primitive: plane',
      material: `src: ${normalizePath(`assets/images/${leftAnimal.arImage}`)}; transparent: true; side: double`,
      position: `${leftPos.x} ${leftPos.y} ${leftPos.z}`,
      scale: '0.2 0.2 0.2',
      'look-at': '[camera]',
      class: 'clickable-animal',
      'data-animal': leftAnimal.name,
      'animation__scalein': 'property: scale; to: 1 1 1; dur: 400; easing: easeOutElastic; loop: false; startEvents: animscalein',
      'animation__scale': 'property: scale; to: 1.1 1.1 1.1; dur: 200; startEvents: mouseenter',
      'animation__scaleback': 'property: scale; to: 1 1 1; dur: 200; startEvents: mouseleave'
    })
    const rightEntityId = arSceneRef.current.addEntity({
      geometry: 'primitive: plane',
      material: `src: ${normalizePath(`assets/images/${rightAnimal.arImage}`)}; transparent: true; side: double`,
      position: `${rightPos.x} ${rightPos.y} ${rightPos.z}`,
      scale: '0.2 0.2 0.2',
      'look-at': '[camera]',
      class: 'clickable-animal',
      'data-animal': rightAnimal.name,
      'animation__scalein': 'property: scale; to: 1 1 1; dur: 400; easing: easeOutElastic; loop: false; startEvents: animscalein',
      'animation__scale': 'property: scale; to: 1.1 1.1 1.1; dur: 200; startEvents: mouseenter',
      'animation__scaleback': 'property: scale; to: 1 1 1; dur: 200; startEvents: mouseleave'
    })

    animalEntitiesRef.current.left = leftEntityId
    animalEntitiesRef.current.right = rightEntityId
    animalsWorldPosRef.current.left = { ...leftPos }
    animalsWorldPosRef.current.right = { ...rightPos }
    entityIdToAnimal.current = {
      [leftEntityId]: leftAnimal.name as AnimalType,
      [rightEntityId]: rightAnimal.name as AnimalType
    }
    if (correctOnLeft) {
      correctEntityIdRef.current = leftEntityId
      correctEntityPosRef.current = { ...leftPos }
    } else {
      correctEntityIdRef.current = rightEntityId
      correctEntityPosRef.current = { ...rightPos }
    }
    setTimeout(() => {
      const leftEntity = document.getElementById(leftEntityId)
      const rightEntity = document.getElementById(rightEntityId)
      if (leftEntity) {
        leftEntity.setAttribute('data-animal', leftAnimal.name)
        leftEntity.emit('animscalein')
      }
      if (rightEntity) {
        rightEntity.setAttribute('data-animal', rightAnimal.name)
        rightEntity.emit('animscalein')
      }
      const scene = sceneEl as any
      if (scene && scene.renderer) {
        scene.renderer.setSize(window.innerWidth, window.innerHeight)
        if (scene.camera) {
          scene.renderer.render(scene.object3D, scene.camera)
        }
      }
      window.dispatchEvent(new Event('resize'))
      setCanDisplayAnimals(true)
    }, 200)
    setPendingARImages({ correct: null, wrong: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingARImages, arImagesLoaded, clearAnimals, sceneReady, normalizePath])

  // Handler: agora NÃO move a topimage no clique! Só move na transição de fase.
  const handleAnimalClick = useCallback((clickedAnimal: AnimalType, _correctAnimalIgnored: AnimalType, event?: Event) => {
    if (isAnimating) return

    setIsAnimating(true)
    playClickSound()

    const logicCurrentRound = currentRoundRef.current
    const currentAnimal = logicCurrentRound < TOTAL_ROUNDS ? ANIMALS[logicCurrentRound] : null
    let correctAnimal: AnimalType | null = null
    if (currentAnimal) {
      correctAnimal = currentAnimal.name
    }

    const isCorrect = clickedAnimal === correctAnimal
    setSelectedAnimal(clickedAnimal)
    setFeedbackType(isCorrect ? 'success' : 'error')
    clearAnimals()
    setFeedbackMounted(false) // REFORÇA remount do componente feedback no clique!

    if (isCorrect) {
      playSuccessSound()
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current)
      animTimeoutRef.current = window.setTimeout(() => {
        setTopImageAnim(prev => ({
          ...prev,
          phase: 'hide-current'
        }))
        setTimeout(() => {
          setTopImageAnim(prev => ({
            ...prev,
            next: ANIMALS[logicCurrentRound + 1] ?? null,
            phase: 'show-next'
          }))
          setTimeout(() => {
            setTopImageAnim({
              current: ANIMALS[logicCurrentRound + 1] ?? null,
              next: null,
              phase: (logicCurrentRound + 1) < TOTAL_ROUNDS ? 'show-current' : 'idle'
            })
            setCurrentRound(prev => prev + 1)
            setSelectedAnimal(null)
            setFeedbackType(null)
            setIsAnimating(false)
            setFeedbackMounted(false)
            if ((logicCurrentRound + 1) < TOTAL_ROUNDS) {
              const nextAnimal = ANIMALS[logicCurrentRound + 1]
              const correctAnimalForNextRound = nextAnimal.name
              const wrongAnimals = ANIMALS.filter(a => a.name !== correctAnimalForNextRound)
              const randomWrongAnimal = wrongAnimals[Math.floor(Math.random() * wrongAnimals.length)]
              setPendingARImages({
                correct: correctAnimalForNextRound,
                wrong: randomWrongAnimal.name
              })
              setCanDisplayAnimals(false)
            }
          }, 600)
        }, 600)
      }, 800)
    } else {
      playErrorSound()
      setTimeout(() => {
        setSelectedAnimal(null)
        setFeedbackType(null)
        setIsAnimating(false)
        setFeedbackMounted(false)
        const curr = currentRoundRef.current < TOTAL_ROUNDS ? ANIMALS[currentRoundRef.current] : null
        if (curr) {
          const correctAnimalForRound = curr.name
          const wrongAnimals = ANIMALS.filter(a => a.name !== correctAnimalForRound)
          const randomWrongAnimal = wrongAnimals[Math.floor(Math.random() * wrongAnimals.length)]
          setPendingARImages({ correct: correctAnimalForRound, wrong: randomWrongAnimal.name })
          setCanDisplayAnimals(false)
        }
      }, 1700)
    }
  }, [isAnimating, clearAnimals])

  useEffect(() => {
    handleAnimalClickRef.current = handleAnimalClick
  }, [handleAnimalClick])

  // Pre-carrega as imagens AR do round para evitar "white rectangle"
  const preloadARImages = useCallback((correct: AnimalType, wrong: AnimalType) => {
    [correct, wrong].forEach(animalName => {
      const img = new window.Image()
      img.src = normalizePath(`assets/images/${ANIMALS.find(a => a.name === animalName)!.arImage}`)
      img.onload = () => {
        setArImagesLoaded(loaded => ({ ...loaded, [animalName]: true }))
      }
    })
  }, [normalizePath])

  // Inicializa topImageAnim corretamente quando muda currentRound (inclusive no início)
  useEffect(() => {
    if (!sceneReady) return

    // Ao terminar as rodadas, esconde topimage
    if (currentRound >= TOTAL_ROUNDS) {
      setTopImageAnim({ current: null, next: null, phase: 'idle' })
      return
    }

    setCanDisplayAnimals(false)
    const curr = currentRound < TOTAL_ROUNDS ? ANIMALS[currentRound] : null
    if (curr) {
      const correctAnimalForRound = curr.name
      const wrongAnimals = ANIMALS.filter(a => a.name !== correctAnimalForRound)
      const randomWrongAnimal = wrongAnimals[Math.floor(Math.random() * wrongAnimals.length)]
      preloadARImages(correctAnimalForRound, randomWrongAnimal.name)
      setPendingARImages({ correct: correctAnimalForRound, wrong: randomWrongAnimal.name })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, sceneReady])

  const logicCurrentRound = currentRoundRef.current
  const desktopTestMode = !usarVideo

  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [animalScreenCircles, setAnimalScreenCircles] = useState<
    Array<{ x: number; y: number; key: string; color: string; animalName: AnimalType; screenPxRadius: number; entityId: string }>
  >([])

  useEffect(() => {
    let intervalId: NodeJS.Timeout | number | null = null
    function syncCanvasAndCircles() {
      const canvas = debugCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const sceneEl = arSceneRef.current?.getScene()
      if (!sceneReady || !sceneEl) {
        setAnimalScreenCircles([])
        return
      }
      const cameraEl = sceneEl.querySelector('a-camera')
      const THREE = (window as any).THREE
      if (!THREE || !cameraEl || !cameraEl.components || !cameraEl.components.camera) {
        setAnimalScreenCircles([])
        return
      }
      const camObj = cameraEl.getObject3D('camera')
      if (!camObj) {
        setAnimalScreenCircles([])
        return
      }
      const circles = worldPositionsToScreenPositions(canvas, camObj)
      setAnimalScreenCircles(circles)
      circles.forEach(({ x, y }) => {
        ctx.beginPath()
        ctx.arc(x, y, 37, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,0,0,0)'
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0)'
        ctx.lineWidth = 2
        ctx.stroke()
      })
    }
    function onResize() {
      const canvas = debugCanvasRef.current
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      syncCanvasAndCircles()
    }

    onResize()
    window.addEventListener('resize', onResize)
    intervalId = setInterval(syncCanvasAndCircles, 150)

    return () => {
      window.removeEventListener('resize', onResize)
      if (intervalId) clearInterval(intervalId as any)
    }
  }, [sceneReady, currentRound])

  useEffect(() => {
    const handler = () => {
      const canvas = debugCanvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    window.addEventListener('animal-pos-change', handler)
    return () => {
      window.removeEventListener('animal-pos-change', handler)
    }
  }, [])

  useEffect(() => { }, [correctEntityPosRef.current])

  useEffect(() => {
    const canvas = debugCanvasRef.current
    if (canvas) {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
  }, [])

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
        if (animalEntitiesRef.current.left === id) {
          animalsWorldPosRef.current.left = { x, y, z }
        } else if (animalEntitiesRef.current.right === id) {
          animalsWorldPosRef.current.right = { x, y, z }
        }
        // @ts-expect-error
        arSceneRef.current.updateEntityPosition?.(id, `${x} ${y} ${z}`)
        const evt = new Event('animal-pos-change')
        window.dispatchEvent(evt)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keydown', handler)
    }
  }, [sceneReady, currentRound])

  const handleDesktopAnimalClick = (animal: AnimalType, _unusedCorrect: AnimalType, event: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
    const logicCurrentRound = currentRoundRef.current
    const curr = logicCurrentRound < TOTAL_ROUNDS ? ANIMALS[logicCurrentRound] : null
    let correctAnimal: AnimalType | null = null
    if (curr) {
      correctAnimal = curr.name
    }
    if (handleAnimalClickRef.current && correctAnimal) {
      handleAnimalClickRef.current(animal, correctAnimal, event.nativeEvent)
    }
  }

  const handleCircleButtonClick = useCallback((circle: typeof animalScreenCircles[number], event: React.MouseEvent | React.TouchEvent) => {
    const logicCurrentRound = currentRoundRef.current
    const curr = logicCurrentRound < TOTAL_ROUNDS ? ANIMALS[logicCurrentRound] : null
    if (!curr) return
    if (isAnimating) return
    event.stopPropagation()
    event.preventDefault()
    const expectedAnimal = curr.name
    if (handleAnimalClickRef.current) {
      handleAnimalClickRef.current(circle.animalName, expectedAnimal, event.nativeEvent)
    }
  }, [isAnimating, animalScreenCircles])

  const canShowAnimalButtons = sceneReady && animalScreenCircles.length > 0 && canDisplayAnimals && (!selectedAnimal || feedbackType === 'error')

  // TopImage animation helpers
  function getTopImageStyle(anim: typeof topImageAnim, kind: 'current' | 'next') {
    // animation phases: show-current | hide-current | show-next | idle

    // hide-current/top: moves much further up offscreen (e.g., -400px)
    if (anim.phase === 'show-current' && kind === 'current') {
      // Entrando
      return {
        top: 30,
      }
    }
    if (anim.phase === 'hide-current' && kind === 'current') {
      // Saindo pra cima, muito além da tela
      return {
        top: '-400px',
        transition: 'top 0.6s cubic-bezier(.49,1.8,.55,1.04), opacity 0.35s'
      }
    }

    // show-next: a próxima topimage começa bem acima da tela, e desce em movimento linear até 30px
    if (anim.phase === 'show-next' && kind === 'next') {
      return {
        top: '-160px',
        transition: 'top 0s',
        willChange: 'top'
      }
    }
    if (anim.phase === 'show-next' && kind === 'current') {
      return {
        top: '-2000px',
        transition: 'top 0.01s'
      }
    }
    if (anim.phase === 'show-current' && kind === 'next') {
      return { top: '-2000px', transition: 'top 0.01s' }
    }
    if (anim.phase === 'idle') {
      return { top: '-2000px', transition: 'top 0.01s' }
    }
    return { top: '-2000px', transition: 'top 0.01s' }
  }

  // Estado auxiliar para ativar transição linear da topimage "next"
  const [showNextTopImageLinearAnim, setShowNextTopImageLinearAnim] = useState(false)

  // Handle animation for next topImage: entrada linear vinda do topo da tela para 30px
  useEffect(() => {
    if (topImageAnim.phase === 'show-next') {
      setShowNextTopImageLinearAnim(false)
      setTimeout(() => {
        setShowNextTopImageLinearAnim(true)
        setTimeout(() => {
          setTopImageAnim(prev => ({
            ...prev,
            current: prev.next,
            next: null,
            phase: prev.next ? 'show-current' : 'idle'
          }))
          setShowNextTopImageLinearAnim(false)
        }, 480)
      }, 20)
    }
  }, [topImageAnim.phase])

  // --- render ---
  const feedbackImage =
    feedbackType === 'success'
      ? normalizePath('assets/images/estrelas.png')
      : feedbackType === 'error'
      ? normalizePath('assets/images/erro.png')
      : ''

  const selectedAnimalImage = selectedAnimal
    ? normalizePath(`assets/images/${ANIMALS.find(a => a.name === selectedAnimal)!.arImage}`)
    : ''

  // Custom: style for chosen animal shown in 2D after answer
  // Centralização corrigida: use absolute LEFT/TOP 50% + translate(-50%, -50%), sem RELATIVE
  // REMOVA qualquer margin/marginTop/marginAuto do antigo, e SEM delay até o feedback div estar no DOM
  // Novo: animal + feedback mais para baixo, mais próximos
  const chosen2DAnimalStyle: React.CSSProperties = {
    userSelect: 'none',
    pointerEvents: 'none',
    display: 'block',
    width: 'min(220px, 48vw)',
    maxWidth: '220px',
    minWidth: '110px',
    height: 'auto',
    position: 'static',
    left: undefined,
    right: undefined,
    margin: undefined,
    // gap menor ao feedback, sem descer tanto
    marginTop: '2px', // reduzido ainda mais para mais próximo das estrelas/erro
    transform: 'scale(0.85)',
    transition: 'none'
  }

  // Feedback estrelas/erro: mais para cima
  const feedbackIconStyle: React.CSSProperties = {
    userSelect: 'none',
    pointerEvents: 'none',
    display: 'block',
    transform: 'scale(1)',
    marginBottom: '0px',
    marginTop: '0px',
    maxWidth: '120px',
    minWidth: '64px',
    width: 'min(120px, 30vw)',
    height: 'auto',
    transition: 'none'
  }

  // --- Garantir que não haja "flick" na animação do feedback central ---
  useEffect(() => {
    if (!selectedAnimal) {
      setFeedbackMounted(false)
      return
    }
    // Pequeno timeout para garantir que o elemento está 100% no DOM antes de mostrar conteúdo (geralmente 1 tick)
    const id = window.setTimeout(() => {
      setFeedbackMounted(true)
    }, 0)
    return () => {
      clearTimeout(id)
    }
  }, [selectedAnimal])

  return (
    <div className={`ar-game-screen ${isFadingIn ? 'ar-screen-fade-in' : 'ar-screen-fade-out'}`} style={{ position: 'fixed' }}>
      <LandscapeBlocker />

      {/* Canvas de debug de posição dos animais */}
      <canvas
        ref={debugCanvasRef}
        width={window.innerWidth}
        height={window.innerHeight}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 99,
          pointerEvents: 'none'
        }}
        aria-label="Debug blue circle for animal positions"
      />

      {/* Overlay dos botões "círculos" */}
      {canShowAnimalButtons && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 120,
            pointerEvents: 'auto',
            userSelect: 'none'
          }}
          aria-label="Overlay botões animais"
        >
          {animalScreenCircles.map(circle => (
            <button
              key={circle.entityId}
              type="button"
              aria-label={`Selecionar animal ${circle.animalName}`}
              tabIndex={0}
              onClick={e => handleCircleButtonClick(circle, e)}
              onTouchStart={e => handleCircleButtonClick(circle, e)}
              style={{
                position: 'absolute',
                left: circle.x - circle.screenPxRadius,
                top: circle.y - circle.screenPxRadius,
                width: `${circle.screenPxRadius * 2}px`,
                height: `${circle.screenPxRadius * 2}px`,
                borderRadius: '100%',
                zIndex: 122,
                cursor: isAnimating ? 'default' : 'pointer',
                pointerEvents: isAnimating ? 'none' : 'auto',
                opacity: 0,
                userSelect: 'none',
                outline: 'none',
                transition: 'background .14s'
              }}
              disabled={isAnimating}
              data-key={circle.entityId}
              data-animal={circle.animalName}
              data-animal-tag={circle.animalName}
              data-entity-id={circle.entityId}
              data-testid={`animal-circle-btn-${circle.animalName}`}
            />
          ))}
        </div>
      )}

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

      {/* Top image round */}
      <>
        {topImageAnim.current && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 15,
              pointerEvents: 'none',
              background: 'rgba(0,0,0,0.0)',
              padding: '0.5rem',
              transition: getTopImageStyle(topImageAnim, 'current').transition,
              top: getTopImageStyle(topImageAnim, 'current').top,
              opacity: topImageAnim.phase === 'idle' ? 0 : 1
            }}
            data-role="top-image-round"
          >
            <img
              src={normalizePath(`assets/images/${topImageAnim.current.topImage}`)}
              alt={topImageAnim.current.name}
              style={{
                userSelect: 'none',
                pointerEvents: 'none',
                display: 'block',
                willChange: 'transform, opacity'
              }}
              draggable={false}
            />
          </div>
        )}
        {topImageAnim.next && (
          <div
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 15,
              pointerEvents: 'none',
              background: 'rgba(0,0,0,0.0)',
              padding: '0.5rem',
              top: showNextTopImageLinearAnim ? 30 : getTopImageStyle(topImageAnim, 'next').top,
              transition: showNextTopImageLinearAnim
                ? 'top 0.48s linear'
                : (getTopImageStyle(topImageAnim, 'next').transition || undefined),
              willChange: 'top',
              opacity: topImageAnim.phase === 'idle' ? 0 : 1
            }}
            data-role="top-image-round-next"
          >
            <img
              src={normalizePath(`assets/images/${topImageAnim.next.topImage}`)}
              alt={topImageAnim.next.name}
              style={{
                userSelect: 'none',
                pointerEvents: 'none',
                display: 'block',
                willChange: 'transform, opacity'
              }}
              draggable={false}
            />
          </div>
        )}
      </>

      {/* Mostra animais para teste desktop explicitamente */}
      {sceneReady && (!selectedAnimal || feedbackType === 'error') && desktopTestMode && (() => {
        const logicCurrentRound = currentRoundRef.current
        const idx = logicCurrentRound % ANIMALS.length
        const curr = ANIMALS[idx]
        const correctAnimal = curr.name
        const wrongAnimals = ANIMALS.filter(a => a.name !== correctAnimal)
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
                  handleDesktopAnimalClick(curr.name, correctAnimal, e)
                }}
                onMouseDown={e => {
                  // eslint-disable-next-line no-console
                  console.log('[ONMOUSEDOWN IMG] Animal:', curr.name, e)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleDesktopAnimalClick(curr.name, correctAnimal, e as any)
                  }
                }}
                data-testid={`animal-img-${curr.name}`}
                data-animal={curr.name}
                data-animal-tag={curr.name}
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
                  handleDesktopAnimalClick(other.name, correctAnimal, e)
                }}
                onMouseDown={e => {
                  // eslint-disable-next-line no-console
                  console.log('[ONMOUSEDOWN IMG] Animal:', other.name, e)
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleDesktopAnimalClick(other.name, correctAnimal, e as any)
                  }
                }}
                data-testid={`animal-img-${other.name}`}
                data-animal={other.name}
                data-animal-tag={other.name}
              />
            </div>
          </React.Fragment>
        )
      })()}

      {/* Feedback central: MAIS para cima e animal próximo das estrelas/erro */}
      {selectedAnimal && (
        <div
          ref={feedbackRef}
          style={{
            position: 'fixed',
            // Centraliza e sobe um pouco, antes estava top: '78%'
            top: '68%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 20,
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px', // espaço pequeno entre feedback e animal
            animation: feedbackMounted ? 'fadeInScale 0.5s ease-out' : undefined,
            opacity: feedbackMounted ? 1 : 0,
            transition: 'opacity 0.07s linear'
          }}
        >
          {(feedbackMounted && feedbackImage) && (
            <img
              src={feedbackImage}
              alt={feedbackType === 'success' ? 'Estrelas' : 'Erro'}
              style={feedbackIconStyle}
              draggable={false}
            />
          )}
          {feedbackMounted && (
            <img
              src={selectedAnimalImage}
              alt={selectedAnimal}
              style={chosen2DAnimalStyle}
              draggable={false}
            />
          )}
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

      {/* Preload das imagens AR para não aparecer "quadrado branco" */}
      {(() => {
        if (!pendingARImages.correct || !pendingARImages.wrong) return null
        const arImgSrcs = [
          normalizePath(`assets/images/${ANIMALS.find(a => a.name === pendingARImages.correct)!.arImage}`),
          normalizePath(`assets/images/${ANIMALS.find(a => a.name === pendingARImages.wrong)!.arImage}`)
        ]
        return (
          <div style={{ display: 'none' }}>
            {arImgSrcs.map((src, idx) => (
              <img
                src={src}
                key={src}
                alt={`preload_ar_${idx}`}
                onLoad={() => {
                  const animalName =
                    idx === 0 ? pendingARImages.correct : pendingARImages.wrong
                  setArImagesLoaded(loaded => ({ ...loaded, [animalName!]: true }))
                }}
              />
            ))}
          </div>
        )
      })()}

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
