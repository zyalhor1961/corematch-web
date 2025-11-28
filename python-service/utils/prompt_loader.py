import os
import yaml
from jinja2 import Template
from functools import lru_cache
from typing import Dict, Any, Optional

# Directory containing YAML prompt files (relative to the project root)
PROMPT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prompts")

def load_prompt(
    name: str,
    variables: Dict[str, Any] | None = None,
    section: Optional[str] = None
) -> Dict[str, str]:
    """Load a prompt YAML, render Jinja2 placeholders, and return a dict with
    ``system`` and ``user`` keys ready for LangChain's ``ChatPromptTemplate``.

    Args:
        name: Name of the YAML file (without extension)
        variables: Dictionary of variables to render in Jinja2 templates
        section: Optional section name for nested prompts (e.g., "clients", "suppliers")
                 If provided, looks for prompts under that section key.
                 Falls back to root-level keys if section not found.
    """
    variables = variables or {}
    path = os.path.join(PROMPT_DIR, f"{name}.yaml")
    with open(path, "r", encoding="utf-8") as f:
        raw = yaml.safe_load(f)

    # If section specified, try to use that section's prompts
    prompt_source = raw
    if section and section in raw and isinstance(raw[section], dict):
        prompt_source = raw[section]

    rendered: Dict[str, str] = {}
    for key in ("system", "user"):
        if key in prompt_source:
            tmpl = Template(str(prompt_source[key]))
            rendered[key] = tmpl.render(**variables)
    return rendered
