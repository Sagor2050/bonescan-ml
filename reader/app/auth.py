"""Accept requests only from our site with a signed-in user's token (Plan, M4)."""

import os
import urllib.error
import urllib.request

DEFAULT_ORIGINS = "http://localhost:5173"
TIMEOUT_SECONDS = 5


def allowed_origins() -> list[str]:
    configured = os.environ.get("ALLOWED_ORIGINS", DEFAULT_ORIGINS)
    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def token_is_valid(token: str) -> bool:
    """Ask Supabase whether a token belongs to a signed-in user.

    With Supabase not configured or not answering, every token is refused.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")
    if not url or not key or not token:
        return False
    request = urllib.request.Request(
        f"{url.rstrip('/')}/auth/v1/user",
        headers={"apikey": key, "Authorization": f"Bearer {token}"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
            return response.status == 200
    except (urllib.error.URLError, TimeoutError):
        return False
