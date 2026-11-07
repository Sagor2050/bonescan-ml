import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { showFailedEmailLink } from './account/emailLink.ts'
import App from './App.tsx'

showFailedEmailLink()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
