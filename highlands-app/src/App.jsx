import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Home from './screens/Home.jsx'
import BaseDetail from './screens/BaseDetail.jsx'
import MapScreen from './screens/MapScreen.jsx'
import BasesCosts from './screens/BasesCosts.jsx'
import Checklist from './screens/Checklist.jsx'
import About from './screens/About.jsx'
import { packing, predeparture } from './data/checklists.js'
import { IconHome, IconMap, IconCheck, IconList, IconInfo } from './components/icons.jsx'

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
      <NavLink to="/costs"><IconList /><span>Costs</span></NavLink>
      <NavLink to="/packing"><IconCheck /><span>Packing</span></NavLink>
      <NavLink to="/about"><IconInfo /><span>About</span></NavLink>
    </nav>
  )
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/base/:id" element={<BaseDetail />} />
        <Route path="/map" element={<MapScreen />} />
        <Route path="/costs" element={<BasesCosts />} />
        <Route path="/packing" element={<Checklist storageKey="packing" title="Packing" eyebrow="Get it in the van" groups={packing} />} />
        <Route path="/predeparture" element={<Checklist storageKey="predeparture" title="Pre-departure" eyebrow="Before you set off" groups={predeparture} />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <TabBar />
    </div>
  )
}
