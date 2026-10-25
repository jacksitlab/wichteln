import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './styles.css'
import './fonts.css'
import HomePage from './pages/HomePage'
import CreatePage from './pages/CreatePage'
import AdminPage from './pages/AdminPage'
import JoinPage from './pages/JoinPage'
import ParticipantPage from './pages/ParticipantPage'
import { Snowfall, SnowCover, ChristmasTree } from './components/Decorations'
import { MusicToggle } from './components/MusicToggle'
import { Footer } from './components/Footer'
import { LanguageProvider } from './i18n'
import { LanguageSwitch } from './components/Widgets'

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/create', element: <CreatePage /> },
  { path: '/g/:adminToken', element: <AdminPage /> },
  { path: '/join/:joinToken', element: <JoinPage /> },
  { path: '/p/:personalToken', element: <ParticipantPage /> },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <Snowfall />
      <SnowCover />
      <ChristmasTree />
      <MusicToggle />
      <LanguageSwitch />
      <RouterProvider router={router} />
      <Footer />
    </LanguageProvider>
  </React.StrictMode>,
)
