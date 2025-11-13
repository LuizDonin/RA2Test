import React, { useEffect, useState, useRef, useCallback } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { LandscapeBlocker } from '../LandscapeBlocker'
import { playClickSound, playErrorSound, playSuccessSound } from '../../utils/soundUtils'
import '../../styles/quiz1screen.css'

interface Quiz1Props {
    onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
    title?: string
    subtitle?: string
    backgroundImage?: string
}

export const Quiz1: React.FC<Quiz1Props> = ({
    onNavigate
}) => {
    const [isMounted, setIsMounted] = useState(false)
    const [pelicanoScale, setPelicanoScale] = useState(1)
    const [isCorrectAnswer, setIsCorrectAnswer] = useState(false)
    const [showColoredPelicano, setShowColoredPelicano] = useState(false)
    const [showPelicanoTop, setShowPelicanoTop] = useState(false)
    const [pelicanoTopWidth, setPelicanoTopWidth] = useState<number | null>(null)
    const pelicanoTopImgRef = useRef<HTMLImageElement>(null)
    const quizSectionRef = useRef<HTMLDivElement>(null)
    const pelicanoImgRef = useRef<HTMLImageElement>(null)
    const pelicanoColoredImgRef = useRef<HTMLImageElement>(null)
    const pelicanoContainerRef = useRef<HTMLDivElement>(null)

    // Personalização: margem top (em relação ao quiz), margem bottom (em relação ao fundo da tela)
    const PELICANO_MARGIN_BOTTOM = 60   // px
    const PELICANO_MARGIN_TOP_MIN = 24  // px mínima acima do pelicano

    // Trigger das animações quando o componente monta
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsMounted(true)
        }, 100)
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
    const enunciadoImg = normalizePath('assets/images/enunciado1.png')
    const galinhaImg = normalizePath('assets/images/Galinha.png')
    const macacoImg = normalizePath('assets/images/Macaco.png')
    const pelicanoRImg = normalizePath('assets/images/PelicanoR.png')
    const pelicanoImg = normalizePath('assets/images/pelicano.png')
    const pelicanoColoredImg = normalizePath('assets/images/pelicanocor.png')
    const pelicanoTopImg = normalizePath('assets/images/pelicanotop.png')
    const bgCapaImg = normalizePath('assets/images/bg-capa.png')

    // Handler para respostas
    const handleResposta = (opcao: string) => {
        playClickSound()
        
        if (opcao === 'PelicanoR') {
            playSuccessSound()
            setIsCorrectAnswer(true)
            setTimeout(() => {
                setShowColoredPelicano(true)
                setShowPelicanoTop(true)
            }, 1200)
            setTimeout(() => {
                onNavigate('ar2', 'fade', 'right')
            }, 3000)
        } else {
            playErrorSound()
        }
    }

    // Função para calcular e ajustar o scale do pelicano considerando as margens
    const adjustPelicanoScale = useCallback(() => {
        if (!quizSectionRef.current || !pelicanoImgRef.current || !pelicanoContainerRef.current) {
            return
        }

        const quizRect = quizSectionRef.current.getBoundingClientRect()
        const pelicanoImg = pelicanoImgRef.current
        const pelicanoRect = pelicanoImg.getBoundingClientRect()
        const winHeight = window.innerHeight

        // Pelicano: quer-se ele com margem bottom, e com margem top em relação ao quiz (enunciado/opções)
        // Limites:
        //  - topo do pelicano >= quizSection.bottom + PELICANO_MARGIN_TOP_MIN
        //  - baixo do pelicano <= winHeight - PELICANO_MARGIN_BOTTOM

        // Uso naturalHeight sempre que possível
        const naturalHeight = pelicanoImg.naturalHeight || pelicanoRect.height || 1

        // Máxima altura possível: entre quizSection.bottom+marginTop e window.innerHeight-marginBottom
        const topLimit = quizRect.bottom + PELICANO_MARGIN_TOP_MIN
        const bottomLimit = winHeight - PELICANO_MARGIN_BOTTOM
        const availableHeight = bottomLimit - topLimit

        // scale nunca deve ser maior que 1, e nunca menor que 0.3 pra não sumir
        let newScale = 1

        if (pelicanoImg && availableHeight > 0) {
            if (naturalHeight > availableHeight) {
                // Precisa escalar para caber
                newScale = Math.max(availableHeight / naturalHeight, 0.3)
            } else {
                newScale = 1
            }
        }
        setPelicanoScale(newScale)
    }, [])

    // Sincronizar dimensões do pelicano colorido com o original
    useEffect(() => {
        const syncPelicanoDimensions = () => {
            if (pelicanoImgRef.current && pelicanoColoredImgRef.current) {
                const original = pelicanoImgRef.current
                const colored = pelicanoColoredImgRef.current

                const width = original.offsetWidth || original.naturalWidth
                const height = original.offsetHeight || original.naturalHeight

                if (width > 0 && height > 0) {
                    colored.style.width = width + 'px'
                    colored.style.height = height + 'px'
                }
            }
        }

        const originalImg = pelicanoImgRef.current
        const coloredImg = pelicanoColoredImgRef.current

        if (originalImg) {
            if (originalImg.complete) {
                setTimeout(syncPelicanoDimensions, 100)
            } else {
                originalImg.addEventListener('load', () => {
                    setTimeout(syncPelicanoDimensions, 100)
                })
            }
        }

        if (coloredImg) {
            if (coloredImg.complete) {
                setTimeout(syncPelicanoDimensions, 100)
            } else {
                coloredImg.addEventListener('load', () => {
                    setTimeout(syncPelicanoDimensions, 100)
                })
            }
        }

        if (isCorrectAnswer) {
            setTimeout(syncPelicanoDimensions, 100)
            setTimeout(syncPelicanoDimensions, 850)
        }
        if (showColoredPelicano) {
            setTimeout(syncPelicanoDimensions, 50)
        }

        return () => {
            if (originalImg) {
                originalImg.removeEventListener('load', syncPelicanoDimensions)
            }
            if (coloredImg) {
                coloredImg.removeEventListener('load', syncPelicanoDimensions)
            }
        }
    }, [isMounted, isCorrectAnswer, showColoredPelicano])

    // Monitorar mudanças de tamanho e ajustar scale
    useEffect(() => {
        if (!isMounted) return

        const pelicanoImg = pelicanoImgRef.current
        if (pelicanoImg) {
            if (pelicanoImg.complete) {
                adjustPelicanoScale()
            } else {
                pelicanoImg.addEventListener('load', adjustPelicanoScale)
            }
        }

        const handleResize = () => {
            setTimeout(adjustPelicanoScale, 100)
        }
        window.addEventListener('resize', handleResize)
        window.addEventListener('orientationchange', handleResize)

        const resizeObserver = new ResizeObserver(() => {
            setTimeout(adjustPelicanoScale, 50)
        })

        if (quizSectionRef.current) {
            resizeObserver.observe(quizSectionRef.current)
        }
        if (pelicanoContainerRef.current) {
            resizeObserver.observe(pelicanoContainerRef.current)
        }
        if (pelicanoImgRef.current) {
            resizeObserver.observe(pelicanoImgRef.current)
        }

        return () => {
            window.removeEventListener('resize', handleResize)
            window.removeEventListener('orientationchange', handleResize)
            if (pelicanoImg) {
                pelicanoImg.removeEventListener('load', adjustPelicanoScale)
            }
            resizeObserver.disconnect()
        }
    }, [isMounted, adjustPelicanoScale])

    // ---- PEICANO TOP FIX: garantir 100% centralização no topo -----
    useEffect(() => {
        if (showPelicanoTop) {
            const setWidth = () => {
                if (pelicanoTopImgRef.current) {
                    setPelicanoTopWidth(pelicanoTopImgRef.current.offsetWidth)
                }
            }
            setWidth()
            window.addEventListener('resize', setWidth)
            return () => {
                window.removeEventListener('resize', setWidth)
            }
        }
    }, [showPelicanoTop])

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
            {/* Pelicano Top - aparece no topo após centralização */}
            {showPelicanoTop && (
                <img
                    ref={pelicanoTopImgRef}
                    src={pelicanoTopImg}
                    alt="Pelicano Top"
                    className="quiz1-pelicano-top"
                    style={{
                        position: 'fixed',
                        top: 20,
                        left: '50%',
                        zIndex: 20,
                        pointerEvents: 'none',
                        transform: pelicanoTopWidth
                            ? `translateX(-50%)`
                            : 'translateX(-50%)',
                    }}
                />
            )}

            {/* Seção do Quiz - não ocupa altura fixa, permite crescer menos para sobrar espaço pro pelicano sempre */}
            <div
                ref={quizSectionRef}
                className={`quiz1-quiz-section ${isCorrectAnswer ? 'quiz1-quiz-exit' : ''}`}
                style={{
                    // Não usa mais 65% de flex. Usa paddingBottom generoso para espaço visual com o pelicano
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    paddingTop: 'clamp(20px, 4vh, 40px)',
                    paddingBottom: `${PELICANO_MARGIN_TOP_MIN + 32}px`, // espaço extra p/ pelicano acima
                    minHeight: '200px',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    pointerEvents: isCorrectAnswer ? 'none' : 'auto',
                    flex: 1
                }}
            >
                {/* Enunciado no topo */}
                <div 
                    className={
                        !isMounted ? 'quiz1-enunciado-initial' :
                        isCorrectAnswer ? 'quiz1-enunciado-exit' :
                        'quiz1-enunciado'
                    }
                    style={{ 
                        width: '90%', 
                        maxWidth: '500px',
                        marginBottom: 'clamp(16px, 3vh, 26px)'
                    }}
                >
                    <img
                        src={enunciadoImg}
                        alt="Enunciado"
                        style={{
                            display: 'block',
                            margin: '0 auto',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.07)'
                        }}
                    />
                </div>

                {/* Opções */}
                <div
                    className={`quiz1-options-wrapper ${isCorrectAnswer ? 'quiz1-options-exit' : ''}`}
                    style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'flex-start',
                        gap: 'clamp(16px, 2.5vh, 26px)',
                        width: '100%',
                        padding: '0 5%'
                    }}
                >
                {/* Galinha */}
                <button
                    type="button"
                    className={
                        !isMounted ? 'quiz1-option-initial' :
                        isCorrectAnswer ? 'quiz1-option-exit' :
                        'quiz1-option'
                    }
                    onClick={() => handleResposta('Galinha')}
                    disabled={isCorrectAnswer}
                    style={{
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        width: '100%',
                        maxWidth: 'min(270px, 85vw)'
                    }}
                >
                    <img
                        src={galinhaImg}
                        alt="Galinha"
                        style={{
                            borderRadius: 18,
                            boxShadow: '0 3px 12px rgba(40,40,40,0.07)'
                        }}
                    />
                </button>
                {/* Macaco */}
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
                        cursor: 'pointer',
                        padding: 0,
                        width: '100%',
                        maxWidth: 'min(270px, 85vw)'
                    }}
                >
                    <img
                        src={macacoImg}
                        alt="Macaco"
                        style={{
                            borderRadius: 18,
                            boxShadow: '0 3px 12px rgba(40,40,40,0.07)'
                        }}
                    />
                </button>
                {/* PelicanoR (correta) */}
                <button
                    type="button"
                    className={
                        !isMounted ? 'quiz1-option-initial' :
                        isCorrectAnswer ? 'quiz1-option-exit' :
                        'quiz1-option'
                    }
                    onClick={() => handleResposta('PelicanoR')}
                    disabled={isCorrectAnswer}
                    style={{
                        background: 'none',
                        border: 'none',
                        outline: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        width: '100%',
                        maxWidth: 'min(270px, 85vw)'
                    }}
                >
                    <img
                        src={pelicanoRImg}
                        alt="Pelicano"
                        style={{
                            borderRadius: 18,
                            boxShadow: '0 3px 12px rgba(40,40,40,0.07)'
                        }}
                    />
                </button>
                </div>
            </div>

            {/* Mascote Pelicano - alinhado ao fundo com marginBottom, e sempre com margem top mínima para o quiz */}
            <div
                ref={pelicanoContainerRef}
                className={
                    !isMounted ? 'quiz1-pelicano-mascote-initial' :
                    isCorrectAnswer ? 'quiz1-pelicano-mascote quiz1-pelicano-center' :
                    'quiz1-pelicano-mascote'
                }
                style={{
                    position: 'fixed',
                    left: 0,
                    right: 0,
                    // bottom respeita a margem definida
                    bottom: `${PELICANO_MARGIN_BOTTOM}px`,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    zIndex: isCorrectAnswer ? 10 : 1,
                    pointerEvents: 'none',
                    background: 'none',
                    height: 'auto',
                    width: '100%',
                }}
            >
                <div style={{ position: 'relative', display: 'inline-block', background: 'none' }}>
                    <img
                        ref={pelicanoImgRef}
                        src={pelicanoImg}
                        alt="Pelicano Mascote"
                        className={isCorrectAnswer ? 'quiz1-pelicano-img-center' : ''}
                        style={{
                            // Aplica o scale controlado dinamicamente
                            transform: isCorrectAnswer ? `scale(${pelicanoScale})` : `scale(${pelicanoScale})`,
                            transformOrigin: 'center bottom',
                            transition: 'transform 0.75s cubic-bezier(.4,2,.67,.99), opacity 0.75s, filter .3s',
                            display: 'block',
                            verticalAlign: 'bottom'
                        }}
                    />
                    {/* Pelicano colorido sobreposto */}
                    <img
                        ref={pelicanoColoredImgRef}
                        src={pelicanoColoredImg}
                        alt="Pelicano Colorido"
                        className={showColoredPelicano ? 'quiz1-pelicano-colored-fade-in' : 'quiz1-pelicano-colored-hidden'}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            objectPosition: 'center',
                            transform: isCorrectAnswer ? `scale(${pelicanoScale})` : `scale(${pelicanoScale})`,
                            transformOrigin: 'center bottom',
                            pointerEvents: 'none',
                            transition: 'transform 0.75s cubic-bezier(.4,2,.67,.99), opacity 1.2s',
                            width: '100%',
                            height: '100%'
                        }}
                    />
                </div>
            </div>
        </div>
        </>
    )
}

export default Quiz1
