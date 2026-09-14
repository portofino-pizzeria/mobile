'use client'

import { Menu, X, Phone, ShoppingBag } from 'lucide-react'

type HeaderProps = { mobileMenuOpen: boolean; setMobileMenuOpen: (open: boolean) => void }

export default function Header({ mobileMenuOpen, setMobileMenuOpen }: HeaderProps) {
  return (
    <header className="portofino-header">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <button aria-label="Open menu" className="text-gray-800 md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <X size={25} /> : <Menu size={25} />}</button>
        <a href="#top" className="font-serif text-2xl font-bold tracking-tight text-[#d4a574]">PORTOFINO<span className="text-gray-800">.</span></a>
        <nav className="hidden items-center gap-8 text-sm font-medium md:flex"><a href="#menu" className="hover:text-[#d4a574]">Speisekarte</a><a href="#about" className="hover:text-[#d4a574]">Über uns</a><a href="#contact" className="hover:text-[#d4a574]">Kontakt</a></nav>
        <a href="tel:+49201412345" aria-label="Call Portofino" className="text-gray-800"><Phone size={20} /></a>
      </div>
      {mobileMenuOpen && <nav className="border-t border-gray-100 bg-white px-5 py-5 md:hidden"><div className="flex flex-col gap-5 text-lg font-medium"><a href="#menu" onClick={() => setMobileMenuOpen(false)}>Speisekarte</a><a href="#about" onClick={() => setMobileMenuOpen(false)}>Über uns</a><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Kontakt</a></div></nav>}
    </header>
  )
} 
