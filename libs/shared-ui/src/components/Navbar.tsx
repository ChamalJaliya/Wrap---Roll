"use client"

import * as React from "react"
import { Menu, X, Globe, User, LogOut, Settings, ShoppingBag, History } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "./ui/button"
import { ThemeToggle } from "./ThemeToggle"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { cn } from "../lib/utils"

export interface NavLink {
  label: string
  href: string
}

export interface LanguageOption {
  code: string
  label: string
}

export type NavbarCopy = {
  selectLanguage: string
  account: string
  myProfile: string
  orderHistory: string
  settings: string
  logOut: string
  signIn: string
  signInToRoll: string
  accountProfile: string
  signOut: string
}

const defaultNavbarCopy: NavbarCopy = {
  selectLanguage: "Select Language",
  account: "Account",
  myProfile: "My Profile",
  orderHistory: "Order History",
  settings: "Settings",
  logOut: "Log Out",
  signIn: "Sign In",
  signInToRoll: "Sign In to Roll",
  accountProfile: "Account Profile",
  signOut: "Sign Out",
}

function splitLogoText(logoText: string) {
  const sep = " & "
  const i = logoText.indexOf(sep)
  if (i === -1) {
    return { before: logoText, after: null as string | null }
  }
  return { before: logoText.slice(0, i), after: logoText.slice(i + sep.length) }
}

export interface NavbarProps {
  logoText?: string
  logoHref?: string
  /** UI strings; merge with English defaults */
  copy?: Partial<NavbarCopy>
  links?: NavLink[]
  isAuthenticated?: boolean
  userInitials?: string
  userName?: string
  currentLocale?: string
  languages?: LanguageOption[]
  onLanguageChange?: (code: string) => void
  onSignIn?: () => void
  onSignOut?: () => void
  onProfileClick?: () => void
  onOrderHistoryClick?: () => void
  onSettingsClick?: () => void
}

