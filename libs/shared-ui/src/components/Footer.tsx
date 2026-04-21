import * as React from "react"
import { Globe, MapPin, Phone, Mail } from "lucide-react"
import { cn } from "../lib/utils"

const linkClass =
  "text-sm text-neutral-500 transition-all hover:text-primary hover:pl-1"

export type FooterLabels = {
  tagline: string
  contactTitle: string
  addressLine1: string
  addressLine2: string
  quickLinksTitle: string
  fullMenu: string
  trackOrder: string
  catering: string
  locations: string
  giftCards: string
  careers: string
  newsletterTitle: string
  newsletterDescription: string
  emailPlaceholder: string
  subscribe: string
  copyright: string
  privacy: string
  terms: string
  cookies: string
  facebook: string
  instagram: string
  twitter: string
  youtube: string
}

const defaultFooterLabels: FooterLabels = {
  tagline:
    "Crafting gourmet experiences since 2024. We believe in bold flavors, fresh ingredients, and the shared joy of a perfect roll.",
  contactTitle: "Contact Us",
  addressLine1: "123 Flavor Street,",
  addressLine2: "Foodie District, Colombo 03",
  quickLinksTitle: "Quick Links",
  fullMenu: "Our Full Menu",
  trackOrder: "Track Order",
  catering: "Catering Services",
  locations: "Find a Location",
  giftCards: "Gift Cards",
  careers: "Join the Team",
  newsletterTitle: "Newsletter",
  newsletterDescription:
    "Join our mailing list for exclusive rolls and secret offers.",
  emailPlaceholder: "Enter your email",
  subscribe: "Subscribe",
  copyright: "© {year} Wrap & Roll Global. All rights reserved.",
  privacy: "Privacy",
  terms: "Terms",
  cookies: "Cookies",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "Twitter",
  youtube: "Youtube",
}

export type FooterProps = {
  className?: string
  /** e.g. "en" → links go to `/en/menu`. Omit for non-localized apps. */
  locale?: string
  labels?: Partial<FooterLabels>
}

export const Footer: React.FC<FooterProps> = ({
  className,
  locale,
  labels,
}) => {
  const L = { ...defaultFooterLabels, ...labels }
  const base = locale ? `/${locale}` : ""

  const social = [
    { icon: Globe, label: L.facebook },
    { icon: Globe, label: L.instagram },
    { icon: Globe, label: L.twitter },
    { icon: Globe, label: L.youtube },
  ] as const

  const copyright = L.copyright.replace(
    "{year}",
    String(new Date().getFullYear()),
  )

  return (
    <footer
      className={cn(
        "bg-[#0a0a0a] pt-24 pb-12 font-sans text-neutral-400 border-t border-white/5",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl px-8">
        <div className="mb-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
          <div className="space-y-8">
            <div>
              <h3 className="mb-6 text-2xl font-black uppercase italic tracking-tighter text-white">
                Wrap <span className="text-primary">&</span> Roll
              </h3>
              <p className="text-sm leading-relaxed text-neutral-500 max-w-xs">
                {L.tagline}
              </p>
            </div>
            <div className="flex gap-4">
              {social.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all hover:scale-110 hover:bg-primary"
                  aria-label={s.label}
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-white/50">
              {L.contactTitle}
            </h4>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <MapPin className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm leading-relaxed text-neutral-500">
                  {L.addressLine1}
                  <br />
                  {L.addressLine2}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Phone className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-neutral-500">+94 11 234 5678</p>
              </div>
              <div className="flex items-center gap-4">
                <Mail className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-neutral-500">hello@wrapandroll.lk</p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-white/50">
              {L.quickLinksTitle}
            </h4>
            <nav className="flex flex-col gap-4">
              <a href={`${base}/menu`} className={linkClass}>
                {L.fullMenu}
              </a>
              <a href={`${base}/order/track`} className={linkClass}>
                {L.trackOrder}
              </a>
              <a href={`${base}/catering`} className={linkClass}>
                {L.catering}
              </a>
              <a href={`${base}/locations`} className={linkClass}>
                {L.locations}
              </a>
              <a href={`${base}/gift-cards`} className={linkClass}>
                {L.giftCards}
              </a>
              <a href={`${base}/careers`} className={linkClass}>
                {L.careers}
              </a>
            </nav>
          </div>

          <div>
            <h4 className="mb-8 text-xs font-black uppercase tracking-[0.2em] text-white/50">
              {L.newsletterTitle}
            </h4>
            <p className="mb-6 text-sm text-neutral-500">
              {L.newsletterDescription}
            </p>
            <div className="flex flex-col gap-3">
              <input
                type="email"
                placeholder={L.emailPlaceholder}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:border-primary focus:outline-none transition-colors"
              />
              <button className="rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95">
                {L.subscribe}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 pt-12 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
          <p>{copyright}</p>
          <div className="flex gap-8">
            <a
              href={`${base}/privacy`}
              className="hover:text-white transition-colors"
            >
              {L.privacy}
            </a>
            <a
              href={`${base}/terms`}
              className="hover:text-white transition-colors"
            >
              {L.terms}
            </a>
            <a
              href={`${base}/cookies`}
              className="hover:text-white transition-colors"
            >
              {L.cookies}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
