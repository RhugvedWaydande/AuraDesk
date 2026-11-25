// main.jsx — the entry point. Vite loads this file first (see index.html).
// It mounts the <App /> component into the <div id="root"> on the page.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
