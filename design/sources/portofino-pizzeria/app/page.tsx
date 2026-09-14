'use client'

import { useState } from 'react'
import Header from '@/components/header'
import Hero from '@/components/hero'
import MenuSection from '@/components/menu'
import About from '@/components/about'
import Contact from '@/components/contact'
import Footer from '@/components/footer'

export default function Page() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      <Header mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <main>
        <Hero />
        <MenuSection />
        <About />
        <Contact />
      </main>
      <Footer />
    </div>
  )
}
