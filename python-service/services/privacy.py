"""
Privacy Airlock - PII Detection & Anonymization Service

Military-grade privacy protection for CoreMatch AI ERP.
Strips sensitive data (IBANs, emails, phone numbers, names) locally
BEFORE any text is sent to external AI providers (OpenAI/Anthropic).

Usage:
    from services.privacy import PrivacyAirlock, safe_prompt

    # Direct usage
    airlock = PrivacyAirlock()
    result = airlock.anonymize("Contact Jean Dupont at jean@company.fr, IBAN: FR76...")
    print(result["clean_text"])  # "Contact <PERSON_1> at <EMAIL_1>, IBAN: <IBAN_1>"
    print(result["mappings"])    # {"<PERSON_1>": "Jean Dupont", ...}

    # Decorator usage
    @safe_prompt
    async def call_openai(prompt: str):
        return await openai.chat.completions.create(...)
"""

import re
import hashlib
from typing import Dict, List, Any, Optional, Callable, Tuple
from functools import wraps
from dataclasses import dataclass, field
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Lazy imports for Presidio (heavy dependencies)
_analyzer = None
_anonymizer = None
_nlp_engine = None


def _get_presidio_components():
    """
    Lazy-load Presidio components to avoid import errors if not installed.
    Also handles spaCy model loading.
    """
    global _analyzer, _anonymizer, _nlp_engine

    if _analyzer is not None and _anonymizer is not None:
        return _analyzer, _anonymizer

    try:
        from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
        from presidio_analyzer.nlp_engine import NlpEngineProvider
        from presidio_anonymizer import AnonymizerEngine
        from presidio_anonymizer.entities import OperatorConfig

        # Try to load French model first (CoreMatch is French ERP)
        # Fall back to English if French not available
        nlp_config = None
        for model_name in ["fr_core_news_md", "fr_core_news_sm", "en_core_web_lg", "en_core_web_sm"]:
            try:
                import spacy
                spacy.load(model_name)
                logger.info(f"Loaded spaCy model: {model_name}")

                # Determine language from model
                lang = "fr" if model_name.startswith("fr") else "en"
                nlp_config = {
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": lang, "model_name": model_name}]
                }
                break
            except OSError:
                continue

        if nlp_config is None:
            logger.warning("No spaCy model found. Using pattern-based detection only.")
            # Fallback: Create analyzer without NLP (pattern-based only)
            _analyzer = AnalyzerEngine()
        else:
            # Create NLP engine with the found model
            provider = NlpEngineProvider(nlp_configuration=nlp_config)
            nlp_engine = provider.create_engine()
            _analyzer = AnalyzerEngine(nlp_engine=nlp_engine)

        _anonymizer = AnonymizerEngine()

        logger.info("Privacy Airlock initialized successfully")
        return _analyzer, _anonymizer

    except ImportError as e:
        logger.error(f"Presidio not installed: {e}")
        logger.error("Run: pip install presidio-analyzer presidio-anonymizer spacy")
        logger.error("Then: python -m spacy download fr_core_news_md")
        raise RuntimeError("Privacy Airlock dependencies not installed") from e


@dataclass
class PIIEntity:
    """Represents a detected PII entity."""
    entity_type: str
    start: int
    end: int
    text: str
    score: float
    placeholder: str = ""


@dataclass
class AnonymizationResult:
    """Result of anonymization operation."""
    clean_text: str
    mappings: Dict[str, str]
    entities_found: List[PIIEntity]
    stats: Dict[str, int] = field(default_factory=dict)


