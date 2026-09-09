"""
Profile Loader — The Sixth Sense
Read config/profiles.yaml and resolve inheritance.
"""
from __future__ import annotations
import copy
import logging
from pathlib import Path
from typing import Dict, Any

logger = logging.getLogger(__name__)

_DEFAULT_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "profiles.yaml"


def load_profile(profile_name: str, config_path: Path = _DEFAULT_CONFIG_PATH) -> Dict[str, Any]:
    """
    Load a named profile from profiles.yaml.
    Handles single-level 'extends' inheritance.

    Args:
        profile_name: e.g. 'urban_mvp' or 'urban_full'
        config_path: Path to profiles.yaml

    Returns:
        Merged profile dict (copy — safe to mutate)
    """
    try:
        import yaml
    except ImportError:
        raise ImportError("PyYAML required: pip install pyyaml")

    with open(config_path, "r") as f:
        all_profiles: Dict[str, Any] = yaml.safe_load(f)

    if profile_name not in all_profiles:
        raise KeyError(
            f"Profile '{profile_name}' not found in {config_path}. "
            f"Available: {list(all_profiles.keys())}"
        )

    profile = copy.deepcopy(all_profiles[profile_name])

    # Resolve single-level inheritance
    parent_name = profile.pop("extends", None)
    if parent_name:
        if parent_name not in all_profiles:
            raise KeyError(f"Parent profile '{parent_name}' not found.")
        parent = copy.deepcopy(all_profiles[parent_name])
        parent.pop("extends", None)
        # Child overrides parent
        merged = _deep_merge(parent, profile)
        profile = merged

    logger.info("Profile '%s' loaded from %s", profile_name, config_path)
    return profile


def _deep_merge(base: Dict, override: Dict) -> Dict:
    """Deep merge: override values win over base, nested dicts are merged."""
    result = copy.deepcopy(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result
