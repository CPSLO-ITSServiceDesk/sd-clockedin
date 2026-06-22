const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"

interface HealthResponse {
  status?: string
}

async function pingHealth(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return false

    const body = (await res.json()) as HealthResponse
    return body.status === "OK"
  } catch {
    return false
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  return pingHealth(`${API_BASE}/health`)
}

export async function checkFrontendHealth(): Promise<boolean> {
  return pingHealth("/api/health")
}

export type SystemHealthStatus = "checking" | "operational" | "degraded" | "offline"

export interface SystemHealthState {
  status: SystemHealthStatus
  frontend: boolean
  backend: boolean
}

export async function checkSystemHealth(): Promise<SystemHealthState> {
  const [frontend, backend] = await Promise.all([
    checkFrontendHealth(),
    checkBackendHealth(),
  ])

  let status: SystemHealthStatus = "offline"
  if (frontend && backend) {
    status = "operational"
  } else if (frontend || backend) {
    status = "degraded"
  }

  return { status, frontend, backend }
}
