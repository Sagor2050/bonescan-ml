import type { ReactNode } from 'react'
import { matchPath, usePath, type RouteParams } from './router.ts'

export type Route = {
  path: string
  render: (params: RouteParams) => ReactNode
}

type RoutesProps = {
  routes: Route[]
  notFound: ReactNode
}

function Routes({ routes, notFound }: RoutesProps) {
  const path = usePath()
  for (const route of routes) {
    const params = matchPath(route.path, path)
    if (params) return route.render(params)
  }
  return notFound
}

export default Routes
