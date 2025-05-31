import { NextResponse } from "next/server"
import { BitgetAPI } from "@/lib/bitget-api"

// Create a singleton instance of the API
let apiInstance: BitgetAPI | null = null

function getApiInstance() {
  if (!apiInstance) {
    const apiKey = process.env.BITGET_API_KEY
    const secretKey = process.env.BITGET_SECRET_KEY
    const passphrase = process.env.BITGET_PASSPHRASE

    if (!apiKey || !secretKey || !passphrase) {
      throw new Error("Missing Bitget API credentials")
    }

    apiInstance = new BitgetAPI({
      apiKey,
      secretKey,
      passphrase,
    })
  }
  return apiInstance
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")
  const symbol = searchParams.get("symbol") || "BTCUSDT"

  console.log(`API Request: ${action} for symbol: ${symbol}`)

  try {
    const api = getApiInstance()

    switch (action) {
      case "balance":
        console.log("Fetching account balance...")
        const balances = await api.getAccountBalance()
        console.log("Balance fetched successfully:", balances.length, "assets")
        return NextResponse.json({ success: true, data: balances })

      case "ticker":
        console.log(`Fetching ticker for ${symbol}...`)
        const ticker = await api.getMarketTicker(symbol)
        console.log("Ticker fetched successfully:", ticker.symbol)
        return NextResponse.json({ success: true, data: ticker })

      case "orders":
        console.log(`Fetching orders for ${symbol}...`)
        const orders = await api.getOpenOrders(symbol)
        console.log("Orders fetched successfully:", orders.length, "orders")
        return NextResponse.json({ success: true, data: orders })

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("API error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const api = getApiInstance()
    const body = await request.json()
    const { action, symbol, side, price, size, orderId } = body

    console.log(`API POST Request: ${action}`, body)

    switch (action) {
      case "placeOrder":
        console.log(`Placing ${side} order for ${symbol} at ${price}`)
        const order = await api.placeOrder(symbol, side, price, size)
        console.log("Order placed successfully:", order.orderId)
        return NextResponse.json({ success: true, data: order })

      case "cancelOrder":
        console.log(`Cancelling order ${orderId} for ${symbol}`)
        const result = await api.cancelOrder(symbol, orderId)
        console.log("Order cancellation result:", result)
        return NextResponse.json({ success: true, data: { cancelled: result } })

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("API POST error:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 })
  }
}
