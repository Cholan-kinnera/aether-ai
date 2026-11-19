from aether.config import Settings
from aether.security import RateLimiter


def test_rate_limiter_blocks_then_recovers(monkeypatch):
    now = [0.0]
    monkeypatch.setattr("aether.security.time.monotonic", lambda: now[0])
    limiter = RateLimiter(limit=2, window_seconds=60)
    assert limiter.check("a") == 0 and limiter.check("a") == 0
    assert limiter.check("a") > 0
    assert limiter.check("b") == 0  # other clients unaffected
    now[0] = 61
    assert limiter.check("a") == 0


def test_rate_limiter_prunes_when_full(monkeypatch):
    monkeypatch.setattr("aether.security.MAX_TRACKED_CLIENTS", 2)
    now = [0.0]
    monkeypatch.setattr("aether.security.time.monotonic", lambda: now[0])
    limiter = RateLimiter(limit=5, window_seconds=10)
    limiter.check("a")
    limiter.check("b")
    now[0] = 50
    limiter.check("c")
    assert set(limiter._hits) == {"c"}


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", " secret ")
    monkeypatch.setenv("CACHE_TTL_SECONDS", "abc")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "5")
    settings = Settings.from_env()
    assert settings.gemini_api_key == "secret"
    assert settings.cache_ttl_seconds == 600 and settings.rate_limit_per_minute == 5
