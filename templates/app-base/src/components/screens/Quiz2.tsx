import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { playClickSound, playErrorSound, playSuccessSound } from '../../utils/soundUtils'
import '../../styles/quiz1screen.css'

interface Quiz2Props {
    onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
    title?: string
    subtitle?: string
    backgroundImage?: string
}

export const Quiz2: React.FC<Quiz2Props> = ({
    onNavigate
}) => {
    const [isMounted, setIsMounted] = useState(false)
    const [macacoScale, setMacacoScale] = useState(1)
    const [isCorrectAnswer, setIsCorrectAnswer] = useState(false)
    const [showColoredMacaco, setShowColoredMacaco] = useState(false)
    const [showMacacoTop, setShowMacacoTop] = useState(false)
    const quizSectionRef = useRef<HTMLDivElement>(null)
    const macacoImgRef = useRef<HTMLImageElement>(null)
    const macacoColoredImgRef = useRef<HTMLImageElement>(null)
    const macacoContainerRef = useRef<HTMLDivElement>(null)

    // Trigger das animações quando o componente monta
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMounted(true)
        }, 40) // igual Quiz1
        return () => clearTimeout(timer)
    }, [])

    // Função para obter baseUrl (copiada do RocketScreen)
    const getBaseUrl = () => {
        const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
        const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
        return b === '/' ? '' : b.endsWith('/') ? b.slice(0, -1) : b
    }
    const baseUrl = getBaseUrl()
    const normalizePath = (path: string) => {
        if (baseUrl === '') {
            return path.startsWith('/') ? path : `/${path}`
        }
        const cleanPath = path.startsWith('/') ? path.slice(1) : path
        return `${baseUrl}/${cleanPath}`
    }

    // Imagens
    const enunciadoImg = normalizePath('assets/images/enunciado2.png')
    const vacaImg = normalizePath('assets/images/Vaca.png')
    const macacoImg = normalizePath('assets/images/Macaco.png')
    const sabiaImg = normalizePath('assets/images/Sabia.png')
    const macaco1Img = normalizePath('assets/images/macaco1.png')
    const macacoColoredImg = normalizePath('assets/images/macacocor.png')
    const macacoTopImg = normalizePath('assets/images/macacotop.png')
    const bgCapaImg = normalizePath('assets/images/bg-capa.png')

    const handleResposta = (opcao: string) => {
        playClickSound()
        
        if (opcao === 'Macaco') {
            playSuccessSound()
            setIsCorrectAnswer(true)
            setTimeout(() => {
                setShowColoredMacaco(true)
                setShowMacacoTop(true)
            }, 1050)
            setTimeout(() => {
                onNavigate('resultado', 'fade', 'right')
            }, 2700)
        } else {
            playErrorSound()
        }
    }

    // Anim/scale igual a Quiz1: recalcula na montagem e em resize
    const adjustMacacoScale = useCallback(() => {
        if (!quizSectionRef.current || !macacoImgRef.current || !macacoContainerRef.current) {
            return
        }
        const quizSection = quizSectionRef.current
        const macacoImg = macacoImgRef.current
        const macacoContainer = macacoContainerRef.current
        const quizRect = quizSection.getBoundingClientRect()
        const macacoRect = macacoImg.getBoundingClientRect()
        const containerRect = macacoContainer.getBoundingClientRect()
        const macacoTop = macacoRect.top
        const quizBottom = quizRect.bottom
        if (macacoTop < quizBottom) {
            const overlap = quizBottom - macacoTop
            const macacoHeight = macacoRect.height || 1
            const scaleReduction = Math.max(0.3, Math.min(1, 1 - (overlap / macacoHeight)))
            setMacacoScale(scaleReduction)
        } else {
            const availableHeight = containerRect.height
            const naturalHeight = macacoImg.naturalHeight || macacoRect.height || availableHeight
            if (naturalHeight > availableHeight && availableHeight > 0) {
                const maxScale = availableHeight / naturalHeight
                setMacacoScale(Math.min(1, maxScale))
            } else {
                setMacacoScale(1)
            }
        }
    }, [])

    // Mantém sincronia dimensões do mascote colorido
    useEffect(() => {
        const syncMacacoDimensions = () => {
            if (macacoImgRef.current && macacoColoredImgRef.current) {
                const original = macacoImgRef.current
                const colored = macacoColoredImgRef.current
                const width = original.offsetWidth || original.naturalWidth
                const height = original.offsetHeight || original.naturalHeight
                if (width > 0 && height > 0) {
                    colored.style.width = width + 'px'
                    colored.style.height = height + 'px'
                }
            }
        }
        const originalImg = macacoImgRef.current
        const coloredImg = macacoColoredImgRef.current
        if (originalImg) {
            if (originalImg.complete) {
                setTimeout(syncMacacoDimensions, 60)
            } else {
                originalImg.addEventListener('load', () => {
                    setTimeout(syncMacacoDimensions, 60)
                })
            }
        }
        if (coloredImg) {
            if (coloredImg.complete) {
                setTimeout(syncMacacoDimensions, 60)
            } else {
                coloredImg.addEventListener('load', () => {
                    setTimeout(syncMacacoDimensions, 60)
                })
            }
        }
        if (isCorrectAnswer) {
            setTimeout(syncMacacoDimensions, 90)
            setTimeout(syncMacacoDimensions, 650)
        }
        if (showColoredMacaco) {
            setTimeout(syncMacacoDimensions, 25)
        }
        return () => {
            if (originalImg) {
                originalImg.removeEventListener('load', syncMacacoDimensions)
            }
            if (coloredImg) {
                coloredImg.removeEventListener('load', syncMacacoDimensions)
            }
        }
    }, [isMounted, isCorrectAnswer, showColoredMacaco])

    useEffect(() => {
        if (!isMounted) return
        const macacoImg = macacoImgRef.current
        if (macacoImg) {
            if (macacoImg.complete) {
                adjustMacacoScale()
            } else {
                macacoImg.addEventListener('load', adjustMacacoScale)
            }
        }
        const handleResize = () => {
            setTimeout(adjustMacacoScale, 60)
        }
        window.addEventListener('resize', handleResize)
        window.addEventListener('orientationchange', handleResize)
        const resizeObserver = new ResizeObserver(() => {
            setTimeout(adjustMacacoScale, 30)
        })
        if (quizSectionRef.current) {
            resizeObserver.observe(quizSectionRef.current)
        }
        if (macacoContainerRef.current) {
            resizeObserver.observe(macacoContainerRef.current)
        }
        if (macacoImgRef.current) {
            resizeObserver.observe(macacoImgRef.current)
        }
        return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('orientationchange', handleResize)
            if (macacoImg) {
                macacoImg.removeEventListener('load', adjustMacacoScale)
            }
            resizeObserver.disconnect()
        }
    }, [isMounted, adjustMacacoScale])

    return (
        <>
            <LandscapeBlocker />
            <div
                className="quiz1-container"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100vh',
                    width: '100vw',
                    backgroundImage: `url("${bgCapaImg}")`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: 0,
                    margin: 0
                }}
            >
            {/* Mascote no topo igual quiz1 */}
            {showMacacoTop && (
                <img
                    src={macacoTopImg}
                    alt="Macaco Top"
                    className="quiz1-pelicano-top"
                    style={{
                        position: 'fixed',
                        top: 20,
                        left: '50%',
                        zIndex: 21,
                        pointerEvents: 'none'
                        // Não definir transform aqui - deixar o CSS controlar a animação
                    }}
                />
            )}

            {/* Mascote na base igual quiz1 */}
            <div
                ref={macacoContainerRef}
                className={
                    !isMounted ? 'quiz1-pelicano-mascote-initial' :
                    isCorrectAnswer ? 'quiz1-pelicano-mascote quiz1-pelicano-center' :
                    'quiz1-pelicano-mascote'
                }
                style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: '210px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    zIndex: 9,
                    pointerEvents: 'none'
                }}
            >
                <div style={{ position: 'relative', display: 'inline-block', height: '210px' }}>
                    <img
                        ref={macacoImgRef}
                        src={macaco1Img}
                        alt="Macaco Mascote"
                        className={isCorrectAnswer ? 'quiz1-pelicano-img-center' : ''}
                        style={{
                            // rewrite: O scale final do macaco (e macacocor) está diferente, volte como estava antes
                            // Return to classic Quiz1: final scale on acerto was 1.16 (não 1.09)
                            transform: isCorrectAnswer ? 'scale(1)' : `scale(${macacoScale * 1.01})`,
                            transformOrigin: 'center bottom',
                            transition: isCorrectAnswer ? 'transform 1s cubic-bezier(.82,.06,.53,.82)' : 'transform 0.22s cubic-bezier(.82,.06,.53,.82)',
                            display: 'block',
                            verticalAlign: 'bottom',
                            userSelect: 'none',
                            height: '192px',
                            width: 'auto'
                        }}
                    />
                    {/* Mascote colorido sobreposto */}
                    <img
                        ref={macacoColoredImgRef}
                        src={macacoColoredImg}
                        alt="Macaco Colorido"
                        className={showColoredMacaco ? 'quiz1-pelicano-colored-fade-in' : 'quiz1-pelicano-colored-hidden'}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            objectPosition: 'center bottom',
                            pointerEvents: 'none',
                            // O scale final do macacocor também deve ser 1.16 (não 1.09)
                            transform: isCorrectAnswer ? 'scale(1.16)' : `scale(${macacoScale * 1.01})`,
                            transformOrigin: 'center bottom',
                            transition: 'transform 1s cubic-bezier(.82,.06,.53,.82), opacity 0.6s 0.1s',
                            userSelect: 'none',
                            height: '192px',
                            width: 'auto'
                        }}
                    />
                </div>
            </div>

            {/* Seção Quiz sobreposta visualmente igual quiz1 */}
            <div
                ref={quizSectionRef}
                className={`quiz1-quiz-section${isCorrectAnswer ? ' quiz1-quiz-exit' : ''}`}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    width: '100%',
                    paddingTop: '38px',
                    paddingBottom: '12px',
                    pointerEvents: isCorrectAnswer ? 'none' : 'auto',
                    position: 'relative',
                    zIndex: 10
                }}
            >
                {/* Enunciado igual quiz1 */}
                <div 
                    className={
                        !isMounted ? 'quiz1-enunciado-initial' :
                        isCorrectAnswer ? 'quiz1-enunciado-exit' :
                        'quiz1-enunciado'
                    }
                    style={{ 
                        width: '93%', 
                        maxWidth: '490px',
                        marginBottom: 'clamp(12px, 5vw, 32px)'
                    }}
                >
                    <img
                        src={enunciadoImg}
                        alt="Enunciado"
                        style={{
                            display: 'block',
                            margin: '0 auto',
                            boxShadow: '0 2px 14px rgba(0,0,0,0.09)'
                        }}
                    />
                </div>

                {/* Opções igual Quiz1 */}
                <div
                    className={`quiz1-options-wrapper${isCorrectAnswer ? ' quiz1-options-exit' : ''}`}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 'clamp(18px, 2.8vh, 28px)',
                        width: '100%',
                        padding: '0 3.5%',
                        marginBottom: 0,
                        marginTop: 'min(2vw,18px)'
                    }}
                >
                    {/* Vaca */}
                    <button
                        type="button"
                        className={
                            !isMounted ? 'quiz1-option-initial' :
                            isCorrectAnswer ? 'quiz1-option-exit' :
                            'quiz1-option'
                        }
                        onClick={() => handleResposta('Vaca')}
                        disabled={isCorrectAnswer}
                        style={{
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            cursor: isCorrectAnswer ? 'default' : 'pointer',
                            padding: 0,
                            width: '100%',
                            maxWidth: 'min(240px, 85vw)',
                            boxShadow: '0 3px 13px rgba(40,40,40,0.08)'
                        }}
                    >
                        <img
                            src={vacaImg}
                            alt="Vaca"
                            style={{
                                borderRadius: 16,
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                            }}
                        />
                    </button>
                    {/* Macaco (correta) */}
                    <button
                        type="button"
                        className={
                            !isMounted ? 'quiz1-option-initial' :
                            isCorrectAnswer ? 'quiz1-option-exit' :
                            'quiz1-option'
                        }
                        onClick={() => handleResposta('Macaco')}
                        disabled={isCorrectAnswer}
                        style={{
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            cursor: isCorrectAnswer ? 'default' : 'pointer',
                            padding: 0,
                            width: '100%',
                            maxWidth: 'min(240px, 85vw)',
                            boxShadow: '0 3px 13px rgba(40,40,40,0.08)'
                        }}
                    >
                        <img
                            src={macacoImg}
                            alt="Macaco"
                            style={{
                                borderRadius: 16,
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                            }}
                        />
                    </button>
                    {/* Sabia */}
                    <button
                        type="button"
                        className={
                            !isMounted ? 'quiz1-option-initial' :
                            isCorrectAnswer ? 'quiz1-option-exit' :
                            'quiz1-option'
                        }
                        onClick={() => handleResposta('Sabia')}
                        disabled={isCorrectAnswer}
                        style={{
                            background: 'none',
                            border: 'none',
                            outline: 'none',
                            cursor: isCorrectAnswer ? 'default' : 'pointer',
                            padding: 0,
                            width: '100%',
                            maxWidth: 'min(240px, 85vw)',
                            boxShadow: '0 3px 13px rgba(40,40,40,0.08)'
                        }}
                    >
                        <img
                            src={sabiaImg}
                            alt="Sabia"
                            style={{
                                borderRadius: 16,
                                width: '100%',
                                height: 'auto',
                                display: 'block'
                            }}
                        />
                    </button>
                </div>
            </div>
        </div>
        </>
    )
}

export default Quiz2

