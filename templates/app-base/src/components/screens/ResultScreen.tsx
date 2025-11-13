import React, { useState } from 'react'
import type { ScreenType, TransitionType, TransitionDirection } from '../../types/screens'
import { playClickSound } from '../../utils/soundUtils'
import '../../styles/result-screen.css'

interface ResultScreenProps {
    onNavigate: (screen: ScreenType, transition?: TransitionType, direction?: TransitionDirection) => void
    title?: string
    subtitle?: string
    backgroundImage?: string
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
    onNavigate
}) => {
    const [clickedEmoji, setClickedEmoji] = useState<string | null>(null)

    // Get base URL
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

    const images = {
        bgCapa: normalizePath('assets/images/bg-capa.png'),
        parabens: normalizePath('assets/images/parabens.png'),
        modalfinal: normalizePath('assets/images/modalfinal.png'),
        emoji1: normalizePath('assets/images/emoji1.png'),
        emoji2: normalizePath('assets/images/emoji2.png'),
        emoji3: normalizePath('assets/images/emoji3.png')
    }

    const handleEmojiClick = (emojiId: string) => {
        playClickSound()
        setClickedEmoji(emojiId)
        // Após a animação de scale, navegar para CoverScreen
        setTimeout(() => {
            onNavigate('cover', 'zoom-in', 'left')
        }, 400)
    }

    return (
        <div
            className="result-screen"
            style={{
                backgroundImage: `url("${images.bgCapa}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100vw',
                height: '100vh',
                padding: '20px',
                boxSizing: 'border-box'
            }}
        >
            {/* Imagem "parabens" no topo */}
            <img
                src={images.parabens}
                alt="Parabéns"
                style={{
                    marginBottom: '20px',
                    marginTop: '20px'
                }}
            />

            {/* Imagem "modalfinal" no centro */}
            <img
                src={images.modalfinal}
                alt="Modal Final"
                style={{
                    marginBottom: '40px' // aumentado para dar mais espaço acima dos emojis
                }}
            />

            {/* 3 emojis alinhados horizontalmente, com margem inferior para afastar do rodapé */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    width: '100%',
                    maxWidth: '600px',
                    marginBottom: '100px' // espaço extra abaixo dos emojis
                }}
            >
                <button
                    onClick={() => handleEmojiClick('emoji1')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        transform: clickedEmoji === 'emoji1' ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                >
                    <img
                        src={images.emoji1}
                        alt="Emoji 1"
                        style={{
                            // sem restrição de tamanho
                        }}
                    />
                </button>

                <button
                    onClick={() => handleEmojiClick('emoji2')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        transform: clickedEmoji === 'emoji2' ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                >
                    <img
                        src={images.emoji2}
                        alt="Emoji 2"
                        style={{
                            // sem restrição de tamanho
                        }}
                    />
                </button>

                <button
                    onClick={() => handleEmojiClick('emoji3')}
                    style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        transform: clickedEmoji === 'emoji3' ? 'scale(1.1)' : 'scale(1)',
                        transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }}
                >
                    <img
                        src={images.emoji3}
                        alt="Emoji 3"
                        style={{
                            // sem restrição de tamanho
                        }}
                    />
                </button>
            </div>
        </div>
    )
}
