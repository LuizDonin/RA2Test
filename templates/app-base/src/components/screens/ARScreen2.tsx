import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { useRA } from '../../contexts/RAContext'
import { playPhotoSound } from '../../utils/soundUtils'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import '../../styles/ar-screen.css'

interface ARScreen2Props {
  onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
  title?: string
  subtitle?: string
  backgroundImage?: string
}

export const ARScreen2: React.FC<ARScreen2Props> = ({
  onNavigate
}) => {
  const { raData } = useRA()
  const config = raData?.configuracoes || {}
  const usarVideo = config.usarVideo !== false

  const [arLoading, setArLoading] = useState(true)
  const [isFadingIn, setIsFadingIn] = useState(false)
  const [flashWhite, setFlashWhite] = useState(false)
  const [hidePhotoButton, setHidePhotoButton] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  // Configurar câmera frontal (não força paisagem - opta por retrato)
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
        // Verificar se já existe vídeo global
        const existingVideo = document.getElementById('arjs-video') as HTMLVideoElement
        if (existingVideo && existingVideo.srcObject) {
          existingVideo.style.display = 'block'
          existingVideo.style.visibility = 'visible'
          existingVideo.style.opacity = '0'
          existingVideo.style.zIndex = '0'
          existingVideo.style.transition = 'opacity 0.6s ease-in'
          videoRef.current = existingVideo
          mediaStreamRef.current = existingVideo.srcObject as MediaStream
          setArLoading(false)
          setTimeout(() => {
            setIsFadingIn(true)
            if (existingVideo) {
              existingVideo.style.opacity = '1'
            }
          }, 100)
          return
        }

        // Requisição de câmera frontal, priorizando retrato (não paisagem)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'user' }, // Câmera frontal
            width: { ideal: 720 },
            height: { ideal: 1280 }
          },
          audio: false
        })

        // Criar elemento de vídeo
        const video = document.createElement('video')
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
        video.style.display = 'block'
        video.style.visibility = 'visible'
        video.style.opacity = '0'
        video.style.transition = 'opacity 0.6s ease-in'
        document.body.appendChild(video)

        video.srcObject = stream
        mediaStreamRef.current = stream
        videoRef.current = video

        await video.play()
        setArLoading(false)
        setTimeout(() => {
          setIsFadingIn(true)
          if (video) {
            video.style.opacity = '1'
          }
        }, 100)
      } catch (err) {
        console.error('Erro ao configurar câmera:', err)
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

  // Caminhos das imagens
  const planetaImg = useMemo(() => normalizePath('assets/images/planeta1.png'), [normalizePath])
  const cadentedImg = useMemo(() => normalizePath('assets/images/cadented.png'), [normalizePath])
  const foguetecantoImg = useMemo(() => normalizePath('assets/images/foguetecanto.png'), [normalizePath])
  const solcantoImg = useMemo(() => normalizePath('assets/images/solcanto.png'), [normalizePath])
  const estrelatopo2Img = useMemo(() => normalizePath('assets/images/estrelatopo2.png'), [normalizePath])
  const btfotoImg = useMemo(() => normalizePath('assets/images/btfoto.png'), [normalizePath])

  // Função para capturar foto da tela com efeito de flash
  const capturePhoto = useCallback(async () => {
    try {
      playPhotoSound()
      setHidePhotoButton(true)
      // Espera a renderização remover o botão antes de capturar a tela
      await new Promise(resolve => setTimeout(resolve, 60))
      const video = videoRef.current
      if (!video) return

      // Sempre priorize retrato (portrait): swap largura/altura se necessário
      // Use o menor lado da view como largura para retrato, o maior como altura.
      // Ex: se largura > altura, canvas será altura x largura para forçar retrato.
      let canvasWidth = window.innerWidth
      let canvasHeight = window.innerHeight
      let rotateNeeded = false

      if (canvasWidth > canvasHeight) {
        // Em landscape: force retrato trocando largura/altura e marcando para rotacionar depois
        ;[canvasWidth, canvasHeight] = [canvasHeight, canvasWidth]
        rotateNeeded = true
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      const ctx = canvas.getContext('2d')

      if (!ctx) return

      // Desenhar vídeo no canvas (fundo)
      // Vamos desenhar para que a imagem fique corretamente em retrato
      let videoAspectRatio = (video.videoWidth || video.clientWidth) / (video.videoHeight || video.clientHeight)
      let canvasAspectRatio = canvas.width / canvas.height

      let drawWidth = canvas.width
      let drawHeight = canvas.height
      let drawX = 0
      let drawY = 0

      if (rotateNeeded) {
        // Em landscape: rotacionar os desenhos para salvar como retrato
        ctx.save()
        ctx.translate(canvasWidth / 2, canvasHeight / 2)
        ctx.rotate(-Math.PI / 2)
        // ajuste draw: swap width/height para retrato
        drawWidth = canvasHeight
        drawHeight = canvasWidth
        drawX = -canvasHeight / 2
        drawY = -canvasWidth / 2

        // Ajustar a imagem do vídeo para preencher o canvas em retrato corretamente
        let finalVideoDrawWidth = drawWidth
        let finalVideoDrawHeight = drawHeight
        if (videoAspectRatio > 1 / canvasAspectRatio) {
          finalVideoDrawHeight = drawWidth / videoAspectRatio
          finalVideoDrawWidth = drawWidth
          drawY += (drawHeight - finalVideoDrawHeight) / 2
        } else {
          finalVideoDrawWidth = drawHeight * videoAspectRatio
          finalVideoDrawHeight = drawHeight
          drawX += (drawWidth - finalVideoDrawWidth) / 2
        }
        ctx.drawImage(video, drawX, drawY, finalVideoDrawWidth, finalVideoDrawHeight)
      } else {
        // Normal portrait modo
        if (videoAspectRatio > canvasAspectRatio) {
          drawHeight = canvas.width / videoAspectRatio
          drawY = (canvas.height - drawHeight) / 2
        } else {
          drawWidth = canvas.height * videoAspectRatio
          drawX = (canvas.width - drawWidth) / 2
        }
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
      }

      // Capturar elementos sobrepostos (imagens) desenhando-as no canvas
      if (containerRef.current) {
        const images = containerRef.current.querySelectorAll('img')
        images.forEach((img) => {
          if (img.complete && img.naturalWidth > 0) {
            const rect = img.getBoundingClientRect()
            if (rotateNeeded) {
              // Rotacionar os overlays também
              ctx.save()
              ctx.translate(canvasWidth / 2, canvasHeight / 2)
              ctx.rotate(-Math.PI / 2)
              ctx.drawImage(
                img,
                rect.top,
                -window.innerWidth + rect.left,
                rect.height,
                rect.width
              )
              ctx.restore()
            } else {
              ctx.drawImage(img, rect.left, rect.top, rect.width, rect.height)
            }
          }
        })
      }

      if (rotateNeeded) {
        ctx.restore()
      }

      // Converter para blob e fazer download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `ar-photo-${Date.now()}.png`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)
        }
      }, 'image/png')

      // --- Flash/white fade-out animation + navegação ---
      setFlashWhite(true)
      // Duração do flash em ms (suficiente para fade-out visual)
      setTimeout(() => {
        // Após o flash terminar, navega para a tela coverScreen
        onNavigate('cover', 'fade', 'left')  // ou ajuste transition/direction se quiser
      }, 700)
    } catch (error) {
      console.error('Erro ao capturar foto:', error)
    }
  }, [onNavigate])

  return (
    <div 
      ref={containerRef}
      className={`ar-game-screen ${isFadingIn ? 'ar-screen-fade-in' : 'ar-screen-fade-out'}`}
    >
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

      {/* Container para todos os elementos 2D */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 10,
          pointerEvents: 'none'
        }}
      >
        {/* Planeta1 - Topo esquerdo (mesma posição que ARScreen1) */}
        <img
          src={planetaImg}
          alt="Planeta"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          draggable={false}
        />

        {/* Cadented - Canto superior direito */}
        <img
          src={cadentedImg}
          alt="Cadente"
          style={{
            position: 'absolute',
            top: '5vh',
            right: 0,
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          draggable={false}
        />

        {/* Foguetecanto - Canto inferior esquerdo */}
        <img
          src={foguetecantoImg}
          alt="Foguete Canto"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          draggable={false}
        />

        {/* Solcanto - Canto inferior direito */}
        <img
          src={solcantoImg}
          alt="Sol Canto"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          draggable={false}
        />

        {/* Estrelatopo2 - Um pouco acima do solcanto, com margem pequena do canto direito */}
        <img
          src={estrelatopo2Img}
          alt="Estrela Topo"
          style={{
            position: 'absolute',
            bottom: '15vh',
            right: '2vw',
            userSelect: 'none',
            pointerEvents: 'none'
          }}
          draggable={false}
        />

        {/* Botão btfoto - Canto inferior direito, com margem de 50px */}
        {!hidePhotoButton && (
          <img
            src={btfotoImg}
            alt="Botão Foto"
            onClick={capturePhoto}
            style={{
              position: 'absolute',
              bottom: '50px',
              right: '50px',
              cursor: 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none'
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Flash White Fade Animation */}
      {flashWhite && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'white',
            opacity: 1,
            zIndex: 9999,
            pointerEvents: 'none',
            animation: 'ar-flash-fadeout 0.7s ease-in both'
          }}
        />
      )}

      {/* Inclua a keyframes necessária de forma inline, mas convém adicionar ao seu CSS global */}
      <style>
        {`
          @keyframes ar-flash-fadeout {
            0% { opacity: 1; }
            55% { opacity: 1; }
            100% { opacity: 0; }
          }
        `}
      </style>
    </div>
  )
}
