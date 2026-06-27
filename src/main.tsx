import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'
import { Capacitor } from '@capacitor/core'

if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    if (Capacitor.isNativePlatform()) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        const baseUrl = 'https://www.aegiserp.xyz';
        const modifiedUrl = `${baseUrl}${input}`;
        console.log(`[Capacitor Fetch Redirect] ${input} -> ${modifiedUrl}`);
        return originalFetch(modifiedUrl, init);
      } else if (input instanceof Request) {
        const url = input.url;
        if (url.startsWith('/') || (typeof window !== 'undefined' && url.includes(window.location.host + '/api/'))) {
          const baseUrl = 'https://www.aegiserp.xyz';
          const relativePath = url.startsWith('/') ? url : new URL(url).pathname;
          if (relativePath.startsWith('/api/')) {
            const modifiedUrl = `${baseUrl}${relativePath}`;
            console.log(`[Capacitor Fetch Request Redirect] ${url} -> ${modifiedUrl}`);
            const newRequest = new Request(modifiedUrl, input);
            return originalFetch(newRequest, init);
          }
        }
      }
    }
    return originalFetch(input, init);
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
