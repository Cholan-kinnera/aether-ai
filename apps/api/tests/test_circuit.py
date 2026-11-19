"""Unit tests for Circuit Breaker and bounded resilience mechanism."""

from __future__ import annotations

import asyncio
import unittest

from app.core.circuit import CircuitBreaker, CircuitState


class TestCircuitBreaker(unittest.IsolatedAsyncioTestCase):
    """Test suite for Circuit Breaker resilience."""

    async def test_circuit_breaker_normal_execution(self) -> None:
        breaker = CircuitBreaker(
            name="test-breaker",
            failure_threshold=2,
            recovery_timeout_seconds=0.1,
            request_timeout_seconds=0.5,
        )

        async def primary(val: int) -> int:
            return val * 2

        async def fallback(val: int) -> int:
            return 0

        result, used_fallback = await breaker.execute_with_fallback(primary, fallback, 5)
        self.assertEqual(result, 10)
        self.assertFalse(used_fallback)
        self.assertEqual(breaker.state, CircuitState.CLOSED)

    async def test_circuit_breaker_tripping_and_fallback(self) -> None:
        breaker = CircuitBreaker(
            name="test-breaker",
            failure_threshold=2,
            recovery_timeout_seconds=0.2,
            request_timeout_seconds=0.2,
        )

        async def failing_primary() -> str:
            raise ConnectionError("Primary service unreachable")

        async def fallback() -> str:
            return "fallback-response"

        # First failure
        result1, used_fallback1 = await breaker.execute_with_fallback(failing_primary, fallback)
        self.assertEqual(result1, "fallback-response")
        self.assertTrue(used_fallback1)
        self.assertEqual(breaker.state, CircuitState.CLOSED)  # 1 failure < threshold 2

        # Second failure -> trips circuit to OPEN
        result2, used_fallback2 = await breaker.execute_with_fallback(failing_primary, fallback)
        self.assertEqual(result2, "fallback-response")
        self.assertTrue(used_fallback2)
        self.assertEqual(breaker.state, CircuitState.OPEN)

        # While OPEN, primary function is not even called (fail-fast)
        primary_called = False

        async def probe_primary() -> str:
            nonlocal primary_called
            primary_called = True
            return "ok"

        result3, used_fallback3 = await breaker.execute_with_fallback(probe_primary, fallback)
        self.assertEqual(result3, "fallback-response")
        self.assertTrue(used_fallback3)
        self.assertFalse(primary_called)  # Verified fail-fast directly to fallback

    async def test_circuit_breaker_bounded_timeout(self) -> None:
        breaker = CircuitBreaker(
            name="test-breaker",
            failure_threshold=1,
            recovery_timeout_seconds=1.0,
            request_timeout_seconds=0.05,  # 50ms bounded timeout
        )

        async def slow_primary() -> str:
            await asyncio.sleep(0.3)  # Exceeds 50ms
            return "slow-result"

        async def fallback() -> str:
            return "timeout-fallback"

        result, used_fallback = await breaker.execute_with_fallback(slow_primary, fallback)
        self.assertEqual(result, "timeout-fallback")
        self.assertTrue(used_fallback)
        self.assertEqual(breaker.state, CircuitState.OPEN)

    async def test_circuit_breaker_recovery_to_half_open(self) -> None:
        breaker = CircuitBreaker(
            name="test-breaker",
            failure_threshold=1,
            recovery_timeout_seconds=0.1,  # Fast recovery for test
            request_timeout_seconds=0.2,
        )

        async def failing_primary() -> str:
            raise ValueError("Boom")

        async def healthy_primary() -> str:
            return "recovered"

        async def fallback() -> str:
            return "fallback"

        # Trip the breaker
        await breaker.execute_with_fallback(failing_primary, fallback)
        self.assertEqual(breaker.state, CircuitState.OPEN)

        # Wait for recovery timeout
        await asyncio.sleep(0.15)
        self.assertEqual(breaker.state, CircuitState.HALF_OPEN)

        # Successful call in HALF_OPEN restores CLOSED state
        result, used_fallback = await breaker.execute_with_fallback(healthy_primary, fallback)
        self.assertEqual(result, "recovered")
        self.assertFalse(used_fallback)
        self.assertEqual(breaker.state, CircuitState.CLOSED)


if __name__ == "__main__":
    unittest.main()
