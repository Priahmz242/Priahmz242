"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react"

interface APIStatus {
  isConnected: boolean
  lastCheck: Date
  responseTime: number
  error?: string
}

interface APIValidation {
  isValid: boolean
  permissions: {
    spot: boolean
    futures: boolean
    read: boolean
    trade: boolean
  }
  error?: string
}

export default function APIStatusMonitor() {
  const [apiStatus, setApiStatus] = useState<APIStatus>({
    isConnected: false,
    lastCheck: new Date(),
    responseTime: 0,
  })
  const [apiValidation, setApiValidation] = useState<APIValidation | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    // Check API status on component mount
    checkAPIStatus()

    // Set up periodic status checks every 30 seconds
    const interval = setInterval(checkAPIStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkAPIStatus = async () => {
    setIsChecking(true)
    const startTime = Date.now()

    try {
      const response = await fetch("/api/bitget/status")
      const result = await response.json()
      const responseTime = Date.now() - startTime

      setApiStatus({
        isConnected: result.success,
        lastCheck: new Date(),
        responseTime,
        error: result.success ? undefined : result.error,
      })
    } catch (error) {
      setApiStatus({
        isConnected: false,
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Connection failed",
      })
    } finally {
      setIsChecking(false)
    }
  }

  const validateAPICredentials = async () => {
    setIsValidating(true)

    try {
      const response = await fetch("/api/bitget/validate")
      const result = await response.json()

      setApiValidation({
        isValid: result.success,
        permissions: result.data?.permissions || {
          spot: false,
          futures: false,
          read: false,
          trade: false,
        },
        error: result.success ? undefined : result.error,
      })
    } catch (error) {
      setApiValidation({
        isValid: false,
        permissions: {
          spot: false,
          futures: false,
          read: false,
          trade: false,
        },
        error: error instanceof Error ? error.message : "Validation failed",
      })
    } finally {
      setIsValidating(false)
    }
  }

  const getStatusIcon = () => {
    if (isChecking) return <RefreshCw className="h-4 w-4 animate-spin" />
    if (apiStatus.isConnected) return <CheckCircle className="h-4 w-4 text-green-500" />
    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const getStatusColor = () => {
    if (apiStatus.isConnected) return "bg-green-500"
    return "bg-red-500"
  }

  const getResponseTimeColor = () => {
    if (apiStatus.responseTime < 500) return "text-green-400"
    if (apiStatus.responseTime < 1000) return "text-yellow-400"
    return "text-red-400"
  }

  return (
    <div className="space-y-4">
      {/* API Connection Status */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            {apiStatus.isConnected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            API Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-slate-300">Connection</span>
            </div>
            <Badge className={`${getStatusColor()} text-white`}>
              {apiStatus.isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300">Response Time</span>
            <span className={`font-mono ${getResponseTimeColor()}`}>{apiStatus.responseTime}ms</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300">Last Check</span>
            <span className="text-white font-mono text-sm">{apiStatus.lastCheck.toLocaleTimeString()}</span>
          </div>

          {apiStatus.error && (
            <Alert className="border-red-500 bg-red-500/10">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-400">{apiStatus.error}</AlertDescription>
            </Alert>
          )}

          <Button
            onClick={checkAPIStatus}
            disabled={isChecking}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
            {isChecking ? "Checking..." : "Check Status"}
          </Button>
        </CardContent>
      </Card>

      {/* API Validation */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            API Credentials Validation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {apiValidation ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Credentials Valid</span>
                <Badge className={apiValidation.isValid ? "bg-green-500" : "bg-red-500"}>
                  {apiValidation.isValid ? "Valid" : "Invalid"}
                </Badge>
              </div>

              <div className="space-y-2">
                <h4 className="text-white font-medium">Permissions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm">Spot Trading</span>
                    <Badge variant={apiValidation.permissions.spot ? "default" : "outline"}>
                      {apiValidation.permissions.spot ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm">Futures Trading</span>
                    <Badge variant={apiValidation.permissions.futures ? "default" : "outline"}>
                      {apiValidation.permissions.futures ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm">Read Access</span>
                    <Badge variant={apiValidation.permissions.read ? "default" : "outline"}>
                      {apiValidation.permissions.read ? "✓" : "✗"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm">Trade Access</span>
                    <Badge variant={apiValidation.permissions.trade ? "default" : "outline"}>
                      {apiValidation.permissions.trade ? "✓" : "✗"}
                    </Badge>
                  </div>
                </div>
              </div>

              {apiValidation.error && (
                <Alert className="border-red-500 bg-red-500/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-red-400">{apiValidation.error}</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-slate-400 text-center py-4">Click "Validate Credentials" to check your API setup</div>
          )}

          <Button
            onClick={validateAPICredentials}
            disabled={isValidating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            <CheckCircle className={`h-4 w-4 mr-2 ${isValidating ? "animate-spin" : ""}`} />
            {isValidating ? "Validating..." : "Validate Credentials"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
