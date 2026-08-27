import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode, RefObject } from 'react'

/* ------------------------------------------------------------------ *
 * IMAGE URLS
 * ------------------------------------------------------------------ */
const HERO_IMAGE =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_113640_ccf3cf97-d447-425b-a134-d7b09fc743fc.png&w=1280&q=85'

const SECTION2_IMAGE =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_114219_414dfe80-f15c-4e25-bf52-b13721f4bd88.png&w=1280&q=85'

const SECTION3_IMG1 =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_115253_c19ab167-8dd5-48b4-967d-b9f0d9d6e8fb.png&w=1280&q=85'

const SECTION3_IMG2 =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_115237_fc519057-6e87-4abf-999a-9610b8b085b4.png&w=1280&q=85'

const SECTION3_BG =
  'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_114355_752ba9e6-0942-4abb-9047-5d9bb16632e9.png&w=1280&q=85'

/* ------------------------------------------------------------------ *
 * DATA
 * ------------------------------------------------------------------ */
const featureBars = ['Advanced Dentistry', 'High Quality Equipment', 'Friendly Staff']

const services: { name: string; num: string | null; active: boolean }[] = [
  { name: 'Dental\nVeneers', num: '01', active: true },
  { name: 'Dental\nCrowns', num: '02', active: false },
  { name: 'Teeth\nWhitening', num: '03', active: false },
  { name: 'Dental\nImplants', num: null, active: false },
]

/** Nav items — label, number badge, hover-preview image and scroll-target id. */
const navItems = [
  { label: 'Home', num: '01', image: HERO_IMAGE, target: 'home' },
  { label: 'Services', num: '02', image: SECTION2_IMAGE, target: 'services' },
  { label: 'About', num: '03', image: SECTION3_IMG1, target: 'contact' },
  { label: 'Gallery', num: '04', image: SECTION3_BG, target: 'services' },
  { label: 'Contact', num: '05', image: SECTION3_IMG2, target: 'contact' },
]

/* ------------------------------------------------------------------ *
 * TYPES + HELPERS
 * ------------------------------------------------------------------ */
interface MaskPosition {
  x: number
  y: number
  sw: number
  sh: number
}

/** Merge several refs onto one element (RefObject is mutable in React 19). */
function mergeRefs<T>(...refs: RefObject<T | null>[]) {
  return (node: T | null) => {
    for (const ref of refs) ref.current = node
  }
}

/* ------------------------------------------------------------------ *
 * HOOKS
 * ------------------------------------------------------------------ */

/** True when viewport is <= 767px. Listens to matchMedia change events. */
function useIsMobile() {
  const query = '(max-width: 767px)'
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isMobile
}

/**
 * Computes, for every registered card, its top-left offset relative to the
 * section plus the section's own width/height. Recomputes via ResizeObserver.
 */
function useMaskPositions(
  sectionRef: RefObject<HTMLElement | null>,
  cardsRef: RefObject<(HTMLDivElement | null)[]>,
) {
  const [positions, setPositions] = useState<MaskPosition[]>([])

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return

    const compute = () => {
      const s = section.getBoundingClientRect()
      const next = cardsRef.current.map((card) => {
        if (!card) return { x: 0, y: 0, sw: s.width, sh: s.height }
        const c = card.getBoundingClientRect()
        return {
          x: c.left - s.left,
          y: c.top - s.top,
          sw: s.width,
          sh: s.height,
        }
      })
      setPositions(next)
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(section)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [sectionRef, cardsRef])

  return positions
}

/**
 * Loads an image and returns how wide it would render if scaled to fill the
 * given section height: naturalWidth * (sectionHeight / naturalHeight).
 */
function useImageWidth(src: string, sectionHeight: number) {
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])
  if (!natural || sectionHeight === 0) return 0
  return natural.w * (sectionHeight / natural.h)
}

