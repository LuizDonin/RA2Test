import React from 'react'
import { ScreenManager } from './components/ScreenManager'
import { RAProvider } from './contexts/RAContext'
import { LandscapeBlocker } from './components/LandscapeBlocker'
import './App.css'

function App() {
  const appConfig = {
    title: 'Realidade Aumentada',
    subtitle: 'Explore o mundo em 3D',
    version: '1.0.0',
    developer: 'AR Developer'
  }

  return (
    <RAProvider>
      <div className="ar-app">
        
        <ScreenManager
          initialScreen="loading"
          appConfig={appConfig}
        />
      </div>
    </RAProvider>
  )
}

export default App
