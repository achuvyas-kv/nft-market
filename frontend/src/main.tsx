// Polyfills for browser compatibility
import { Buffer } from 'buffer'
import process from 'process'

// Make global variables available
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis
}
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer
}
if (typeof (globalThis as any).process === 'undefined') {
  (globalThis as any).process = process
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