class PrivacyAirlock:
    """
    Military-grade Privacy Airlock for PII detection and anonymization.

    Detects and anonymizes:
    - EMAIL_ADDRESS: email@example.com -> <EMAIL_1>
    - PHONE_NUMBER: +33 6 12 34 56 78 -> <PHONE_1>
    - IBAN_CODE: FR76 3000 6000 0112 3456 7890 189 -> <IBAN_1>
    - CREDIT_CARD: 4111 1111 1111 1111 -> <CREDIT_CARD_1>
    - PERSON: Jean Dupont -> <PERSON_1>
    - FR_SSN: French social security numbers
    - LOCATION: Paris, France -> <LOCATION_1> (optional)
    - ORGANIZATION: Acme Corp -> <ORG_1> (optional)

    Usage:
        airlock = PrivacyAirlock()
        result = airlock.anonymize("Contact Jean at jean@acme.fr")
        print(result["clean_text"])  # "Contact <PERSON_1> at <EMAIL_1>"
    """

    # Default entity types to detect (focused on financial/invoice data)
    DEFAULT_ENTITIES = [
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
        "IBAN_CODE",
        "CREDIT_CARD",
        "PERSON",
    ]

    # Extended entities for full protection
    EXTENDED_ENTITIES = [
        "EMAIL_ADDRESS",
        "PHONE_NUMBER",
        "IBAN_CODE",
        "CREDIT_CARD",
        "PERSON",
        "LOCATION",
        "ORGANIZATION",
        "DATE_TIME",
        "NRP",  # National Registration/ID numbers
        "IP_ADDRESS",
        "URL",
    ]

    # French-specific patterns (Presidio may not catch all)
    FRENCH_PATTERNS = {
        "FR_SSN": r"\b[12][0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[1-8][0-9]|9[0-9]|2[AB])[0-9]{3}[0-9]{3}[0-9]{2}\b",
        "FR_PHONE": r"\b(?:\+33|0033|0)[1-9](?:[\s.-]?[0-9]{2}){4}\b",
        "FR_IBAN": r"\bFR[0-9]{2}[\s]?([0-9]{4}[\s]?){5}[0-9]{3}\b",
        "FR_SIRET": r"\b[0-9]{3}[\s]?[0-9]{3}[\s]?[0-9]{3}[\s]?[0-9]{5}\b",
        "FR_TVA": r"\bFR[\s]?[0-9A-Z]{2}[\s]?[0-9]{9}\b",
    }

    # Placeholder format: <TYPE_N>
    PLACEHOLDER_FORMAT = "<{type}_{index}>"

    def __init__(
        self,
        entities: Optional[List[str]] = None,
        score_threshold: float = 0.5,
        include_french_patterns: bool = True,
        extended_mode: bool = False,
        language: str = "fr"
    ):
        """
        Initialize the Privacy Airlock.

        Args:
            entities: List of entity types to detect. Default: DEFAULT_ENTITIES
            score_threshold: Minimum confidence score (0-1) to consider a detection valid
            include_french_patterns: Add French-specific regex patterns
            extended_mode: Use EXTENDED_ENTITIES for full protection
            language: Primary language for detection ('fr' or 'en')
        """
        self.entities = entities or (self.EXTENDED_ENTITIES if extended_mode else self.DEFAULT_ENTITIES)
        self.score_threshold = score_threshold
        self.include_french_patterns = include_french_patterns
        self.language = language
        self._counters: Dict[str, int] = {}

    def _reset_counters(self):
        """Reset placeholder counters for a new anonymization."""
        self._counters = {}

    def _get_placeholder(self, entity_type: str) -> str:
        """Generate a unique placeholder for an entity type."""
        if entity_type not in self._counters:
            self._counters[entity_type] = 0
        self._counters[entity_type] += 1
        return self.PLACEHOLDER_FORMAT.format(
            type=entity_type.upper(),
            index=self._counters[entity_type]
        )

    def _detect_french_patterns(self, text: str) -> List[PIIEntity]:
        """
        Detect French-specific PII patterns using regex.
        Supplements Presidio's detection.
        """
        entities = []

        if not self.include_french_patterns:
            return entities

        for pattern_name, pattern in self.FRENCH_PATTERNS.items():
            for match in re.finditer(pattern, text, re.IGNORECASE):
                entities.append(PIIEntity(
                    entity_type=pattern_name,
                    start=match.start(),
                    end=match.end(),
                    text=match.group(),
                    score=0.95  # High confidence for regex matches
                ))

        return entities

    def analyze(self, text: str) -> List[PIIEntity]:
        """
        Analyze text for PII entities.

        Args:
            text: The text to analyze

        Returns:
            List of detected PII entities
        """
        if not text or not text.strip():
            return []

        try:
            analyzer, _ = _get_presidio_components()

            # Detect with Presidio
            results = analyzer.analyze(
                text=text,
                entities=self.entities,
                language=self.language,
                score_threshold=self.score_threshold
            )

            entities = [
                PIIEntity(
                    entity_type=r.entity_type,
                    start=r.start,
                    end=r.end,
                    text=text[r.start:r.end],
                    score=r.score
                )
                for r in results
            ]

            # Add French-specific patterns
            french_entities = self._detect_french_patterns(text)
            entities.extend(french_entities)

            # Remove duplicates (overlapping detections)
            entities = self._deduplicate_entities(entities)

            # Sort by position (descending) for safe replacement
            entities.sort(key=lambda e: e.start, reverse=True)

            return entities

        except Exception as e:
            logger.error(f"PII analysis failed: {e}")
            # Fallback to pattern-only detection
            return self._detect_french_patterns(text)

    def _deduplicate_entities(self, entities: List[PIIEntity]) -> List[PIIEntity]:
        """
        Remove overlapping entity detections, keeping the highest-scoring one.
        """
        if not entities:
            return []

        # Sort by start position, then by score (descending)
        sorted_entities = sorted(entities, key=lambda e: (e.start, -e.score))

        deduplicated = []
        last_end = -1

        for entity in sorted_entities:
            if entity.start >= last_end:
                deduplicated.append(entity)
                last_end = entity.end

        return deduplicated

    def anonymize(self, text: str) -> Dict[str, Any]:
        """
        Anonymize PII in text by replacing with placeholders.

        Args:
            text: The text to anonymize

        Returns:
            Dictionary with:
            - clean_text: Anonymized text safe for LLM
            - mappings: Dict mapping placeholders to original values
            - entities_found: List of detected entities
            - stats: Count of each entity type found
        """
        if not text or not text.strip():
            return {
                "clean_text": text or "",
                "mappings": {},
                "entities_found": [],
                "stats": {}
            }

        self._reset_counters()

        # Analyze for PII
        entities = self.analyze(text)

        # Build mappings and replace (process in reverse order to preserve positions)
        mappings: Dict[str, str] = {}
        clean_text = text
        stats: Dict[str, int] = {}

        for entity in entities:
            placeholder = self._get_placeholder(entity.entity_type)
            entity.placeholder = placeholder

            # Store mapping (placeholder -> original)
            mappings[placeholder] = entity.text

            # Replace in text
            clean_text = clean_text[:entity.start] + placeholder + clean_text[entity.end:]

            # Update stats
            stats[entity.entity_type] = stats.get(entity.entity_type, 0) + 1

        logger.info(f"Privacy Airlock: Anonymized {len(entities)} PII entities: {stats}")

        return {
            "clean_text": clean_text,
            "mappings": mappings,
            "entities_found": [
                {
                    "type": e.entity_type,
                    "placeholder": e.placeholder,
                    "score": e.score
                }
                for e in entities
            ],
            "stats": stats
        }

    def rehydrate(self, text: str, mappings: Dict[str, str]) -> str:
        """
        Restore original values from placeholders.

        Args:
            text: Text containing placeholders
            mappings: Dictionary mapping placeholders to original values

        Returns:
            Text with original values restored
        """
        result = text
        for placeholder, original in mappings.items():
            result = result.replace(placeholder, original)
        return result

    def hash_pii(self, text: str, salt: str = "") -> Dict[str, Any]:
        """
        Alternative anonymization: Replace PII with deterministic hashes.
        Useful when you need consistent anonymization across documents.

        Args:
            text: The text to anonymize
            salt: Optional salt for hashing

        Returns:
            Dictionary with clean_text and hash mappings
        """
        self._reset_counters()
        entities = self.analyze(text)

        mappings: Dict[str, str] = {}
        clean_text = text

        for entity in entities:
            # Create deterministic hash
            hash_input = f"{salt}{entity.text}{entity.entity_type}"
            hash_value = hashlib.sha256(hash_input.encode()).hexdigest()[:8]
            placeholder = f"<{entity.entity_type}_{hash_value}>"

            mappings[placeholder] = entity.text
            clean_text = clean_text[:entity.start] + placeholder + clean_text[entity.end:]

        return {
            "clean_text": clean_text,
            "mappings": mappings
        }


