import { createTheme } from '@mui/material/styles'

/**
 * Google Material Design 3 (Material You / Google Labs) Theme Configuration
 * Authentic Google dark theme tokens:
 * - Surface: #131314 (Darkest surface)
 * - Surface Container: #1e1f20 (Elevated card background)
 * - Surface Container High: #282a2c
 * - Primary: Google Blue 200 #a8c7fa
 * - Secondary: Google Blue 100 #c2e7ff
 * - Outline: #444746
 * - Text Primary: #e3e3e3
 * - Text Secondary: #c4c7c5
 * - Radius: 28px/32px for squircle cards, 9999px for pills
 */
export const googleLabsTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#a8c7fa', // Google Blue 200
      light: '#c2e7ff',
      dark: '#004a77',
      contrastText: '#041e49'
    },
    secondary: {
      main: '#c2e7ff',
      light: '#d3e3fd',
      dark: '#003355',
      contrastText: '#001d32'
    },
    background: {
      default: '#131314', // Google Labs deep canvas
      paper: '#1e1f20' // Google Labs surface container
    },
    text: {
      primary: '#e3e3e3',
      secondary: '#c4c7c5',
      disabled: '#8e918f'
    },
    divider: 'rgba(255, 255, 255, 0.08)',
    error: {
      main: '#f2b8b5',
      light: '#f9dedc',
      dark: '#601410',
      contrastText: '#601410'
    },
    warning: {
      main: '#fbbc04',
      light: '#ffe082',
      dark: '#5c3e00'
    },
    success: {
      main: '#34a853',
      light: '#c4eed0',
      dark: '#0f5223'
    }
  },
  typography: {
    fontFamily: [
      'Plus Jakarta Sans',
      'Outfit',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'sans-serif'
    ].join(','),
    h1: {
      fontFamily: 'Outfit, Plus Jakarta Sans, sans-serif',
      fontWeight: 700
    },
    h2: {
      fontFamily: 'Outfit, Plus Jakarta Sans, sans-serif',
      fontWeight: 700
    },
    h3: {
      fontFamily: 'Outfit, Plus Jakarta Sans, sans-serif',
      fontWeight: 700
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 24
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: '#1e1f20',
          borderRadius: 28,
          border: '1px solid rgba(255, 255, 255, 0.07)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.45)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 9999, // Pill shape
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)'
        },
        contained: {
          backgroundColor: '#a8c7fa',
          color: '#041e49',
          boxShadow: '0 2px 8px rgba(168, 199, 250, 0.25)',
          '&:hover': {
            backgroundColor: '#c2e7ff',
            boxShadow: '0 4px 16px rgba(168, 199, 250, 0.4)'
          }
        },
        outlined: {
          borderColor: '#444746',
          color: '#e3e3e3',
          '&:hover': {
            borderColor: '#a8c7fa',
            backgroundColor: 'rgba(168, 199, 250, 0.08)'
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 9999,
          fontWeight: 500,
          border: '1px solid #444746'
        }
      }
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 9999, // Pill search/input
          backgroundColor: '#282a2c',
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: '#444746'
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: '#a8c7fa'
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#a8c7fa',
            borderWidth: 2
          }
        }
      }
    }
  }
})

export default googleLabsTheme
