import * as React from "react"
import { cn } from "../lib/utils"

export function AuthPageShell({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-slate-100 p-6 font-sans",
        "bg-[radial-gradient(ellipse_at_0%_0%,hsla(14,100%,57%,0.05),transparent_50%),radial-gradient(ellipse_at_100%_100%,hsla(14,100%,65%,0.05),transparent_50%)]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function AuthSplitCard({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[960px] min-h-[600px] overflow-hidden rounded-3xl bg-card text-card-foreground shadow-xl",
        "animate-in zoom-in-95 duration-500",
        "max-[900px]:max-h-none max-[900px]:min-h-0 max-[900px]:max-w-[440px] max-[900px]:flex-col max-[900px]:rounded-[20px]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function AuthBannerSection({
  imageSrc,
  imageAlt,
  title,
  description,
  className,
}: {
  imageSrc: string
  imageAlt: string
  title: React.ReactNode
  description: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "group relative flex flex-[1.1] flex-col justify-end overflow-hidden p-12 text-white",
        "max-[900px]:h-[300px] max-[900px]:flex-none max-[900px]:justify-center max-[900px]:p-8 max-[900px]:text-center",
        className
      )}
    >
      <img
        src={imageSrc}
        alt={imageAlt}
        className="absolute inset-0 z-0 h-full w-full object-cover brightness-[0.9] saturate-[1.1] transition-transform duration-[10000ms] ease-out group-hover:scale-110"
      />
      <div
        className="absolute inset-0 z-[2] bg-gradient-to-b from-transparent from-20% via-[hsla(14,100%,40%,0.6)] via-70% to-[hsl(14,100%,30%)]"
        aria-hidden
      />
      <div className="relative z-[3]">
        <h2 className="mb-6 font-display text-[3.25rem] font-[1000] uppercase leading-[0.9] tracking-tight max-[900px]:text-4xl">
          {title}
        </h2>
        <p className="max-w-[320px] border-l-4 border-white/50 pl-6 text-lg font-semibold leading-snug opacity-90 max-[900px]:hidden">
          {description}
        </p>
      </div>
    </section>
  )
}

export function AuthFormPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-1 flex-col justify-center bg-card px-14 py-12 max-[900px]:px-8 max-[900px]:py-10",
        className
      )}
    >
      {children}
    </section>
  )
}

export function AuthFormHeader({
  logo,
  title,
  description,
}: {
  logo?: React.ReactNode
  title: string
  description: React.ReactNode
}) {
  return (
    <div className="mb-8">
      {logo != null ? (
        <span className="mb-4 block text-4xl drop-shadow-[0_8px_12px_hsla(14,100%,57%,0.2)]">
          {logo}
        </span>
      ) : null}
      <h1 className="mb-2 font-display text-4xl font-black tracking-tight text-slate-800">
        {title}
      </h1>
      <p className="text-base leading-relaxed text-slate-500">{description}</p>
    </div>
  )
}

export function AuthForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props} />
  )
}

export function AuthFormFooter({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <footer
      className={cn(
        "mt-10 border-t border-slate-100 pt-8 text-center text-[0.95rem] text-slate-500",
        className
      )}
    >
      {children}
    </footer>
  )
}

export function AuthFooterLinkButton({
  children,
  onClick,
}: {
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 cursor-pointer border-0 bg-transparent text-[0.8rem] font-black uppercase tracking-widest text-primary transition-transform hover:scale-105 hover:underline"
    >
      {children}
    </button>
  )
}

export function AuthSuccessPanel({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "animate-in fade-in slide-in-from-bottom-4 duration-500",
        className
      )}
    >
      {children}
    </div>
  )
}

export function AuthSuccessIcon({ emoji = "📬" }: { emoji?: string }) {
  return (
    <div className="relative mx-auto mb-8 flex h-[100px] w-[100px] items-center justify-center">
      <span
        className="absolute inset-0 rounded-full bg-primary opacity-10 animate-auth-pulse-soft"
        aria-hidden
      />
      <span className="relative z-[2] text-6xl" aria-hidden>
        {emoji}
      </span>
    </div>
  )
}
