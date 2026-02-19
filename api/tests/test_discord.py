import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import app.core.config as cfg
from app.services.discord import send_discord_notification


async def test_send_discord_calls_webhook(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    mock_response = MagicMock()
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, return_value=mock_response) as mock_post:
        await send_discord_notification("Test Title", "Test message")
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        if call_kwargs.args:
            assert call_kwargs.args[0] == "https://discord.com/api/webhooks/test"
        else:
            assert call_kwargs.kwargs.get("url") == "https://discord.com/api/webhooks/test"
        payload = call_kwargs.kwargs.get("json") or (call_kwargs.args[1] if len(call_kwargs.args) > 1 else None)
        assert payload is not None
        assert payload["embeds"][0]["title"] == "Test Title"
        assert payload["embeds"][0]["description"] == "Test message"


async def test_send_discord_skipped_when_no_url(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_discord_notification("Title", "Message")
        mock_post.assert_not_called()


async def test_send_discord_silently_handles_network_error(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock, side_effect=Exception("network error")):
        # Must not raise
        await send_discord_notification("Title", "Message")


async def test_send_discord_default_color(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_discord_notification("T", "M")
        payload = mock_post.call_args.kwargs.get("json")
        assert payload["embeds"][0]["color"] == 0x5865F2


async def test_send_discord_custom_color(monkeypatch):
    monkeypatch.setattr(cfg.settings, "discord_webhook_url", "https://discord.com/api/webhooks/test")
    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        await send_discord_notification("T", "M", color=0xFF0000)
        payload = mock_post.call_args.kwargs.get("json")
        assert payload["embeds"][0]["color"] == 0xFF0000
