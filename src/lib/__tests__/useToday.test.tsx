import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useToday } from '../useToday'

describe('useToday', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-22T23:59:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('atualiza a cada 60 s quando o dia vira', () => {
    const { result } = renderHook(() => useToday())
    expect(result.current).toBe('2026-11-22')
    act(() => {
      vi.setSystemTime(new Date('2026-11-23T00:01:00'))
      vi.advanceTimersByTime(60_000)
    })
    expect(result.current).toBe('2026-11-23')
  })

  it('atualiza quando a aba volta a ficar visível', () => {
    const { result } = renderHook(() => useToday())
    act(() => {
      vi.setSystemTime(new Date('2026-11-24T08:00:00'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-11-24')
  })
})
