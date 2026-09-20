import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-10">{children}</div>
    </div>
  )
}

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => (
    <Shell>
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-muted-foreground">
        That page is not part of the guide.
      </p>
      <Link to="/" className="mt-6 inline-block underline">
        Back to the start
      </Link>
    </Shell>
  ),
  errorComponent: ({ error }) => (
    <Shell>
      <h1 className="text-2xl font-semibold">Something broke</h1>
      <p className="mt-2 text-muted-foreground">
        {error instanceof Error ? error.message : 'Unknown error'}
      </p>
      <Link to="/" className="mt-6 inline-block underline">
        Back to the start
      </Link>
    </Shell>
  ),
})
