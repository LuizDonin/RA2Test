// Inicialização global - roda ANTES do React
// Cria o vídeo UMA VEZ e compartilha entre todos

let globalVideo: HTMLVideoElement | null = null
let globalStream: MediaStream | null = null
let initPromise: Promise<void> | null = null

interface RAConfiguracoes {
    usarAFrame?: boolean
    usarVideo?: boolean
    usarFaceTracking?: boolean
    cameraFacing?: 'user' | 'environment'
}

// Carregar configurações do RA
async function loadRAConfig(): Promise<RAConfiguracoes> {
    try {
        const base = (import.meta as any)?.env?.BASE_URL || (document?.baseURI ? new URL(document.baseURI).pathname : '/')
        const b = base && base !== '/' ? (base.endsWith('/') ? base : base + '/') : '/'
        const url = `${b}assets/data/ra.json`
        const response = await fetch(url)

        if (!response.ok) {
            console.warn('Não foi possível carregar ra.json, usando configurações padrão')
            return { usarAFrame: true, usarVideo: true, usarFaceTracking: true }
        }

        const data = await response.json()
        return data.configuracoes || { usarAFrame: true, usarVideo: true, usarFaceTracking: true }
    } catch (err) {
        console.warn('Erro ao carregar configurações do RA, usando padrão:', err)
        return { usarAFrame: true, usarVideo: true, usarFaceTracking: true }
    }
}

export async function initializeGlobal(): Promise<void> {
    if (initPromise) return initPromise

    initPromise = (async () => {
        try {
            console.log('Iniciando inicialização global...')

            // Carregar configurações do RA
            const config = await loadRAConfig()
            console.log('Configurações do RA:', config)

            // 1. Aguardar e inicializar A-Frame se necessário
            if (config.usarAFrame !== false) {
                console.log('Aguardando A-Frame...')
                await waitForAFrame()
                console.log('A-Frame pronto')

                // Inicializar A-Frame Scene
                console.log('Inicializando A-Frame Scene...')
                await initializeAFrameScene()
                console.log('A-Frame Scene inicializado')

                // Configurar listener para quando o modal aparecer
                setupModalListener()
            } else {
                console.log('A-Frame desabilitado nas configurações')
            }

            // 2. Inicializar câmera se necessário
            if (config.usarVideo !== false) {
                console.log(`Inicializando câmera (${config.cameraFacing || 'user'})...`)
                await initializeGlobalCamera(config)
                console.log('Câmera inicializada')
            } else {
                console.log('Vídeo desabilitado nas configurações')
            }

            // 3. Carregar face-api.js se necessário
            if (config.usarFaceTracking !== false) {
                console.log('Carregando face-api.js...')
                await loadFaceApi()
                console.log('face-api.js carregado')
            } else {
                console.log('Face Tracking desabilitado nas configurações')
            }

            console.log('Inicialização global concluída')
        } catch (error) {
            console.error('Erro na inicialização global:', error)
            throw error
        }
    })()

    return initPromise
}

// Função para obter configurações
export async function getRAConfig(): Promise<RAConfiguracoes> {
    return loadRAConfig()
}

// Função para garantir que o modal seja clicável
function setupModalListener() {
    // Observar quando o modal aparecer
    const observer = new MutationObserver(() => {
        const modal = document.querySelector('.a-orientation-modal') ||
            document.querySelector('[class*="orientation-modal"]') ||
            document.querySelector('[class*="a-orientation"]') ||
            document.querySelector('[class*="permission"]')

        if (modal) {
            console.log('Modal detectado, garantindo que seja clicável...')


                // Garantir que o modal seja clicável
                ; (modal as HTMLElement).style.pointerEvents = 'auto'
                ; (modal as HTMLElement).style.zIndex = '2147483647'
                ; (modal as HTMLElement).style.position = 'fixed'
                ; (modal as HTMLElement).style.display = 'block'
                ; (modal as HTMLElement).style.visibility = 'visible'
                ; (modal as HTMLElement).style.opacity = '1'

            // Garantir que todos os filhos sejam clicáveis
            const allChildren = modal.querySelectorAll('*')
            allChildren.forEach((child) => {
                ; (child as HTMLElement).style.pointerEvents = 'auto'
            })

            // Garantir que botões sejam clicáveis
            const buttons = modal.querySelectorAll('button')
            buttons.forEach((button) => {
                button.style.pointerEvents = 'auto'
                button.style.cursor = 'pointer'
                button.style.zIndex = '2147483647'
                button.style.position = 'relative'
            })
        }
    })

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
    })

    // Verificar imediatamente
    setTimeout(() => {
        const modal = document.querySelector('.a-orientation-modal') ||
            document.querySelector('[class*="orientation-modal"]') ||
            document.querySelector('[class*="a-orientation"]')
        if (modal) {
            observer.disconnect()
            setupModalListener() // Reconfigurar
        }
    }, 1000)
}

