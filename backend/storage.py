"""
Simple JSON file storage for BrainLifts
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"
BRAINLIFTS_FILE = DATA_DIR / "brainlifts.json"


def _ensure_data_dir():
    """Ensure data directory exists"""
    DATA_DIR.mkdir(exist_ok=True)
    if not BRAINLIFTS_FILE.exists():
        BRAINLIFTS_FILE.write_text(json.dumps({"brainlifts": {}}, indent=2))


def _load_data() -> dict[str, Any]:
    """Load data from JSON file"""
    _ensure_data_dir()
    return json.loads(BRAINLIFTS_FILE.read_text())


def _save_data(data: dict[str, Any]):
    """Save data to JSON file"""
    _ensure_data_dir()
    BRAINLIFTS_FILE.write_text(json.dumps(data, indent=2, default=str))


def save_brainlift(
    brainlift_id: str,
    name: str,
    url: str,
    sections: dict[str, Any],
    raw_markdown: str = ""
) -> dict[str, Any]:
    """Save a new brainlift or update existing one"""
    data = _load_data()

    now = datetime.utcnow().isoformat()

    if brainlift_id in data["brainlifts"]:
        # Update existing
        data["brainlifts"][brainlift_id].update({
            "name": name,
            "url": url,
            "sections": sections,
            "raw_markdown": raw_markdown,
            "updated_at": now,
        })
    else:
        # Create new
        data["brainlifts"][brainlift_id] = {
            "id": brainlift_id,
            "name": name,
            "url": url,
            "created_at": now,
            "updated_at": now,
            "sections": sections,
            "raw_markdown": raw_markdown,
            "connections": None,
        }

    _save_data(data)
    return data["brainlifts"][brainlift_id]


def get_brainlift(brainlift_id: str) -> dict[str, Any] | None:
    """Get a brainlift by ID"""
    data = _load_data()
    return data["brainlifts"].get(brainlift_id)


def list_brainlifts() -> list[dict[str, str]]:
    """List all brainlifts (summary only)"""
    data = _load_data()
    return [
        {
            "id": bl["id"],
            "name": bl["name"],
            "created_at": bl["created_at"],
        }
        for bl in sorted(
            data["brainlifts"].values(),
            key=lambda x: x["created_at"],
            reverse=True
        )
    ]


def save_connections(brainlift_id: str, connections: dict[str, Any]) -> bool:
    """Save connection analysis results for a brainlift"""
    data = _load_data()

    if brainlift_id not in data["brainlifts"]:
        return False

    data["brainlifts"][brainlift_id]["connections"] = connections
    data["brainlifts"][brainlift_id]["updated_at"] = datetime.utcnow().isoformat()

    _save_data(data)
    return True


def get_connections(brainlift_id: str) -> dict[str, Any] | None:
    """Get connections for a brainlift"""
    brainlift = get_brainlift(brainlift_id)
    if brainlift:
        return brainlift.get("connections")
    return None


def delete_brainlift(brainlift_id: str) -> bool:
    """Delete a brainlift"""
    data = _load_data()

    if brainlift_id not in data["brainlifts"]:
        return False

    del data["brainlifts"][brainlift_id]
    _save_data(data)
    return True
