import type { ReactNode } from "react"

type Props = {
  title: string
  children: ReactNode
}

export function SectionCard({ title, children }: Props) {
  return (
    <section className="section-card">
      <h2 className="section-title">{title}</h2>
      <div className="section-body">{children}</div>
    </section>
  )
}
