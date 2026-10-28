import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { googleLabsTheme } from './lib/theme'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={googleLabsTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
