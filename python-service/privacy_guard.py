import re

class PrivacyAirlock:
    """
    A security layer to redact PII (Personally Identifiable Information) 
    from text before it is sent to an LLM.
    """

    def __init__(self):
        # Regex patterns for PII
        self.patterns = {
            "EMAIL": r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
            # Basic Credit Card / IBAN-like pattern (12-19 digits, potentially spaced)
            "FINANCIAL_ID": r'\b(?:\d[ -]*?){13,19}\b', 
            # Basic Phone Number (International or Local, with common separators)
            # Removed initial \b to allow + prefix which is not a word character
            "PHONE": r'(?:\+?\d{1,3}[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}(?: *x\d+)?'
        }

    def redact_pii(self, text: str) -> str:
        """
        Scans the text for PII patterns and replaces them with redaction markers.
        """
        if not text:
            return ""

        redacted_text = text

        # Redact Emails
        redacted_text = re.sub(self.patterns["EMAIL"], "[EMAIL_REDACTED]", redacted_text)

        # Redact Financial IDs (Credit Cards, IBANs)
        # Note: This is a heuristic. It might catch some long numbers that aren't CCs.
        redacted_text = re.sub(self.patterns["FINANCIAL_ID"], "[FINANCIAL_ID_REDACTED]", redacted_text)

        # Redact Phone Numbers
        # Note: Phone regex is tricky. This is a best-effort pattern.
        redacted_text = re.sub(self.patterns["PHONE"], "[PHONE_REDACTED]", redacted_text)

        return redacted_text

    def restore_pii(self, text: str, map: dict) -> str:
        """
        Placeholder for future logic to re-insert data if needed.
        Currently just returns the text as is.
        """
        return text

# Export a default instance
airlock = PrivacyAirlock()
