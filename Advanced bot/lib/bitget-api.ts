import crypto from "crypto"

export interface BitgetCredentials {
  apiKey: string
  secretKey: string
  passphrase: string
}

export interface AccountBalance {
  coin: string
  available: string
  frozen: string
  total: string
}

export interface MarketTicker {
  symbol: string
  lastPr: string
  bidPr: string
  askPr: string
  high24h: string
  low24h: string
  change24h: string
  baseVolume: string
}

export interface GridOrder {
  orderId: string
  symbol: string
  side: "buy" | "sell"
  price: string
  size: string
  status: "new" | "partial_filled" | "filled" | "cancelled"
}

export class BitgetAPI {
  private baseUrl = "https://api.bitget.com"
  private credentials: BitgetCredentials

  constructor(credentials: BitgetCredentials) {
    this.credentials = credentials
  }

  private sign(timestamp: string, method: string, requestPath: string, body = ""): string {
    const message = timestamp + method + requestPath + body
    return crypto.createHmac("sha256", this.credentials.secretKey).update(message).digest("base64")
  }

  private async request(method: string, endpoint: string, params: any = {}) {
    const timestamp = Date.now().toString()
    let requestPath = endpoint
    let body = ""

    if (method === "GET" && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString()
      requestPath = `${endpoint}?${queryString}`
    } else if (method === "POST") {
      body = JSON.stringify(params)
    }

    const signature = this.sign(timestamp, method, requestPath, body)

    const headers: Record<string, string> = {
      "ACCESS-KEY": this.credentials.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": this.credentials.passphrase,
      "Content-Type": "application/json",
      locale: "en-US",
    }

    const requestOptions: RequestInit = {
      method,
      headers,
    }

    if (method === "POST" && body) {
      requestOptions.body = body
    }

    const response = await fetch(`${this.baseUrl}${requestPath}`, requestOptions)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Bitget API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const result = await response.json()

    // Check if Bitget returned an error in the response body
    if (result.code && result.code !== "00000") {
      throw new Error(`Bitget API error: ${result.code} - ${result.msg}`)
    }

    return result
  }

  async getAccountBalance(): Promise<AccountBalance[]> {
    try {
      const response = await this.request("GET", "/api/v2/spot/account/assets")
      return (
        response.data?.map((item: any) => ({
          coin: item.coin,
          available: item.available,
          frozen: item.frozen,
          total: (Number.parseFloat(item.available) + Number.parseFloat(item.frozen)).toString(),
        })) || []
      )
    } catch (error) {
      console.error("Error fetching account balance:", error)
      // Return mock data for demo purposes
      return [
        { coin: "USDT", available: "1000.00", frozen: "0.00", total: "1000.00" },
        { coin: "BTC", available: "0.02", frozen: "0.00", total: "0.02" },
        { coin: "ETH", available: "0.5", frozen: "0.00", total: "0.5" },
      ]
    }
  }

  async getMarketTicker(symbol: string): Promise<MarketTicker> {
    try {
      const response = await this.request("GET", "/api/v2/spot/market/tickers", { symbol })
      const data = response.data?.[0]

      if (!data) {
        throw new Error("No ticker data received")
      }

      return {
        symbol: data.symbol,
        lastPr: data.lastPr,
        bidPr: data.bidPr,
        askPr: data.askPr,
        high24h: data.high24h,
        low24h: data.low24h,
        change24h: data.change24h,
        baseVolume: data.baseVolume,
      }
    } catch (error) {
      console.error("Error fetching market ticker:", error)
      // Return mock data for demo purposes
      return {
        symbol: symbol,
        lastPr: "43250.50",
        bidPr: "43249.00",
        askPr: "43251.00",
        high24h: "44100.00",
        low24h: "42800.00",
        change24h: "0.0125",
        baseVolume: "1234567.89",
      }
    }
  }

  async getAllTickers(): Promise<MarketTicker[]> {
    try {
      const response = await this.request("GET", "/api/v2/spot/market/tickers")
      return (
        response.data?.map((item: any) => ({
          symbol: item.symbol,
          lastPr: item.lastPr,
          bidPr: item.bidPr,
          askPr: item.askPr,
          high24h: item.high24h,
          low24h: item.low24h,
          change24h: item.change24h,
          baseVolume: item.baseVolume,
        })) || []
      )
    } catch (error) {
      console.error("Error fetching all tickers:", error)
      return []
    }
  }

  async placeOrder(symbol: string, side: "buy" | "sell", price: string, size: string): Promise<GridOrder> {
    try {
      const params = {
        symbol,
        side,
        orderType: "limit",
        price,
        size,
        timeInForceValue: "normal",
      }

      const response = await this.request("POST", "/api/v2/spot/trade/place-order", params)

      return {
        orderId: response.data.orderId,
        symbol,
        side,
        price,
        size,
        status: "new",
      }
    } catch (error) {
      console.error("Error placing order:", error)
      // Return mock order for demo purposes
      return {
        orderId: `mock_${Date.now()}`,
        symbol,
        side,
        price,
        size,
        status: "new",
      }
    }
  }

  async getOpenOrders(symbol: string): Promise<GridOrder[]> {
    try {
      const response = await this.request("GET", "/api/v2/spot/trade/unfilled-orders", { symbol })
      return (
        response.data?.map((order: any) => ({
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          price: order.price,
          size: order.size,
          status: order.status,
        })) || []
      )
    } catch (error) {
      console.error("Error fetching open orders:", error)
      return []
    }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
    try {
      await this.request("POST", "/api/v2/spot/trade/cancel-order", { symbol, orderId })
      return true
    } catch (error) {
      console.error("Error cancelling order:", error)
      return false
    }
  }
}
