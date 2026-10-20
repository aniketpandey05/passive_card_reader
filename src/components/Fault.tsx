import type { ReactNode } from 'react'

/** The screen for when there is nothing left to do but explain. */
export default function Fault({
  title,
  detail,
  children,
}: {
  title: string
  detail?: string
  children: ReactNode
}) {
  return (
    <div className="fault">
      <h1>{title}</h1>
      <p>{children}</p>
      {detail && <code>{detail}</code>}
      <button className="btn primary" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  )
}
