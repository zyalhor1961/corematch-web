import re

class PrivacyAirlock:
    def __init__(self):
        # Define patterns for PII (Personally Identifiable Information)
        self.patterns = {
            "EMAIL": r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            "PHONE": r'(?:\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}',
            "IBAN": r'[A-Z]{2}\d{2}[A-Z0-9]{1,30}',
            "CREDIT_CARD": r'\b(?:\d[ -]*?){13,16}\b',
            "AMOUNT_HIGH": r'(?<!\d)\d{1,3}(?:,\d{3})*(?:\.\d+)?(?=[\s€$£])' # Detect amounts to potentially mask salaries
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
