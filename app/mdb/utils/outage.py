"""
Outage Notice Configuration for Montana Mesonet Dashboard

This module loads the site-wide outage notice that the dashboard shows as a
modal on page load. The notice is driven by ``outage.json`` at the root of the
mesonet-dashboard repository, which is fetched at runtime from raw
GitHub - the same approach used for ``one-pagers.json``.

Turning the notice on or off is therefore a content change, not a deploy:
edit ``outage.json`` on the ``main`` branch (the GitHub web UI is enough), and
the change goes live on the next page load once the cache below expires.

Config schema (all keys optional except ``active``):
    active (bool): Whether to show the notice at all. This is the on/off switch.
    id (str): Identifier for this particular notice. Changing it re-shows the
        modal to visitors who already dismissed the previous one, so bump it
        when you post a new outage rather than reusing the old text.
    title (str): Heading shown at the top of the alert.
    color (str): Bootstrap alert color, e.g. "warning", "danger", "info".
    message (str): Body text, rendered as Markdown.
    button_text (str): Label on the dismiss button.
"""

import time
from typing import Any, Dict, Optional, Tuple

import requests

OUTAGE_CONFIG_URL = "https://raw.githubusercontent.com/mt-climate-office/mesonet-dashboard/refs/heads/main/outage.json"

# How long a fetched config is reused before we re-check GitHub. The layout is
# rebuilt on every page load, so without this every visitor would pay for a
# round trip to GitHub. Sixty seconds keeps that cost negligible while still
# putting an edit to outage.json in front of users within about a minute.
CACHE_SECONDS = 60

# Used when the config cannot be fetched or is malformed. Defaulting to
# inactive means a GitHub outage (or a typo in the JSON) leaves the dashboard
# alone rather than showing visitors a broken or empty notice.
DEFAULT_CONFIG: Dict[str, Any] = {
    "active": False,
    "id": "",
    "title": "Montana Mesonet Notice",
    "color": "warning",
    "message": "",
    "button_text": "Got it",
}

# (fetched_at, config) for the most recent successful or failed lookup.
_cache: Optional[Tuple[float, Dict[str, Any]]] = None


def _coerce(raw: Any) -> Dict[str, Any]:
    """
    Merge a fetched config over the defaults, dropping anything unusable.

    Args:
        raw (Any): Decoded JSON from ``outage.json``. Only a mapping is
            meaningful; anything else falls back to the defaults.

    Returns:
        Dict[str, Any]: Config with every key in ``DEFAULT_CONFIG`` present.

    Note:
        A notice with no message is treated as inactive. That way clearing the
        message text is enough to take the modal down, even if ``active`` was
        left set to true.
    """
    if not isinstance(raw, dict):
        return dict(DEFAULT_CONFIG)

    config = dict(DEFAULT_CONFIG)
    for key in DEFAULT_CONFIG:
        if key in raw and raw[key] is not None:
            config[key] = raw[key]

    config["active"] = bool(config["active"]) and bool(str(config["message"]).strip())
    config["id"] = str(config["id"])
    config["title"] = str(config["title"])
    config["color"] = str(config["color"])
    config["message"] = str(config["message"])
    config["button_text"] = str(config["button_text"])
    return config


def get_outage_config(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetch the outage notice config, reusing a recent result when possible.

    Args:
        force_refresh (bool): Skip the cache and re-fetch immediately.
            Defaults to False.

    Returns:
        Dict[str, Any]: Config with every key in ``DEFAULT_CONFIG`` present.
            Returns the defaults (notice off) if the fetch or parse fails.

    Note:
        Failures are cached alongside successes, so a GitHub outage costs one
        slow request per cache window rather than one per page load.
    """
    global _cache

    now = time.monotonic()
    if not force_refresh and _cache is not None and now - _cache[0] < CACHE_SECONDS:
        return dict(_cache[1])

    try:
        response = requests.get(OUTAGE_CONFIG_URL, timeout=5)
        response.raise_for_status()
        config = _coerce(response.json())
    except Exception:  # noqa: BLE001 - any failure means "no notice"
        config = dict(DEFAULT_CONFIG)

    _cache = (now, config)
    return dict(config)
