import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Home from './screens/Home.jsx'
import BaseDetail from './screens/BaseDetail.jsx'
import MapScreen from './screens/MapScreen.jsx'
import BasesCosts from './screens/BasesCosts.jsx'
import Checklist from './screens/Checklist.jsx'
import About from './screens/About.jsx'
import Book from './screens/Book.jsx'
import Magazine from './screens/Magazine.jsx'
import { packing, predeparture } from './data/checklists.js'
import { IconHome, IconMap, IconCheck, IconList, IconInfo } from './components/icons.jsx'
import { VIEW_ONLY } from './lib/viewOnly.js'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { document.querySelector('.app')?.scrollTo?.(0, 0); window.scrollTo(0, 0) }, [pathname])
  return null
}

function TabBar() {
  return (
    <nav className="tabbar">
      <NavLink to="/" end><IconHome /><span>Home</span></NavLink>
      <NavLink to="/map"><IconMap /><span>Map</span></NavLink>
      {!VIEW_ONLY && <NavLink to="/costs"><IconList /><span>Costs</span></NavLink>}
      {VIEW_ONLY && <NavLink to="/magazine"><IconList /><span>Journal</span></NavLink>}
      {!VIEW_ONLY && <NavLink to="/packing"><IconCheck /><span>Packing</span></NavLink>}
      <NavLink to="/about"><IconInfo /><span>About</span></NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      {VIEW_ONLY && <div className="view-banner">👀 View-only — Phil &amp; Tracey’s Highlands trip</div>}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/base/:id" element={<BaseDetail />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/magazine" element={<Magazine />} />
        <Route path="/magazine/:id" element={<Magazine />} />
        {/* Costs & checklists are hidden in the public view-only link */}
        <Route path="/costs" element={VIEW_ONLY ? <Navigate to="/magazine" replace /> : <BasesCosts />} />
        <Route path="/book" element={<Book />} />
        <Route path="/packing" element={VIEW_ONLY ? <Navigate to="/" replace /> : <Checklist storageKey="packing" title="Packing" eyebrow="Get it in the van" groups={packing} />} />
        <Route path="/predeparture" element={VIEW_ONLY ? <Navigate to="/" replace /> : <Checklist storageKey="predeparture" title="Pre-departure" eyebrow="Before you set off" groups={predeparture} />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <TabBar />
    </div>
  )
}
