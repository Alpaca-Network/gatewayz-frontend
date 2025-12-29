type NavigatorConnection = {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
}

type AdaptiveTimeoutOptions = {
  slowNetworkMultiplier?: number
  mobileMultiplier?: number
  hiddenMultiplier?: number
  maxMs?: number
  minMs?: number
}

const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/iu

const DEFAULT_SLOW_MULTIPLIER = 2.5
const DEFAULT_MOBILE_MULTIPLIER = 1.75
const DEFAULT_BACKGROUND_MULTIPLIER = 1.4

const getNavigatorConnection = (): NavigatorConnection | null => {
  if (typeof navigator === "undefined") {
    return null
  }

  const navWithConnection = navigator as Navigator & {
    connection?: NavigatorConnection
    mozConnection?: NavigatorConnection
    webkitConnection?: NavigatorConnection
  }

  return (
    navWithConnection.connection ||
    navWithConnection.mozConnection ||
    navWithConnection.webkitConnection ||
    null
  )
}

const isMobileDevice = (): boolean => {
  if (typeof navigator === "undefined") {
    return false
  }

  const ua = navigator.userAgent || ""
  if (MOBILE_REGEX.test(ua)) {
    return true
  }

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    try {
      return window.matchMedia("(pointer: coarse)").matches
    } catch {
      return false
    }
  }

  return false
}

/**
 * Returns a timeout that automatically stretches when we detect constrained
 * network conditions (slow 2G/3G, data saver, mobile radio, background tab, etc).
 * This prevents aggressive AbortController timeouts from tripping on high latency
 * devices while keeping fast networks responsive.
 */
export const getAdaptiveTimeout = (
  baseMs: number,
  options: AdaptiveTimeoutOptions = {}
): number => {
  if (!Number.isFinite(baseMs) || baseMs <= 0) {
    return baseMs
  }

  if (typeof window === "undefined") {
    return Math.ceil(baseMs)
  }

  let timeout = baseMs
  const connection = getNavigatorConnection()

  if (connection) {
    const effectiveType = (connection.effectiveType || "").toLowerCase()
    const slowMultiplier = options.slowNetworkMultiplier ?? DEFAULT_SLOW_MULTIPLIER

    if (effectiveType === "slow-2g" || effectiveType === "2g") {
      timeout *= slowMultiplier * 1.3
    } else if (effectiveType === "3g") {
      timeout *= slowMultiplier
    } else if (connection.downlink !== undefined && connection.downlink < 1.5) {
      timeout *= Math.max(1.3, slowMultiplier - 0.5)
    }

    if (connection.saveData) {
      timeout *= 1.25
    }
  }

  if (isMobileDevice()) {
    const mobileMultiplier = options.mobileMultiplier ?? DEFAULT_MOBILE_MULTIPLIER
    timeout = Math.max(timeout, baseMs * mobileMultiplier)
  }

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    const hiddenMultiplier = options.hiddenMultiplier ?? DEFAULT_BACKGROUND_MULTIPLIER
    timeout = Math.max(timeout, baseMs * hiddenMultiplier)
  }

  const minClamp = options.minMs ?? baseMs
  const maxClamp = options.maxMs ?? baseMs * 4

  timeout = Math.max(minClamp, timeout)
  timeout = Math.min(maxClamp, timeout)

  return Math.ceil(timeout)
}