/** Staggered reveal on first intersection. Returns a ref + per-index style. */
function useStaggeredReveal(_count: number, threshold = 0.15) {
  const containerRef = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const getAnimStyle = (index: number): CSSProperties => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(24px)',
    transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 120}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${index * 120}ms`,
  })

  return { containerRef, getAnimStyle }
}

/* ------------------------------------------------------------------ *
 * MASKED CARD
 * ------------------------------------------------------------------ */
interface MaskedCardProps {
  bgImage: string
  position?: MaskPosition
  imageWidth: number
  focalX: number
  className?: string
  children?: ReactNode
  cardRef?: (el: HTMLDivElement | null) => void
  style?: CSSProperties
}

function MaskedCard({
  bgImage,
  position,
  imageWidth,
  focalX,
  className,
  children,
  cardRef,
  style,
}: MaskedCardProps) {
  const pos = position ?? { x: 0, y: 0, sw: 0, sh: 0 }
  const overflow = imageWidth > pos.sw ? imageWidth - pos.sw : 0
  const focalOffset = overflow * focalX

  const bgStyle: CSSProperties = {
    backgroundImage: `url(${bgImage})`,
    backgroundSize: `auto ${pos.sh}px`,
    backgroundPosition: `-${pos.x + focalOffset}px -${pos.y}px`,
    backgroundRepeat: 'no-repeat',
  }

  return (
    <div ref={cardRef} className={className} style={{ ...bgStyle, ...style }}>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * SPLASH SCREEN
 * ------------------------------------------------------------------ */
function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [count, setCount] = useState(0)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let step = 0
    const interval = window.setInterval(() => {
      step += 1
      setCount(step)
      if (step >= 100) {
        window.clearInterval(interval)
        window.setTimeout(() => setExiting(true), 200)
        window.setTimeout(() => onComplete(), 900)
      }
    }, 20)
    return () => window.clearInterval(interval)
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-[100] bg-white flex items-end justify-start transition-opacity duration-700 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <span className="text-7xl md:text-9xl font-bold tabular-nums p-6 md:p-10 leading-none text-black">
        {count}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * NAVBAR
 * ------------------------------------------------------------------ */
function Navbar() {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activePreview, setActivePreview] = useState(0)

  // Lock body scroll while either menu is open.
  useEffect(() => {
    const locked = open || menuOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, menuOpen])

  // Close menus with the Escape key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Close any open menu and smooth-scroll to the target section.
  const scrollToSection = (id: string) => {
    setMenuOpen(false)
    setOpen(false)
    document.body.style.overflow = '' // unlock immediately so smooth scroll runs
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 md:px-6 py-2 md:py-3 bg-white/80 backdrop-blur-md">
        {/* Logo — click returns to the top of the page */}
        <button
          type="button"
          onClick={() => scrollToSection('home')}
          aria-label="Dental Health — back to top"
          className="flex flex-col text-left hover:opacity-70 transition-opacity duration-200"
        >
          <span className="text-xl md:text-2xl font-extrabold uppercase tracking-tight leading-none">
            Dental
          </span>
          <span className="text-xl md:text-2xl font-extrabold uppercase tracking-tight leading-none -mt-1.5 md:-mt-2">
            Health
          </span>
          <span className="text-[8px] md:text-[9px] font-medium leading-none mt-1.5 md:mt-2">
            quality healthcare
          </span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            className={`px-6 py-3 rounded-full border border-black text-sm font-semibold transition-colors duration-200 ${
              menuOpen
                ? 'bg-black text-white'
                : 'bg-white text-black hover:bg-black hover:text-white'
            }`}
          >
            {menuOpen ? 'Close' : 'Menu'}
          </button>
          <span className="text-sm font-semibold text-black">Dental Emergency</span>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="md:hidden w-10 h-10 flex items-center justify-center relative"
        >
          <span
            className={`absolute h-0.5 w-6 bg-black rounded-full transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? 'rotate-45 translate-y-0' : '-translate-y-2'
            }`}
          />
          <span
            className={`absolute h-0.5 w-6 bg-black rounded-full transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
            }`}
          />
          <span
            className={`absolute h-0.5 w-6 bg-black rounded-full transition-all duration-300 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              open ? '-rotate-45 translate-y-0' : 'translate-y-2'
            }`}
          />
        </button>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 ${
          open ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          onClick={() => setOpen(false)}
          className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-500 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* Panel */}
        <div
          className={`absolute top-0 right-0 h-full w-[85%] max-w-sm bg-white shadow-2xl transition-transform duration-500 ease-[cubic-bezier(0.76,0,0.24,1)] ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex flex-col justify-center h-full px-8 gap-1">
            {navItems.map((item, i) => (
              <a
                key={item.label}
                href={`#${item.target}`}
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection(item.target)
                }}
                className="text-4xl font-bold text-black hover:text-neutral-500 transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]"
                style={{
                  opacity: open ? 1 : 0,
                  transform: open ? 'translateX(0)' : 'translateX(2rem)',
                  transitionDelay: open ? `${100 + i * 60}ms` : '0ms',
                }}
              >
                {item.label}
              </a>
            ))}

            <div
              className="mt-8 pt-8 border-t border-neutral-200 transition-all duration-500 ease-[cubic-bezier(0.76,0,0.24,1)]"
              style={{
                opacity: open ? 1 : 0,
                transform: open ? 'translateX(0)' : 'translateX(2rem)',
                transitionDelay: open ? '450ms' : '0ms',
              }}
            >
              <p className="text-sm font-semibold text-black mb-4">Dental Emergency</p>
              <button
                type="button"
                className="w-full px-6 py-4 bg-black rounded-full text-white text-sm font-semibold hover:bg-neutral-800 transition-colors duration-200"
              >
                Book Appointment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop full-screen menu (glass overlay + hover image preview) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Main menu"
        inert={!menuOpen}
        className={`hidden md:block fixed inset-0 z-40 ${
          menuOpen ? 'pointer-events-auto' : 'pointer-events-none'
        }`}
      >
        {/* Glass backdrop — click to close */}
        <div
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-white/70 backdrop-blur-2xl transition-opacity duration-500 ease-out ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Content */}
        <div
          className={`relative h-full w-full flex flex-col px-6 lg:px-10 pt-24 pb-6 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            menuOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          {/* Links + preview */}
          <div className="flex-1 min-h-0 grid grid-cols-2 gap-8 lg:gap-12 items-center">
            <nav
              className="flex flex-col justify-center"
              onMouseLeave={() => setActivePreview(0)}
            >
              {navItems.map((item, i) => (
                <a
                  key={item.label}
                  href={`#${item.target}`}
                  onMouseEnter={() => setActivePreview(i)}
                  onClick={(e) => {
                    e.preventDefault()
                    scrollToSection(item.target)
                  }}
                  className="group flex items-baseline gap-4 lg:gap-6 border-b border-black/10 py-3 lg:py-4"
                  style={{
                    opacity: menuOpen ? 1 : 0,
                    transform: menuOpen ? 'translateX(0)' : 'translateX(24px)',
                    transition:
                      'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)',
                    transitionDelay: menuOpen ? `${140 + i * 60}ms` : '0ms',
                  }}
                >
                  <span className="text-sm font-semibold tabular-nums text-black/40 w-6">
                    {item.num}
                  </span>
                  <span className="text-4xl lg:text-6xl font-bold text-black leading-none transition-transform duration-300 ease-out group-hover:translate-x-2">
                    {item.label}
                  </span>
                </a>
              ))}
            </nav>

            {/* Hover preview */}
            <div className="relative h-[60vh] rounded-2xl overflow-hidden bg-neutral-100">
              {navItems.map((item, i) => (
                <img
                  key={item.label}
                  src={item.image}
                  alt=""
                  aria-hidden="true"
                  className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-out ${
                    activePreview === i ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between shrink-0 pt-6">
            <button
              type="button"
              className="px-8 py-4 bg-black rounded-full text-white text-sm font-semibold hover:bg-neutral-800 transition-colors duration-200"
            >
              Book Appointment
            </button>
            <span className="text-sm font-semibold text-black">
              Dental Emergency · +1 (201) 555-0142
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * SECTION 1 — HERO
 * ------------------------------------------------------------------ */
function Section1() {
  const isMobile = useIsMobile()
  const sectionRef = useRef<HTMLElement | null>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const positions = useMaskPositions(sectionRef, cardsRef)
  const sectionHeight = positions[0]?.sh ?? 0
  const imageWidth = useImageWidth(HERO_IMAGE, sectionHeight)
  const focalX = isMobile ? 0.7 : 0.8
  const s1Reveal = useStaggeredReveal(4)

  const registerCard = (i: number) => (el: HTMLDivElement | null) => {
    cardsRef.current[i] = el
  }

  return (
    <section
      id="home"
      ref={mergeRefs(sectionRef, s1Reveal.containerRef)}
      className="h-screen w-full overflow-hidden flex flex-col pt-24 md:pt-24 px-3 md:px-5 pb-1.5 md:pb-2 gap-1.5 md:gap-2"
    >
      {/* Feature bars */}
      {featureBars.map((label, i) => (
        <MaskedCard
          key={label}
          bgImage={HERO_IMAGE}
          position={positions[i]}
          imageWidth={imageWidth}
          focalX={focalX}
          cardRef={registerCard(i)}
          style={s1Reveal.getAnimStyle(i)}
          className="w-full h-14 md:h-20 shrink-0 rounded-xl md:rounded-2xl overflow-hidden relative"
        >
          <span className="flex items-center justify-center h-full text-black text-lg md:text-3xl font-bold text-center relative z-10">
            {label}
          </span>
        </MaskedCard>
      ))}

      {/* Main hero card */}
      <MaskedCard
        bgImage={HERO_IMAGE}
        position={positions[3]}
        imageWidth={imageWidth}
        focalX={focalX}
        cardRef={registerCard(3)}
        style={s1Reveal.getAnimStyle(3)}
        className="w-full flex-1 min-h-0 rounded-xl md:rounded-2xl overflow-hidden relative"
      >
        <div className="absolute bottom-5 left-3 md:bottom-8 md:left-4 z-10">
          <h1 className="text-black text-[clamp(3rem,11vw,11rem)] font-bold leading-[0.79] tracking-tight">
            Dental
            <br />
            Care
          </h1>
        </div>

        <span className="absolute bottom-6 right-4 md:bottom-10 md:right-8 text-white text-xs md:text-sm font-semibold z-10">
          Free Consultation
        </span>
      </MaskedCard>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * SECTION 2 — SMILE GALLERY
 * ------------------------------------------------------------------ */
function Section2() {
  const isMobile = useIsMobile()
  const sectionRef = useRef<HTMLElement | null>(null)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])
  const positions = useMaskPositions(sectionRef, cardsRef)
  const sectionHeight = positions[0]?.sh ?? 0
  const imageWidth = useImageWidth(SECTION2_IMAGE, sectionHeight)
  const focalX = isMobile ? 0.65 : 0.8
  const s2Reveal = useStaggeredReveal(4)

  const registerCard = (i: number) => (el: HTMLDivElement | null) => {
    cardsRef.current[i] = el
  }

  return (
    <section
      id="services"
      ref={mergeRefs(sectionRef, s2Reveal.containerRef)}
      className="scroll-mt-20 min-h-screen md:h-screen w-full overflow-hidden flex flex-col pt-1.5 md:pt-2 px-3 md:px-5 pb-1.5 md:pb-2 gap-1.5 md:gap-2"
    >
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 grid-rows-[auto_auto_auto_auto] md:grid-rows-[1fr_1fr_0.8fr] gap-1.5 md:gap-2">
        {/* Card 0 — Smile Gallery */}
        <MaskedCard
          bgImage={SECTION2_IMAGE}
          position={positions[0]}
          imageWidth={imageWidth}
          focalX={focalX}
          cardRef={registerCard(0)}
          style={s2Reveal.getAnimStyle(0)}
          className="rounded-xl md:rounded-2xl overflow-hidden relative min-h-[160px] md:min-h-0"
        >
          <h2 className="absolute top-4 left-5 md:top-6 md:left-7 text-white md:text-black text-2xl md:text-3xl font-bold z-10">
            Smile Gallery
          </h2>
          <span className="absolute bottom-4 left-5 md:bottom-6 md:left-7 text-white md:text-black text-xs md:text-sm font-semibold z-10">
            Our cosmetic dental work
          </span>
        </MaskedCard>

        {/* Card 1 — Call us (spans 2 rows on desktop) */}
        <MaskedCard
          bgImage={SECTION2_IMAGE}
          position={positions[1]}
          imageWidth={imageWidth}
          focalX={focalX}
          cardRef={registerCard(1)}
          style={s2Reveal.getAnimStyle(1)}
          className="md:row-span-2 rounded-xl md:rounded-2xl overflow-hidden relative min-h-[200px] md:min-h-0"
        >
          <p className="absolute bottom-16 left-5 md:bottom-20 md:left-7 text-white text-xs md:text-sm font-semibold leading-4 md:leading-5 z-10">
            If you want a gorgeous smile,
            <br />
            call us to ask about a smile makeover.
          </p>
          <button
            type="button"
            className="absolute bottom-4 right-4 md:bottom-6 md:right-6 px-5 py-3 md:px-8 md:py-5 bg-white rounded-full text-black text-base md:text-xl font-bold z-10 hover:scale-105 transition-transform"
          >
            Call Us
          </button>
        </MaskedCard>

        {/* Card 2 — Smile makeover */}
        <MaskedCard
          bgImage={SECTION2_IMAGE}
          position={positions[2]}
          imageWidth={imageWidth}
          focalX={focalX}
          cardRef={registerCard(2)}
          style={s2Reveal.getAnimStyle(2)}
          className="rounded-xl md:rounded-2xl overflow-hidden relative min-h-[160px] md:min-h-0"
        >
          <h2 className="absolute top-4 left-5 md:top-6 md:left-7 text-white md:text-black text-[clamp(3rem,7vw,6rem)] font-bold leading-[0.9] z-10">
            Smile
            <br />
            makeover
          </h2>
        </MaskedCard>

        {/* Card 3 — Services (full width) */}
        <MaskedCard
          bgImage={SECTION2_IMAGE}
          position={positions[3]}
          imageWidth={imageWidth}
          focalX={focalX}
          cardRef={registerCard(3)}
          style={s2Reveal.getAnimStyle(3)}
          className="col-span-1 md:col-span-2 rounded-xl md:rounded-2xl overflow-hidden relative min-h-[200px] md:min-h-0"
        >
          <div className="absolute inset-0 z-10 flex flex-wrap md:flex-nowrap gap-1.5 md:gap-2 p-2 md:p-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className={`flex-1 min-w-[calc(50%-4px)] md:min-w-0 rounded-xl md:rounded-2xl p-3 md:p-5 flex flex-col justify-between ${
                  svc.active ? 'bg-white/90 backdrop-blur-md' : 'bg-white/20 backdrop-blur-xl'
                }`}
              >
                <h3
                  className={`text-xl md:text-4xl font-bold leading-[1.05] whitespace-pre-line ${
                    svc.active ? 'text-black' : 'text-white'
                  }`}
                >
                  {svc.name}
                </h3>
                {svc.num && (
                  <span
                    className={`self-end w-8 h-8 md:w-12 md:h-12 rounded-full border flex items-center justify-center text-xs md:text-sm font-semibold ${
                      svc.active ? 'border-black text-black' : 'border-white text-white'
                    }`}
                  >
                    {svc.num}
                  </span>
                )}
              </div>
            ))}
          </div>
        </MaskedCard>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * SECTION 3 — IMPLANT DENTISTRY
 * ------------------------------------------------------------------ */
function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      className={`rotate-[-45deg] ${className ?? ''}`}
    >
      <path
        d="M1 7h12m0 0L8 2m5 5L8 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Section3() {
  const s3Reveal = useStaggeredReveal(4)

  return (
    <section
      id="contact"
      ref={s3Reveal.containerRef}
      className="scroll-mt-20 min-h-screen md:h-screen w-full overflow-hidden flex flex-col pt-1.5 md:pt-2 px-3 md:px-5 pb-1.5 md:pb-2 gap-1.5 md:gap-2"
    >
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-1.5 md:gap-2">
          {/* Heading card */}
          <div
            style={s3Reveal.getAnimStyle(0)}
            className="rounded-xl md:rounded-2xl bg-stone-50 p-5 md:p-7 flex flex-col justify-between flex-[1.2] min-h-[180px] md:min-h-0"
          >
            <h2 className="text-[clamp(3rem,7vw,6.5rem)] font-bold leading-[0.95] text-black">
              Implant
              <br />
              Dentistry
            </h2>
            <p className="text-xs md:text-sm font-semibold text-black">Restore Missing Teeth</p>
          </div>

          {/* Two image cards */}
          <div
            style={s3Reveal.getAnimStyle(1)}
            className="flex gap-1.5 md:gap-2 flex-1 min-h-[140px] md:min-h-0"
          >
            <div className="flex-1 rounded-xl md:rounded-2xl overflow-hidden">
              <img
                src={SECTION3_IMG1}
                alt="Dental implant procedure"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 rounded-xl md:rounded-2xl overflow-hidden">
              <img
                src={SECTION3_IMG2}
                alt="Dental restoration"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Consultation card */}
          <div
            style={s3Reveal.getAnimStyle(2)}
            className="rounded-xl md:rounded-2xl bg-zinc-200 p-5 md:p-7 flex items-end justify-between flex-[0.8] min-h-[160px] md:min-h-0"
          >
            <div>
              <p className="text-xs md:text-sm font-semibold text-black mb-2 md:mb-3">
                Consultation
              </p>
              <h3 className="text-xl md:text-3xl font-bold text-black leading-6 md:leading-8">
                Dental
                <br />
                Restoration
                <br />
                Services
              </h3>
            </div>
            <button
              type="button"
              className="px-5 py-3 md:px-8 md:py-5 bg-white rounded-full text-black text-base md:text-xl font-bold hover:scale-105 transition-transform"
            >
              Book Online
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN — tall image card */}
        <div
          style={s3Reveal.getAnimStyle(3)}
          className="rounded-xl md:rounded-2xl overflow-hidden relative min-h-[350px] md:min-h-0"
        >
          <img src={SECTION3_BG} alt="Smiling patient" className="w-full h-full object-cover" />

          <div className="absolute bottom-3 left-3 right-3 md:bottom-5 md:left-5 md:right-5 flex gap-1.5 md:gap-2">
            {/* Overlay card 1 (white) */}
            <div className="flex-1 bg-white rounded-xl md:rounded-2xl p-3 md:p-5 flex flex-col justify-between h-36 md:h-52">
              <h4 className="text-lg md:text-2xl font-bold text-black leading-5 md:leading-7">
                The Process
                <br />
                of Installing
                <br />
                Implants
              </h4>
              <span className="self-end w-9 h-9 md:w-12 md:h-12 rounded-full border border-black flex items-center justify-center">
                <ArrowIcon />
              </span>
            </div>

            {/* Overlay card 2 (glass) */}
            <div className="flex-1 bg-white/20 backdrop-blur-xl rounded-xl md:rounded-2xl p-3 md:p-5 flex flex-col justify-between h-36 md:h-52">
              <h4 className="text-lg md:text-2xl font-bold text-white leading-5 md:leading-7">
                Caring
                <br />
                for Dental
                <br />
                Implants
              </h4>
              <span className="self-end w-9 h-9 md:w-12 md:h-12 rounded-full border border-white flex items-center justify-center">
                <ArrowIcon className="text-white" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * FOOTER — compact, unobtrusive, matches the card aesthetic
 * ------------------------------------------------------------------ */
function Footer() {
  const year = new Date().getFullYear()
  const meta = ['Privacy', 'Terms', 'Instagram', 'Facebook']

  return (
    <footer className="px-3 md:px-5 pt-1.5 md:pt-2 pb-3 md:pb-5">
      <div className="rounded-xl md:rounded-2xl bg-black text-white px-6 py-7 md:px-10 md:py-8">
        {/* Copyright + legal + social */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:items-center md:gap-4 text-xs md:text-sm text-white/50">
          <p className="md:justify-self-start">© {year} Dental Health. All rights reserved.</p>
          <p className="md:justify-self-center text-white/70">
            POWERED by <span className="font-semibold text-white">Nikolay Stoyanov</span>
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-self-end">
            {meta.map((label) => (
              <a
                key={label}
                href="#"
                onClick={(e) => e.preventDefault()}
                className="hover:text-white transition-colors duration-200"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ *
 * APP
 * ------------------------------------------------------------------ */
export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const handleSplashComplete = useCallback(() => setShowSplash(false), [])

  return (
    <div className="bg-white">
      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
      <Navbar />

      <Section1 />
      <Section2 />
      <Section3 />
      <Footer />
    </div>
  )
}
