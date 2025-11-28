"""
CoreMatch Services Package

Business logic services for the AI ERP:
- PrivacyAirlock: PII detection and anonymization
- AzureLoader: Document processing with Azure Form Recognizer
- DualPathIngestion: Intelligent invoice ingestion pipeline
"""

from .privacy import (
    PrivacyAirlock,
    safe_prompt,
    sanitize_for_llm,
    create_safe_messages,
    get_airlock
)

__all__ = [
    "PrivacyAirlock",
    "safe_prompt",
    "sanitize_for_llm",
    "create_safe_messages",
    "get_airlock"
]