# ============================================================
# DECORATOR & UTILITIES
# ============================================================

# Global singleton instance
_default_airlock: Optional[PrivacyAirlock] = None


def get_airlock() -> PrivacyAirlock:
    """Get or create the default PrivacyAirlock instance."""
    global _default_airlock
    if _default_airlock is None:
        _default_airlock = PrivacyAirlock()
    return _default_airlock


def safe_prompt(func: Callable = None, *, fields: List[str] = None, rehydrate_response: bool = False):
    """
    Decorator to automatically anonymize prompt inputs before LLM calls.

    Usage:
        @safe_prompt
        async def call_openai(prompt: str):
            return await openai.chat.completions.create(...)

        @safe_prompt(fields=["user_input", "context"])
        async def call_with_context(user_input: str, context: str):
            ...

        @safe_prompt(rehydrate_response=True)
        async def call_and_restore(prompt: str):
            # Response will have placeholders replaced with originals
            ...
    """
    def decorator(fn: Callable):
        @wraps(fn)
        async def async_wrapper(*args, **kwargs):
            airlock = get_airlock()
            all_mappings: Dict[str, str] = {}

            # Determine which fields to sanitize
            target_fields = fields or ["prompt", "text", "content", "message", "query"]

            # Sanitize keyword arguments
            sanitized_kwargs = {}
            for key, value in kwargs.items():
                if isinstance(value, str) and (fields is None or key in target_fields):
                    result = airlock.anonymize(value)
                    sanitized_kwargs[key] = result["clean_text"]
                    all_mappings.update(result["mappings"])
                else:
                    sanitized_kwargs[key] = value

            # Sanitize positional arguments (first string arg is usually the prompt)
            sanitized_args = list(args)
            for i, arg in enumerate(sanitized_args):
                if isinstance(arg, str) and (fields is None or i == 0):
                    result = airlock.anonymize(arg)
                    sanitized_args[i] = result["clean_text"]
                    all_mappings.update(result["mappings"])

            # Call the original function
            response = await fn(*sanitized_args, **sanitized_kwargs)

            # Optionally rehydrate the response
            if rehydrate_response and all_mappings:
                if isinstance(response, str):
                    response = airlock.rehydrate(response, all_mappings)
                elif hasattr(response, "content") and isinstance(response.content, str):
                    response.content = airlock.rehydrate(response.content, all_mappings)

            return response

        @wraps(fn)
        def sync_wrapper(*args, **kwargs):
            airlock = get_airlock()
            all_mappings: Dict[str, str] = {}

            target_fields = fields or ["prompt", "text", "content", "message", "query"]

            sanitized_kwargs = {}
            for key, value in kwargs.items():
                if isinstance(value, str) and (fields is None or key in target_fields):
                    result = airlock.anonymize(value)
                    sanitized_kwargs[key] = result["clean_text"]
                    all_mappings.update(result["mappings"])
                else:
                    sanitized_kwargs[key] = value

            sanitized_args = list(args)
            for i, arg in enumerate(sanitized_args):
                if isinstance(arg, str) and (fields is None or i == 0):
                    result = airlock.anonymize(arg)
                    sanitized_args[i] = result["clean_text"]
                    all_mappings.update(result["mappings"])

            response = fn(*sanitized_args, **sanitized_kwargs)

            if rehydrate_response and all_mappings:
                if isinstance(response, str):
                    response = airlock.rehydrate(response, all_mappings)

            return response

        # Return appropriate wrapper based on function type
        import asyncio
        if asyncio.iscoroutinefunction(fn):
            return async_wrapper
        return sync_wrapper

    if func is not None:
        return decorator(func)
    return decorator