export const Navbar = ({
  logoText = "Wrap & Roll",
  logoHref = "/",
  copy,
  links = [
    { label: "Home", href: "/" },
    { label: "Menu", href: "/menu" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ],
  isAuthenticated = false,
  userInitials = "JD",
  userName = "Guest User",
  currentLocale = "en",
  languages = [
    { code: "en", label: "English" },
    { code: "si", label: "සිංහල" },
    { code: "ta", label: "தமிழ்" },
  ],
  onLanguageChange,
  onSignIn,
  onSignOut,
  onProfileClick,
  onOrderHistoryClick,
  onSettingsClick,
}: NavbarProps) => {
  const ui = { ...defaultNavbarCopy, ...copy }
  const { before: logoBefore, after: logoAfter } = splitLogoText(logoText)
  const [isOpen, setIsOpen] = React.useState(false)
  const [isScrolled, setIsScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        "fixed top-0 z-[100] w-full transition-[padding,background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out",
        isScrolled 
          ? "border-b border-neutral-200/70 bg-white/80 py-2 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.06)]" 
          : "border-b border-white/10 bg-neutral-950/35 py-3 backdrop-blur-lg"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 sm:px-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 10 }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20"
          >
            <ShoppingBag className="h-5 w-5 text-white" />
          </motion.div>
          <a href={logoHref} className={cn(
            "text-xl font-black tracking-tight leading-none transition-colors md:text-2xl",
            /* body sets `a { color: inherit }`; force readable nav colors on transparent bar */
            isScrolled ? "text-neutral-900" : "text-white !text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]"
          )}>
            {logoAfter != null ? (
              <>
                {logoBefore}{" "}
                <span className="text-primary">&</span> {logoAfter}
              </>
            ) : (
              logoBefore
            )}
          </a>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex md:items-center md:gap-10">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "group relative text-sm font-semibold transition-all",
                isScrolled
                  ? "text-neutral-600 hover:text-primary"
                  : "!text-white hover:text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]"
              )}
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 bg-primary transition-all group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-6">
          {/* Language Switcher */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={cn(
                  "flex min-h-9 min-w-[4.5rem] shrink-0 items-center justify-center gap-2 rounded-full border border-transparent px-4 transition-colors",
                  isScrolled 
                    ? "text-neutral-600 hover:bg-neutral-100" 
                    : "text-white/90 hover:bg-white/10 hover:border-white/20"
                )}
              >
                <Globe className="h-4 w-4" />
                <span className="uppercase text-xs font-black tracking-widest">{currentLocale}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={10}
              className="z-[220] w-40 rounded-2xl p-2 shadow-2xl"
            >
              <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                {ui.selectLanguage}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {languages.map((lang) => (
                <DropdownMenuItem
                  key={lang.code}
                  className={cn(
                    "rounded-xl px-3 py-2 text-xs font-bold transition-colors mb-1 cursor-pointer",
                    currentLocale === lang.code ? "bg-primary/10 text-primary" : "text-neutral-600"
                  )}
                  onClick={() => onLanguageChange?.(lang.code)}
                >
                  {lang.label}
                  {currentLocale === lang.code && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            className={cn(
              "h-4 w-px hidden md:block",
              isScrolled ? "bg-neutral-200" : "bg-white/35"
            )}
            aria-hidden
          />

          <div className="hidden md:block">
            {isAuthenticated ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "group flex min-h-10 shrink-0 items-center gap-3 rounded-full px-2 transition-colors",
                      isScrolled ? "hover:bg-neutral-100" : "hover:bg-white/10"
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-black text-white shadow-lg shadow-primary/20 transition-transform group-hover:scale-105">
                      {userInitials}
                    </div>
                    <div className="text-left">
                      <p className={cn("text-xs font-black leading-none mb-1", isScrolled ? "text-neutral-900" : "text-white")}>{userName}</p>
                      <p className={cn("text-[10px] font-bold", isScrolled ? "text-neutral-400" : "text-white/60")}>{ui.account}</p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={10}
                  className="z-[220] w-56 rounded-2xl p-2 shadow-2xl"
                >
                  <DropdownMenuItem className="rounded-xl px-3 py-2.5 text-sm font-bold text-neutral-600 cursor-pointer mb-1" onClick={onProfileClick}>
                    <User className="mr-3 h-4 w-4" />
                    {ui.myProfile}
                  </DropdownMenuItem>
                  {onOrderHistoryClick ? (
                    <DropdownMenuItem
                      className="rounded-xl px-3 py-2.5 text-sm font-bold text-neutral-600 cursor-pointer mb-1"
                      onClick={onOrderHistoryClick}
                    >
                      <History className="mr-3 h-4 w-4" />
                      {ui.orderHistory}
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="rounded-xl px-3 py-2.5 text-sm font-bold text-neutral-600 cursor-pointer mb-1"
                    onClick={onSettingsClick}
                  >
                    <Settings className="mr-3 h-4 w-4" />
                    {ui.settings}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-2" />
                  <DropdownMenuItem 
                    className="rounded-xl px-3 py-2.5 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 cursor-pointer"
                    onClick={onSignOut}
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    {ui.logOut}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={onSignIn} 
                className="rounded-full bg-primary px-6 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-white shadow-lg shadow-primary/30 transition-transform hover:scale-105"
              >
                {ui.signIn}
              </Button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className={cn(
              "inline-flex items-center justify-center rounded-xl p-2 transition-colors md:hidden",
              isScrolled ? "text-neutral-600 hover:bg-neutral-100" : "text-white/90 hover:bg-white/10"
            )}
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-neutral-100 bg-white/95 backdrop-blur-2xl md:hidden"
          >
            <div className="flex flex-col gap-2 p-6">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-xl p-4 text-base font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-primary"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <hr className="my-4 border-neutral-100" />
              
              {isAuthenticated ? (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl p-6 font-black text-neutral-600"
                    onClick={() => {
                      setIsOpen(false)
                      onProfileClick?.()
                    }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">
                      {userInitials}
                    </div>
                    {ui.accountProfile}
                  </Button>
                  {onOrderHistoryClick ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3 rounded-xl p-6 font-black text-neutral-600"
                      onClick={() => {
                        setIsOpen(false)
                        onOrderHistoryClick()
                      }}
                    >
                      <History className="h-5 w-5" />
                      {ui.orderHistory}
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl p-6 font-black text-neutral-600"
                    onClick={() => {
                      setIsOpen(false)
                      onSettingsClick?.()
                    }}
                  >
                    <Settings className="h-5 w-5" />
                    {ui.settings}
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 rounded-xl p-6 font-black text-red-500 hover:bg-red-50"
                    onClick={() => {
                      setIsOpen(false)
                      onSignOut?.()
                    }}
                  >
                    <LogOut className="h-5 w-5" />
                    {ui.signOut}
                  </Button>
                </div>
              ) : (
                <Button onClick={onSignIn} className="w-full rounded-2xl py-8 text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20">
                  {ui.signInToRoll}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
