export interface TradingLimits {
  minInvestment: number
  minOrderValue: number
  maxGridCount: number
  minGridCount: number
  minProfitPerGrid: number
  maxProfitPerGrid: number
}

export const TRADING_LIMITS: TradingLimits = {
  minInvestment: 5, // $5 minimum investment
  minOrderValue: 2, // $2 minimum order value
  maxGridCount: 50,
  minGridCount: 3,
  minProfitPerGrid: 0.1, // 0.1%
  maxProfitPerGrid: 10, // 10%
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

export function validateGridConfig(config: {
  symbol: string
  gridCount: number
  upperPrice: number
  lowerPrice: number
  investment: number
  profitPerGrid: number
}): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate investment amount
  if (config.investment < TRADING_LIMITS.minInvestment) {
    errors.push(`Minimum investment is $${TRADING_LIMITS.minInvestment}`)
  }

  // Validate grid count
  if (config.gridCount < TRADING_LIMITS.minGridCount) {
    errors.push(`Minimum grid count is ${TRADING_LIMITS.minGridCount}`)
  }

  if (config.gridCount > TRADING_LIMITS.maxGridCount) {
    errors.push(`Maximum grid count is ${TRADING_LIMITS.maxGridCount}`)
  }

  // Validate price range
  if (config.upperPrice <= config.lowerPrice) {
    errors.push("Upper price must be greater than lower price")
  }

  if (config.lowerPrice <= 0) {
    errors.push("Lower price must be greater than 0")
  }

  // Validate profit per grid
  if (config.profitPerGrid < TRADING_LIMITS.minProfitPerGrid) {
    errors.push(`Minimum profit per grid is ${TRADING_LIMITS.minProfitPerGrid}%`)
  }

  if (config.profitPerGrid > TRADING_LIMITS.maxProfitPerGrid) {
    errors.push(`Maximum profit per grid is ${TRADING_LIMITS.maxProfitPerGrid}%`)
  }

  // Calculate order size and validate
  const orderSize = config.investment / config.gridCount
  if (orderSize < TRADING_LIMITS.minOrderValue) {
    errors.push(
      `Order size ($${orderSize.toFixed(2)}) is below minimum $${TRADING_LIMITS.minOrderValue}. ` +
        `Reduce grid count or increase investment.`,
    )
  }

  // Warnings
  if (config.gridCount > 20) {
    warnings.push("High grid count may result in many small orders")
  }

  if (config.profitPerGrid < 0.5) {
    warnings.push("Low profit per grid may result in minimal profits after fees")
  }

  const priceRange = ((config.upperPrice - config.lowerPrice) / config.lowerPrice) * 100
  if (priceRange > 50) {
    warnings.push("Large price range may require significant price movement to be profitable")
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

export function calculateGridMetrics(config: {
  gridCount: number
  upperPrice: number
  lowerPrice: number
  investment: number
  profitPerGrid: number
}) {
  const priceStep = (config.upperPrice - config.lowerPrice) / (config.gridCount - 1)
  const orderSize = config.investment / config.gridCount
  const totalPotentialProfit = (config.investment * config.profitPerGrid) / 100
  const priceRange = ((config.upperPrice - config.lowerPrice) / config.lowerPrice) * 100

  return {
    priceStep: Number(priceStep.toFixed(6)),
    orderSize: Number(orderSize.toFixed(2)),
    totalPotentialProfit: Number(totalPotentialProfit.toFixed(2)),
    priceRange: Number(priceRange.toFixed(2)),
    averagePrice: Number(((config.upperPrice + config.lowerPrice) / 2).toFixed(2)),
  }
}