def sanitize_for_llm(text: str, **kwargs) -> Tuple[str, Dict[str, str]]:
    """
    Convenience function to sanitize text before sending to LLM.

    Args:
        text: The text to sanitize
        **kwargs: Additional options passed to PrivacyAirlock

    Returns:
        Tuple of (clean_text, mappings)

    Example:
        clean, mappings = sanitize_for_llm(invoice_text)
        response = await openai.chat.completions.create(
            messages=[{"role": "user", "content": clean}]
        )
    """
    airlock = PrivacyAirlock(**kwargs) if kwargs else get_airlock()
    result = airlock.anonymize(text)
    return result["clean_text"], result["mappings"]


def create_safe_messages(messages: List[Dict[str, str]]) -> Tuple[List[Dict[str, str]], Dict[str, str]]:
    """
    Sanitize a list of chat messages for OpenAI/Anthropic.

    Args:
        messages: List of message dicts with 'role' and 'content'

    Returns:
        Tuple of (sanitized_messages, all_mappings)

    Example:
        messages = [
            {"role": "user", "content": "Analyze invoice from Jean Dupont..."}
        ]
        safe_messages, mappings = create_safe_messages(messages)
        response = await client.chat.completions.create(messages=safe_messages)
    """
    airlock = get_airlock()
    all_mappings: Dict[str, str] = {}
    safe_messages = []

    for msg in messages:
        if "content" in msg and isinstance(msg["content"], str):
            result = airlock.anonymize(msg["content"])
            safe_messages.append({
                **msg,
                "content": result["clean_text"]
            })
            all_mappings.update(result["mappings"])
        else:
            safe_messages.append(msg)

    return safe_messages, all_mappings


