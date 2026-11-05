import type { ReactNode } from 'react'

/** Empty state for pages whose content arrives in later phases. */
export function PlaceholderPage({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <section className="px-4 py-6">
      <h1 className="font-display text-4xl tracking-wide uppercase">{title}</h1>
      <p className="mt-3 text-text-secondary">{body}</p>
      {children}
    </section>
  )
}
