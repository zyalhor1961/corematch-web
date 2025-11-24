import re

class PrivacyAirlock:
    def __init__(self):
        # Define patterns for PII (Personally Identifiable Information)
        # Order matters: More specific patterns first to avoid conflicts
        self.patterns = {
            "EMAIL": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            "IBAN": r'\b[A-Z]{2}\d{2}[A-Z0-9\s]{15,32}\b',  # IBAN with optional spaces
            "CREDIT_CARD": r'\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b',  # 16 digits with optional separators
            "PHONE": r'(?:\+\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s-]?\d{2,4}[\s-]?\d{2,4}[\s-]?\d{2,4}',  # International phone formats
        }

    def sanitize(self, text: str) -> str:
        """
        Takes raw text and replaces PII with tokens like [EMAIL_REDACTED].
        """
        sanitized_text = text
        
        for label, pattern in self.patterns.items():
            # Replace found patterns with [LABEL_REDACTED]
            sanitized_text = re.sub(
                pattern, 
                f"[{label}_REDACTED]", 
                sanitized_text
            )
            
        return sanitized_text

    def inspect_traffic(self, raw_data: str):
        """
        Returns a safety report without leaking the data itself.
        """
        redacted = self.sanitize(raw_data)
        was_modified = redacted != raw_data
        return {
            "safe": not was_modified,
            "sanitized_content": redacted,
            "flags": [key for key in self.patterns if f"[{key}_REDACTED]" in redacted]
        }

# Singleton instance
airlock = PrivacyAirlock()
