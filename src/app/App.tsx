import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'

import { Shell } from './components/Shell'
import { Spinner, ToastProvider } from './components/ui'
import { ApiError, useMe } from './lib/api'
import { Chat } from './pages/Chat'
import { Landing } from './pages/Landing'
import { Settings } from './pages/Settings'
import { SetupNeeded, SignIn } from './pages/SignIn'

const client = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } } })

function Gate() {
  const me = useMe()
  if (me.isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    )
  }
  if (me.error instanceof ApiError && me.error.status === 401) return <SignIn />
  if (me.error) return <SetupNeeded message={me.error.message} />
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route path="chat" element={<Chat />} />
        <Route path="c/:id" element={<Chat />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BrowserRouter>
          {/* The landing page is public; everything else sits behind the account gate. */}
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/*" element={<Gate />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
