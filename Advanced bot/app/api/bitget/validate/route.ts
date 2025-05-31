import { NextResponse } from "next/server"
import { BitgetAPI } from "@/lib/bitget-api"

export async function GET() {
  try {
    const apiKey = process.env.BITGET_API_KEY
    const secretKey = process.env.BITGET_SECRET_KEY
    const passphrase = process.env.BITGET_PASSPHRASE

    if (!apiKey || !secretKey || !passphrase) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing API credentials in environment variables",
        },
        { status: 400 },
      )
    }

    const api = new BitgetAPI({
      apiKey,
      secretKey,
      passphrase,
    })

    // Test basic API access
    try {
      await api.getAccountBalance()
      const permissions = {
        spot: true,
        futures: false, // We'll assume futures is not enabled for safety
        read: true,
        trade: true,
      }

      return NextResponse.json({
        success: true,
        data: {
          permissions,
          message: "API credentials are valid and have required permissions",
        },
      })
    } catch (apiError) {
      // Try to determine what permissions are missing based on the error
      const errorMessage = apiError instanceof Error ? apiError.message : "Unknown API error"

      const permissions = {
        spot: false,
        futures: false,
        read: false,
        trade: false,
      }

      // Basic error analysis
      if (errorMessage.includes("signature")) {
        return NextResponse.json({
          success: false,
          error: "Invalid API signature - check your secret key and passphrase",
          data: { permissions },
        })
      }

      if (errorMessage.includes("key")) {
        return NextResponse.json({
          success: false,
          error: "Invalid API key",
          data: { permissions },
        })
      }

      if (errorMessage.includes("permission")) {
        return NextResponse.json({
          success: false,
          error: "Insufficient API permissions - enable spot trading and read access",
          data: { permissions },
        })
      }

      return NextResponse.json({
        success: false,
        error: `API validation failed: ${errorMessage}`,
        data: { permissions },
      })
    }
  } catch (error) {
    console.error("Validation error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Validation failed",
      },
      { status: 500 },
    )
  }
}
