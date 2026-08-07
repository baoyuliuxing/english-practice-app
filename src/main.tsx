import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

function ErrorFallback() {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0f172a', color: '#e2e8f0', padding: '2rem', fontFamily: 'system-ui'
    }}>
      <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>😵</p>
      <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>应用加载失败</p>
      <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', maxWidth: '280px', lineHeight: 1.6 }}>
        可能是浏览器兼容性问题或缓存导致。<br />
        请尝试刷新页面或清除浏览器缓存后重试。
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '1.5rem', padding: '0.6rem 2rem',
          borderRadius: '1rem', border: 'none',
          background: '#6366f1', color: 'white',
          fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer'
        }}
      >
        刷新页面
      </button>
    </div>
  )
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error: Error) {
    console.error('App crashed:', error)
  }
  render() {
    if (this.state.hasError) return <ErrorFallback />
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
