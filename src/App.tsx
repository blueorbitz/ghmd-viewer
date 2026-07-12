import { ThemeProvider } from '@/components/ThemeProvider'
import { MermaidProvider } from '@/components/MermaidProvider'
import { useHashRouter } from '@/hooks/useHashRouter'
import { InputView } from '@/views/InputView'
import { ReaderView } from '@/views/ReaderView'
import { OAuthCallbackView } from '@/views/OAuthCallbackView'
import { SharePassphrasePrompt } from '@/views/SharePassphrasePrompt'

function AppRouter() {
  const route = useHashRouter()

  switch (route.type) {
    case 'input':
      return <InputView />
    case 'reader':
      return <ReaderView state={route.state} />
    case 'oauth-callback':
      return <OAuthCallbackView params={route.params} />
    case 'share':
      return <SharePassphrasePrompt payload={route.payload} />
  }
}

function App() {
  return (
    <ThemeProvider>
      <MermaidProvider>
        <div className="min-h-screen bg-background text-foreground">
          <AppRouter />
        </div>
      </MermaidProvider>
    </ThemeProvider>
  )
}

export default App