function waitForAFrame(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && (window as any).AFRAME) {
            resolve()
            return
        }

        const checkAFrame = () => {
            if (typeof window !== 'undefined' && (window as any).AFRAME) {
                resolve()
            } else {
                setTimeout(checkAFrame, 100)
            }
        }
        checkAFrame()
    })
}

async function initializeGlobalCamera(config?: RAConfiguracoes): Promise<MediaStream | null> {
    try {
        // Se já existe vídeo e stream, reutilizar
        const existingVideo = document.getElementById('arjs-video') as HTMLVideoElement
        if (existingVideo && existingVideo.srcObject) {
            globalVideo = existingVideo
            globalStream = existingVideo.srcObject as MediaStream
            return globalStream
        }

        // Usar configuração do JSON ou padrão 'user' (câmera frontal)
        const facingMode = config?.cameraFacing || 'user'

        // Criar novo stream
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: { ideal: facingMode }
            },
            audio: false
        })

        // Criar vídeo se não existir
        if (!existingVideo) {
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
            video.style.display = 'none'
            video.style.visibility = 'hidden'
            video.style.opacity = '0'
            document.body.appendChild(video)
            globalVideo = video
        } else {
            globalVideo = existingVideo
        }

        globalVideo.srcObject = stream
        globalStream = stream
        await globalVideo.play()

        return stream
    } catch (err) {
        console.warn('Erro ao inicializar câmera global:', err)
        return null
    }
}

async function loadFaceApi(): Promise<void> {
    if ((window as any).faceapi) {
        return
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js'
        script.onload = () => {
            console.log('face-api.js carregado')
            resolve()
        }
        script.onerror = () => reject(new Error('Failed to load face-api.js'))
        document.head.appendChild(script)
    })
}

async function initializeAFrameScene(): Promise<void> {
    // Criar a-scene ANTES de tudo para inicializar A-Frame
    if (document.querySelector('a-scene')) {
        console.log('A-Frame Scene já existe')
        return
    }

    const scene = document.createElement('a-scene')
    scene.id = 'ar-scene-main'
    scene.setAttribute('embedded', 'true')
    scene.setAttribute('vr-mode-ui', 'enabled: false')
    scene.setAttribute('device-orientation-permission-ui', 'enabled: true')
    scene.setAttribute('renderer', 'alpha: true; antialias: true; colorManagement: true; physicallyCorrectLights: false; sortObjects: true; logarithmicDepthBuffer: false; precision: mediump;')
    scene.setAttribute('webxr', 'enabled: false')
    scene.setAttribute('background', 'transparent: true')
    scene.setAttribute('stats', 'false')

    // Apenas criar a estrutura mínima para inicializar o A-Frame
    // Skybox, câmera, luzes e objetos serão adicionados pelo ARScreen

    // Adicionar ao body (escondido inicialmente)
    scene.style.position = 'fixed'
    scene.style.top = '0'
    scene.style.left = '0'
    scene.style.width = '100%'
    scene.style.height = '100%'
    scene.style.zIndex = '-100' // A-Frame abaixo de tudo
    scene.style.background = 'transparent'
    document.body.appendChild(scene)

    // Aguardar A-Frame inicializar completamente
    await new Promise<void>((resolve) => {
        const checkReady = () => {
            const sceneEl = document.querySelector('a-scene') as any
            if (sceneEl && sceneEl.hasLoaded) {
                resolve()
            } else {
                setTimeout(checkReady, 100)
            }
        }
        checkReady()
    })

    console.log('A-Frame Scene criado e inicializado')
}

export function getGlobalVideo(): HTMLVideoElement | null {
    return globalVideo || (document.getElementById('arjs-video') as HTMLVideoElement)
}

export function getGlobalStream(): MediaStream | null {
    return globalStream || (getGlobalVideo()?.srcObject as MediaStream) || null
}

