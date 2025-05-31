export interface GridConfig {
  symbol: string
  gridCount: number
  upperPrice: number
  lowerPrice: number
  investment: number
  profitPerGrid: number
}

export interface GridLevel {
  price: number
  buyOrderId?: string
  sellOrderId?: string
  isFilled: boolean
}

export class GridTradingStrategy {
  private config: GridConfig
  private gridLevels: GridLevel[] = []
  private isActive = false

  constructor(config: GridConfig) {
    this.config = config
    this.initializeGrid()
  }

  private initializeGrid() {
    const priceStep = (this.config.upperPrice - this.config.lowerPrice) / (this.config.gridCount - 1)

    for (let i = 0; i < this.config.gridCount; i++) {
      const price = this.config.lowerPrice + i * priceStep
      this.gridLevels.push({
        price: Number(price.toFixed(6)),
        isFilled: false,
      })
    }
  }

  getGridLevels(): GridLevel[] {
    return this.gridLevels
  }

  getOrderSize(): number {
    return this.config.investment / this.config.gridCount
  }

  getProfitPrice(buyPrice: number): number {
    return buyPrice * (1 + this.config.profitPerGrid / 100)
  }

  updateGridLevel(price: number, orderId: string, type: "buy" | "sell") {
    const level = this.gridLevels.find((l) => Math.abs(l.price - price) < 0.000001)
    if (level) {
      if (type === "buy") {
        level.buyOrderId = orderId
      } else {
        level.sellOrderId = orderId
      }
    }
  }

  markLevelFilled(price: number) {
    const level = this.gridLevels.find((l) => Math.abs(l.price - price) < 0.000001)
    if (level) {
      level.isFilled = true
    }
  }

  getConfig(): GridConfig {
    return this.config
  }

  setActive(active: boolean) {
    this.isActive = active
  }

  isStrategyActive(): boolean {
    return this.isActive
  }
}
