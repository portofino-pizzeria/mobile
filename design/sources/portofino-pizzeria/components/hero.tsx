import Image from 'next/image'
import { ArrowDown, ShoppingBag } from 'lucide-react'

export default function Hero() {
  return <section id="top" className="relative overflow-hidden bg-[#f7f3ed]"><div className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-12 md:grid-cols-2 md:py-20"><div className="order-2 md:order-1"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-[#d4a574]">Essen · Seit 1987</p><h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-gray-900 md:text-7xl">Buon<br/><span className="text-[#d4a574]">appetito.</span></h1><p className="mt-6 max-w-sm text-base leading-7 text-gray-600">Echte italienische Küche, hausgemachte Pasta und Pizza aus dem Steinofen.</p><a href="#menu" className="portofino-button mt-8 inline-flex items-center gap-2">Speisekarte entdecken <ArrowDown size={17}/></a></div><div className="order-1 relative aspect-[4/3] overflow-hidden rounded-[2rem] md:order-2 md:aspect-square"><Image src="/portofino-pizza.png" alt="Frisch gebackene Pizza aus dem Steinofen" fill priority className="object-cover" sizes="(max-width: 768px) 100vw, 50vw"/></div></div></section>
}