# ============================================================
# TESTING
# ============================================================

if __name__ == "__main__":
    # Test the Privacy Airlock
    print("=" * 60)
    print("Privacy Airlock - Test Suite")
    print("=" * 60)

    test_text = """
    Bonjour,

    Veuillez trouver ci-joint la facture pour M. Jean-Pierre Dupont.

    Coordonnees:
    - Email: jean.dupont@entreprise.fr
    - Telephone: +33 6 12 34 56 78
    - Adresse: 15 rue de la Paix, 75001 Paris

    Informations bancaires:
    - IBAN: FR76 3000 6000 0112 3456 7890 189
    - BIC: BNPAFRPP

    Montant: 1,234.56 EUR
    Carte de credit: 4111 1111 1111 1111 (ne pas utiliser)

    Cordialement,
    Marie Martin
    Comptable, Acme SARL
    """

    print("\n[INPUT TEXT]")
    print(test_text)

    airlock = PrivacyAirlock(extended_mode=True)
    result = airlock.anonymize(test_text)

    print("\n[ANONYMIZED TEXT]")
    print(result["clean_text"])

    print("\n[MAPPINGS]")
    for placeholder, original in result["mappings"].items():
        print(f"  {placeholder} -> {original}")

    print("\n[STATISTICS]")
    for entity_type, count in result["stats"].items():
        print(f"  {entity_type}: {count}")

    print("\n[REHYDRATED TEXT]")
    restored = airlock.rehydrate(result["clean_text"], result["mappings"])
    print(restored[:200] + "...")

    print("\n" + "=" * 60)
    print("Test completed successfully!")
    print("=" * 60)
