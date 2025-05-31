import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Simple ping to check if Bitget API is reachable
    const response = await fetch("https://api.bitget.com/api/v2/public/time", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      data: {
        serverTime: data.data,
        timestamp: Date.now(),
      },
    })
  } catch (error) {
    console.error("API status check failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
