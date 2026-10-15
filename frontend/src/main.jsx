import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import '@fontsource-variable/inter/index.css'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } })

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
