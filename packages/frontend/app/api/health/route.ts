import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    status: "OK",
    timestamp: new Date().toISOString(),
  })
}
