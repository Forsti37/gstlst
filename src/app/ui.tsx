import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'own' | 'social' | 'quiet' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-text-primary text-bg',
  own: 'bg-red text-white',
  social: 'bg-blue text-white',
  quiet: 'bg-surface-2 text-text-primary',
  danger: 'border border-red text-red',
}

export function Button({
  variant = 'quiet',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-lg px-4 font-semibold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  )
}

export function TextField({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-text-secondary">{label}</span>
      <input
        className="min-h-touch w-full rounded-lg border border-surface-2 bg-surface-1 px-3 text-text-primary placeholder:text-text-secondary"
        {...props}
      />
      {hint && <span className="mt-1 block text-xs text-text-secondary">{hint}</span>}
    </label>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-text-secondary uppercase">{title}</h2>
      {children}
    </section>
  )
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-2 text-sm text-red">
      {children}
    </p>
  )
}

export function FullScreenMessage({ children }: { children: ReactNode }) {
  return <div className="grid h-dvh place-items-center px-6 text-center text-text-secondary">{children}</div>
}
