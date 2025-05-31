"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { BitgetAPI, AccountBalance, MarketTicker, GridOrder } from "@/lib/bitget-api"
import { GridTradingStrategy, type GridConfig } from "@/lib/grid-strategy"
import { Play, Square, TrendingUp, DollarSign, Activity } from "lucide-react"
import APIStatusMonitor from "@/components/api-status-monitor"
import { validateGridConfig, calculateGridMetrics, TRADING_LIMITS } from "@/lib/trading-validation"

export default function GridBotDashboard() {
  const [api, setApi] = useState<BitgetAPI | null>(null)
  const [strategy, setStrategy] = useState<GridTradingStrategy | null>(null)
  const [balances, setBalances] = useState<AccountBalance[]>([])
  const [ticker, setTicker] = useState<MarketTicker | null>(null)
  const [orders, setOrders] = useState<GridOrder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)

  // Grid configuration
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    symbol: "BTCUSDT",
    gridCount: 10,
    upperPrice: 45000,
    lowerPrice: 40000,
    investment: 1000,
    profitPerGrid: 0.5,
  })

  // Statistics
  const [stats, setStats] = useState({
    totalProfit: 0,
    completedGrids: 0,
    activeOrders: 0,
    winRate: 0,
  })

  const [validationResult, setValidationResult] = useState<any>(null)
  const [gridMetrics, setGridMetrics] = useState<any>(null)

  useEffect(() => {
    initializeAPI()
  }, [])

  useEffect(() => {
    if (api && isRunning) {
      const interval = setInterval(() => {
        updateMarketData()
        updateOrders()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [api, isRunning])

  useEffect(() => {
    const result = validateGridConfig(gridConfig)
    const metrics = calculateGridMetrics(gridConfig)
    setValidationResult(result)
    setGridMetrics(metrics)
  }, [gridConfig])

  const initializeAPI = async () => {
    try {
      // We don't need to initialize the API with credentials on the client
      // Just set a placeholder to indicate we're ready to make API calls
      setApi({} as BitgetAPI)

      // Load initial data
      await loadAccountData()
      await loadMarketData()
    } catch (err) {
      setError(`Failed to initialize API: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const loadAccountData = async () => {
    try {
      const response = await fetch(`/api/bitget?action=balance`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      setBalances(result.data)
    } catch (err) {
      setError(`Failed to load account data: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const loadMarketData = async () => {
    try {
      const response = await fetch(`/api/bitget?action=ticker&symbol=${gridConfig.symbol}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      setTicker(result.data)
    } catch (err) {
      setError(`Failed to load market data: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const updateMarketData = async () => {
    try {
      const response = await fetch(`/api/bitget?action=ticker&symbol=${gridConfig.symbol}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      setTicker(result.data)
    } catch (err) {
      console.error("Failed to update market data:", err)
    }
  }

  const updateOrders = async () => {
    try {
      const response = await fetch(`/api/bitget?action=orders&symbol=${gridConfig.symbol}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      setOrders(result.data)
      setStats((prev) => ({ ...prev, activeOrders: result.data.length }))
    } catch (err) {
      console.error("Failed to update orders:", err)
    }
  }

  const startGridBot = async () => {
    // Add validation check at the beginning
    if (!validationResult?.isValid) {
      setError("Please fix configuration errors before starting the bot")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const newStrategy = new GridTradingStrategy(gridConfig)
      setStrategy(newStrategy)

      // Place initial grid orders
      const gridLevels = newStrategy.getGridLevels()
      const orderSize = newStrategy.getOrderSize()

      for (const level of gridLevels) {
        try {
          const response = await fetch("/api/bitget", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              action: "placeOrder",
              symbol: gridConfig.symbol,
              side: "buy",
              price: level.price.toString(),
              size: (orderSize / level.price).toFixed(6),
            }),
          })

          const result = await response.json()

          if (!result.success) {
            throw new Error(result.error)
          }

          newStrategy.updateGridLevel(level.price, result.data.orderId, "buy")
        } catch (err) {
          console.error(`Failed to place order at ${level.price}:`, err)
        }
      }

      newStrategy.setActive(true)
      setIsRunning(true)
      await updateOrders()
    } catch (err) {
      setError(`Failed to start grid bot: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const stopGridBot = async () => {
    if (!strategy) return

    setIsLoading(true)

    try {
      // Get open orders
      const response = await fetch(`/api/bitget?action=orders&symbol=${gridConfig.symbol}`)
      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      const openOrders = result.data

      // Cancel all open orders
      for (const order of openOrders) {
        await fetch("/api/bitget", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "cancelOrder",
            symbol: gridConfig.symbol,
            orderId: order.orderId,
          }),
        })
      }

      strategy.setActive(false)
      setIsRunning(false)
      setOrders([])
    } catch (err) {
      setError(`Failed to stop grid bot: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
    }
  }

  const formatPrice = (price: string | number) => {
    return Number(price).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })
  }

  const formatPercentage = (value: string) => {
    const num = Number(value)
    return `${num >= 0 ? "+" : ""}${(num * 100).toFixed(2)}%`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white">Bitget Grid Trading Bot</h1>
          <p className="text-slate-300">Advanced algorithmic trading with real-time market data</p>
        </div>

        {error && (
          <Alert className="border-red-500 bg-red-500/10">
            <AlertDescription className="text-red-400">{error}</AlertDescription>
          </Alert>
        )}

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Market Overview */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Market Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticker ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Symbol</span>
                    <Badge variant="outline" className="text-white border-slate-600">
                      {ticker.symbol}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">Last Price</span>
                    <span className="text-white font-mono">${formatPrice(ticker.lastPr)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">24h Change</span>
                    <span className={`font-mono ${Number(ticker.change24h) >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {formatPercentage(ticker.change24h)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">24h High</span>
                    <span className="text-white font-mono">${formatPrice(ticker.high24h)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">24h Low</span>
                    <span className="text-white font-mono">${formatPrice(ticker.low24h)}</span>
                  </div>
                </>
              ) : (
                <div className="text-slate-400">Loading market data...</div>
              )}
            </CardContent>
          </Card>

          {/* Account Balance */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Account Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {balances.length > 0 ? (
                balances.slice(0, 5).map((balance) => (
                  <div key={balance.coin} className="flex justify-between items-center">
                    <span className="text-slate-300">{balance.coin}</span>
                    <div className="text-right">
                      <div className="text-white font-mono">{formatPrice(balance.available)}</div>
                      <div className="text-xs text-slate-400">Available</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400">Loading balances...</div>
              )}
            </CardContent>
          </Card>

          {/* Trading Statistics */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Trading Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Total Profit</span>
                <span className="text-green-400 font-mono">${stats.totalProfit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Completed Grids</span>
                <span className="text-white font-mono">{stats.completedGrids}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Active Orders</span>
                <span className="text-blue-400 font-mono">{stats.activeOrders}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-300">Win Rate</span>
                <span className="text-white font-mono">{stats.winRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* API Status Monitor */}
          <div className="lg:col-span-3">
            <APIStatusMonitor />
          </div>
        </div>

        {/* Grid Configuration and Control */}
        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800/50">
            <TabsTrigger value="config" className="text-white">
              Configuration
            </TabsTrigger>
            <TabsTrigger value="grid" className="text-white">
              Grid Levels
            </TabsTrigger>
            <TabsTrigger value="orders" className="text-white">
              Active Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Grid Configuration</CardTitle>
                <CardDescription className="text-slate-300">Configure your grid trading parameters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="symbol" className="text-slate-300">
                      Trading Pair
                    </Label>
                    <Input
                      id="symbol"
                      value={gridConfig.symbol}
                      onChange={(e) => setGridConfig((prev) => ({ ...prev, symbol: e.target.value }))}
                      className="bg-slate-700 border-slate-600 text-white"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gridCount" className="text-slate-300">
                      Grid Count
                    </Label>
                    <Input
                      id="gridCount"
                      type="number"
                      min={TRADING_LIMITS.minGridCount}
                      max={TRADING_LIMITS.maxGridCount}
                      value={gridConfig.gridCount}
                      onChange={(e) =>
                        setGridConfig((prev) => ({
                          ...prev,
                          gridCount: Math.max(
                            TRADING_LIMITS.minGridCount,
                            Math.min(TRADING_LIMITS.maxGridCount, Number(e.target.value)),
                          ),
                        }))
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="investment" className="text-slate-300">
                      Investment ($)
                    </Label>
                    <Input
                      id="investment"
                      type="number"
                      min={TRADING_LIMITS.minInvestment}
                      value={gridConfig.investment}
                      onChange={(e) =>
                        setGridConfig((prev) => ({
                          ...prev,
                          investment: Math.max(TRADING_LIMITS.minInvestment, Number(e.target.value)),
                        }))
                      }
                      className="bg-slate-700 border-slate-600 text-white"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="upperPrice" className="text-slate-300">
                      Upper Price ($)
                    </Label>
                    <Input
                      id="upperPrice"
                      type="number"
                      value={gridConfig.upperPrice}
                      onChange={(e) => setGridConfig((prev) => ({ ...prev, upperPrice: Number(e.target.value) }))}
                      className="bg-slate-700 border-slate-600 text-white"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowerPrice" className="text-slate-300">
                      Lower Price ($)
                    </Label>
                    <Input
                      id="lowerPrice"
                      type="number"
                      value={gridConfig.lowerPrice}
                      onChange={(e) => setGridConfig((prev) => ({ ...prev, lowerPrice: Number(e.target.value) }))}
                      className="bg-slate-700 border-slate-600 text-white"
                      disabled={isRunning}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profitPerGrid" className="text-slate-300">
                      Profit per Grid (%)
                    </Label>
                    <Input
                      id="profitPerGrid"
                      type="number"
                      step="0.1"
                      value={gridConfig.profitPerGrid}
                      onChange={(e) => setGridConfig((prev) => ({ ...prev, profitPerGrid: Number(e.target.value) }))}
                      className="bg-slate-700 border-slate-600 text-white"
                      disabled={isRunning}
                    />
                  </div>
                </div>

                {/* Validation Results */}
                {validationResult && (
                  <div className="space-y-4">
                    {validationResult.errors.length > 0 && (
                      <Alert className="border-red-500 bg-red-500/10">
                        <AlertDescription className="text-red-400">
                          <div className="font-medium mb-2">Configuration Errors:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {validationResult.errors.map((error: string, index: number) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {validationResult.warnings.length > 0 && (
                      <Alert className="border-yellow-500 bg-yellow-500/10">
                        <AlertDescription className="text-yellow-400">
                          <div className="font-medium mb-2">Warnings:</div>
                          <ul className="list-disc list-inside space-y-1">
                            {validationResult.warnings.map((warning: string, index: number) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}

                    {gridMetrics && (
                      <Card className="bg-slate-700/50 border-slate-600">
                        <CardHeader>
                          <CardTitle className="text-white text-sm">Grid Metrics</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Order Size:</span>
                            <span className="text-white">${gridMetrics.orderSize}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Price Step:</span>
                            <span className="text-white">${gridMetrics.priceStep}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Price Range:</span>
                            <span className="text-white">{gridMetrics.priceRange}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-300">Potential Profit:</span>
                            <span className="text-green-400">${gridMetrics.totalPotentialProfit}</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={startGridBot}
                    disabled={isLoading || isRunning || !api}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isLoading ? "Starting..." : "Start Grid Bot"}
                  </Button>
                  <Button onClick={stopGridBot} disabled={isLoading || !isRunning} variant="destructive">
                    <Square className="h-4 w-4 mr-2" />
                    {isLoading ? "Stopping..." : "Stop Grid Bot"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grid">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Grid Levels</CardTitle>
                <CardDescription className="text-slate-300">Current grid configuration and status</CardDescription>
              </CardHeader>
              <CardContent>
                {strategy ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {strategy.getGridLevels().map((level, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg">
                        <span className="text-slate-300">Level {index + 1}</span>
                        <span className="text-white font-mono">${formatPrice(level.price)}</span>
                        <Badge
                          variant={level.isFilled ? "default" : "outline"}
                          className={level.isFilled ? "bg-green-600" : "border-slate-600 text-slate-300"}
                        >
                          {level.isFilled ? "Filled" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-center py-8">Start the grid bot to see grid levels</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Active Orders</CardTitle>
                <CardDescription className="text-slate-300">Currently active trading orders</CardDescription>
              </CardHeader>
              <CardContent>
                {orders.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {orders.map((order) => (
                      <div
                        key={order.orderId}
                        className="flex justify-between items-center p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="text-white font-mono text-sm">{order.orderId.slice(0, 8)}...</div>
                          <Badge
                            variant={order.side === "buy" ? "default" : "destructive"}
                            className={order.side === "buy" ? "bg-green-600" : "bg-red-600"}
                          >
                            {order.side.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-white font-mono">${formatPrice(order.price)}</div>
                          <div className="text-slate-400 text-sm">{order.size}</div>
                        </div>
                        <Badge variant="outline" className="border-slate-600 text-slate-300">
                          {order.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-400 text-center py-8">No active orders</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
