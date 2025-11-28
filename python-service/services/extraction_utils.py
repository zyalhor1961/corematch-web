"""
Local Extraction Utilities - Privacy-Compliant Field Extraction

This module provides CPU-only extraction of PII fields (emails, phones, SIRET)
using regex patterns. NO DATA IS SENT TO EXTERNAL APIs.

🛡️ PRIVACY AIRLOCK APPROVED:
- Emails, phones, SIRET: Extracted locally via regex
- Contextual fields (payment terms): Sent to LLM only AFTER anonymization

Usage:
    from services.extraction_utils import LocalExtractor, AzureResultMerger

    # Extract PII locally (no API calls)
    extractor = LocalExtractor()
    emails = extractor.extract_emails(document_text)
    siret = extractor.extract_siret_siren(document_text)

    # Merge with Azure results
    merger = AzureResultMerger()
    enhanced = merger.merge(azure_result, local_extractions)
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from difflib import SequenceMatcher
import logging

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class ExtractedField:
    """Represents an extracted field with metadata."""
    value: str
    confidence: float  # 0.0 to 1.0
    source: str  # 'regex', 'azure', 'llm'
    pattern_name: Optional[str] = None
    position: Optional[Tuple[int, int]] = None  # (start, end) in text


@dataclass
class LocalExtractionResult:
    """Results from local extraction."""
    emails: List[ExtractedField] = field(default_factory=list)
    phones: List[ExtractedField] = field(default_factory=list)
    siret_siren: List[ExtractedField] = field(default_factory=list)
    dates: List[ExtractedField] = field(default_factory=list)
    addresses: List[ExtractedField] = field(default_factory=list)
    ibans: List[ExtractedField] = field(default_factory=list)
    vat_numbers: List[ExtractedField] = field(default_factory=list)

    # Best candidates (after ranking)
    best_email: Optional[str] = None
    best_phone: Optional[str] = None
    best_siret: Optional[str] = None
    billing_address: Optional[str] = None
    shipping_address: Optional[str] = None


# =============================================================================
# LOCAL EXTRACTOR (The Privacy Shield)
# =============================================================================

class LocalExtractor:
    """
    CPU-only extraction of PII fields using regex patterns.
    No external API calls - all processing happens locally.

    🛡️ Privacy Compliant: This class never sends data outside your server.
    """

    # =========================================================================
    # REGEX PATTERNS (French/European focused)
    # =========================================================================

    # Email patterns (RFC 5322 simplified + common variants)
    EMAIL_PATTERNS = [
        # Standard email
        r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
        # Email with "mailto:" prefix
        r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
        # Email in angle brackets
        r'<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>',
    ]

    # French phone patterns
    PHONE_PATTERNS = [
        # French mobile: 06/07 XX XX XX XX
        r'\b0[67][\s.-]?(?:\d{2}[\s.-]?){4}\b',
        # French landline: 01-05, 08, 09
        r'\b0[1-589][\s.-]?(?:\d{2}[\s.-]?){4}\b',
        # International format: +33 6 XX XX XX XX
        r'\+33[\s.-]?[1-9][\s.-]?(?:\d{2}[\s.-]?){4}\b',
        # With country code in parens: (0033) or (+33)
        r'\(?\+?0?0?33\)?[\s.-]?[1-9][\s.-]?(?:\d{2}[\s.-]?){4}\b',
        # Generic international
        r'\+\d{1,3}[\s.-]?\d{1,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}\b',
    ]

    # SIRET (14 digits) and SIREN (9 digits) patterns
    SIRET_SIREN_PATTERNS = [
        # SIRET with spaces/dots: 123 456 789 00012
        r'\b(\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{5})\b',
        # SIRET without separators: 12345678900012
        r'\b(\d{14})\b',
        # SIREN with spaces: 123 456 789
        r'\b(\d{3}[\s.-]?\d{3}[\s.-]?\d{3})\b',
        # SIREN without separators: 123456789
        r'(?<!\d)(\d{9})(?!\d)',
    ]

    # French TVA Intracommunautaire patterns
    VAT_PATTERNS = [
        # FR XX 123456789
        r'\bFR[\s]?[0-9A-Z]{2}[\s]?\d{9}\b',
        # FRXX123456789 (no spaces)
        r'\bFR[0-9A-Z]{2}\d{9}\b',
        # Generic EU VAT
        r'\b[A-Z]{2}[\s]?[0-9A-Z]{8,12}\b',
    ]

    # IBAN patterns (French and EU)
    IBAN_PATTERNS = [
        # French IBAN: FR76 XXXX XXXX XXXX XXXX XXXX XXX
        r'\bFR\d{2}[\s]?(?:\d{4}[\s]?){5}\d{3}\b',
        # Generic IBAN (2 letters + 2 digits + up to 30 alphanumeric)
        r'\b[A-Z]{2}\d{2}[\s]?(?:[A-Z0-9]{4}[\s]?){3,7}[A-Z0-9]{1,4}\b',
    ]

    # Date patterns (French formats)
    DATE_PATTERNS = [
        # DD/MM/YYYY or DD-MM-YYYY
        (r'\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b', 'dmy'),
        # DD Month YYYY (French)
        (r'\b(\d{1,2})[\s]+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)[\s]+(\d{4})\b', 'dmy_text'),
        # YYYY-MM-DD (ISO)
        (r'\b(\d{4})-(\d{2})-(\d{2})\b', 'ymd'),
        # DD.MM.YY
        (r'\b(\d{1,2})\.(\d{1,2})\.(\d{2})\b', 'dmy_short'),
    ]

    # Address block keywords (French/English)
    ADDRESS_KEYWORDS = {
        'billing': [
            r'factur[ée]?\s*[àa]:?',
            r'adresse\s*de\s*facturation:?',
            r'billing\s*address:?',
            r'bill\s*to:?',
            r'adresse\s*client:?',
            r'client:?',
        ],
        'shipping': [
            r'livr[ée]?\s*[àa]:?',
            r'adresse\s*de\s*livraison:?',
            r'shipping\s*address:?',
            r'ship\s*to:?',
            r'deliver\s*to:?',
            r'destinataire:?',
        ],
        'vendor': [
            r'fournisseur:?',
            r'vendor:?',
            r'supplier:?',
            r'émetteur:?',
            r'emetteur:?',
            r'de:?\s*$',
        ],
    }

    def __init__(self):
        """Initialize the local extractor."""
        # Compile regex patterns for performance
        self._compiled_emails = [re.compile(p, re.IGNORECASE) for p in self.EMAIL_PATTERNS]
        self._compiled_phones = [re.compile(p) for p in self.PHONE_PATTERNS]
        self._compiled_siret = [re.compile(p) for p in self.SIRET_SIREN_PATTERNS]
        self._compiled_vat = [re.compile(p, re.IGNORECASE) for p in self.VAT_PATTERNS]
        self._compiled_iban = [re.compile(p, re.IGNORECASE) for p in self.IBAN_PATTERNS]

    # =========================================================================
    # EMAIL EXTRACTION
    # =========================================================================

    def extract_emails(self, text: str, vendor_name: Optional[str] = None) -> List[ExtractedField]:
        """
        Extract email addresses from text.

        Args:
            text: Document text to search
            vendor_name: Optional vendor name for fuzzy matching priority

        Returns:
            List of ExtractedField with emails, sorted by relevance
        """
        if not text:
            return []

        emails = []
        seen = set()

        for pattern in self._compiled_emails:
            for match in pattern.finditer(text):
                # Handle groups (for patterns that capture the email in a group)
                email = match.group(1) if match.lastindex else match.group(0)
                email = email.lower().strip()

                # Skip if already seen
                if email in seen:
                    continue
                seen.add(email)

                # Calculate confidence based on pattern and context
                confidence = 0.85

                # Boost confidence if email domain matches vendor name
                if vendor_name:
                    domain = email.split('@')[1] if '@' in email else ''
                    similarity = self._fuzzy_match(vendor_name.lower(), domain)
                    if similarity > 0.5:
                        confidence = min(0.98, confidence + similarity * 0.15)

                # Check for common invoice-related domains
                if any(kw in email for kw in ['comptabilite', 'facture', 'invoice', 'billing', 'finance']):
                    confidence = min(0.95, confidence + 0.05)

                emails.append(ExtractedField(
                    value=email,
                    confidence=confidence,
                    source='regex',
                    pattern_name='email',
                    position=(match.start(), match.end())
                ))

        # Sort by confidence (highest first)
        emails.sort(key=lambda x: x.confidence, reverse=True)
        return emails

    # =========================================================================
    # SIRET/SIREN EXTRACTION
    # =========================================================================

    def extract_siret_siren(self, text: str) -> List[ExtractedField]:
        """
        Extract SIRET (14 digits) and SIREN (9 digits) numbers.
        Validates using Luhn algorithm for higher confidence.

        Args:
            text: Document text to search

        Returns:
            List of ExtractedField with SIRET/SIREN numbers
        """
        if not text:
            return []

        results = []
        seen = set()

        for pattern in self._compiled_siret:
            for match in pattern.finditer(text):
                # Get the matched number, remove separators
                raw_value = match.group(1) if match.lastindex else match.group(0)
                clean_value = re.sub(r'[\s.-]', '', raw_value)

                # Skip if already seen
                if clean_value in seen:
                    continue
                seen.add(clean_value)

                # Determine type and validate
                is_siret = len(clean_value) == 14
                is_siren = len(clean_value) == 9

                if not (is_siret or is_siren):
                    continue

                # Validate with Luhn algorithm
                is_valid_luhn = self._validate_luhn(clean_value)

                # Check context for SIRET/SIREN keywords
                context = text[max(0, match.start() - 50):min(len(text), match.end() + 20)].lower()
                has_keyword = any(kw in context for kw in ['siret', 'siren', 'n°', 'numéro', 'numero', 'rcs'])

                # Calculate confidence
                confidence = 0.7
                if is_valid_luhn:
                    confidence += 0.2
                if has_keyword:
                    confidence += 0.1

                # Format nicely
                if is_siret:
                    formatted = f"{clean_value[:3]} {clean_value[3:6]} {clean_value[6:9]} {clean_value[9:]}"
                    field_type = 'SIRET'
                else:
                    formatted = f"{clean_value[:3]} {clean_value[3:6]} {clean_value[6:]}"
                    field_type = 'SIREN'

                results.append(ExtractedField(
                    value=formatted,
                    confidence=confidence,
                    source='regex',
                    pattern_name=field_type,
                    position=(match.start(), match.end())
                ))

        # Sort by confidence (SIRET preferred over SIREN)
        results.sort(key=lambda x: (x.confidence, x.pattern_name == 'SIRET'), reverse=True)
        return results

    def _validate_luhn(self, number: str) -> bool:
        """
        Validate a number using the Luhn algorithm.
        Used for SIRET/SIREN validation.
        """
        try:
            digits = [int(d) for d in number]
            # Double every second digit from right
            for i in range(len(digits) - 2, -1, -2):
                digits[i] *= 2
                if digits[i] > 9:
                    digits[i] -= 9
            return sum(digits) % 10 == 0
        except (ValueError, IndexError):
            return False

    # =========================================================================
    # PHONE EXTRACTION
    # =========================================================================

    def extract_phones(self, text: str) -> List[ExtractedField]:
        """
        Extract phone numbers from text (French/International formats).

        Args:
            text: Document text to search

        Returns:
            List of ExtractedField with phone numbers
        """
        if not text:
            return []

        phones = []
        seen = set()

        for pattern in self._compiled_phones:
            for match in pattern.finditer(text):
                raw_value = match.group(0)
                # Normalize: remove spaces, dots, dashes
                clean_value = re.sub(r'[\s.-]', '', raw_value)

                # Skip short/invalid numbers
                if len(clean_value) < 10:
                    continue

                # Skip if already seen (normalized)
                if clean_value in seen:
                    continue
                seen.add(clean_value)

                # Check context for phone-related keywords
                context = text[max(0, match.start() - 30):min(len(text), match.end() + 20)].lower()
                has_keyword = any(kw in context for kw in ['tél', 'tel', 'phone', 'mobile', 'portable', 'fax', 'appel'])

                # Calculate confidence
                confidence = 0.8
                if has_keyword:
                    confidence += 0.1
                if clean_value.startswith('+'):
                    confidence += 0.05  # International format is more explicit

                # Format nicely for French numbers
                if clean_value.startswith('0') and len(clean_value) == 10:
                    formatted = f"{clean_value[:2]} {clean_value[2:4]} {clean_value[4:6]} {clean_value[6:8]} {clean_value[8:]}"
                elif clean_value.startswith('+33') or clean_value.startswith('33'):
                    # +33 6 XX XX XX XX
                    digits = clean_value.replace('+', '').replace('33', '')
                    formatted = f"+33 {digits[0]} {digits[1:3]} {digits[3:5]} {digits[5:7]} {digits[7:9]}"
                else:
                    formatted = raw_value

                phones.append(ExtractedField(
                    value=formatted,
                    confidence=confidence,
                    source='regex',
                    pattern_name='phone',
                    position=(match.start(), match.end())
                ))

        phones.sort(key=lambda x: x.confidence, reverse=True)
        return phones

    # =========================================================================
    # DATE EXTRACTION
    # =========================================================================

    def extract_dates(self, text: str) -> List[ExtractedField]:
        """
        Extract dates from text in various French/European formats.

        Args:
            text: Document text to search

        Returns:
            List of ExtractedField with dates
        """
        if not text:
            return []

        dates = []
        seen = set()

        # French month names to numbers
        month_map = {
            'janvier': '01', 'février': '02', 'fevrier': '02', 'mars': '03',
            'avril': '04', 'mai': '05', 'juin': '06', 'juillet': '07',
            'août': '08', 'aout': '08', 'septembre': '09', 'octobre': '10',
            'novembre': '11', 'décembre': '12', 'decembre': '12'
        }

        for pattern_str, fmt in self.DATE_PATTERNS:
            pattern = re.compile(pattern_str, re.IGNORECASE)
            for match in pattern.finditer(text):
                try:
                    if fmt == 'dmy':
                        day, month, year = match.groups()
                        normalized = f"{int(day):02d}/{int(month):02d}/{year}"
                    elif fmt == 'dmy_text':
                        day, month_name, year = match.groups()
                        month = month_map.get(month_name.lower(), '01')
                        normalized = f"{int(day):02d}/{month}/{year}"
                    elif fmt == 'ymd':
                        year, month, day = match.groups()
                        normalized = f"{day}/{month}/{year}"
                    elif fmt == 'dmy_short':
                        day, month, year = match.groups()
                        # Assume 20XX for 2-digit years
                        full_year = f"20{year}" if int(year) < 50 else f"19{year}"
                        normalized = f"{int(day):02d}/{int(month):02d}/{full_year}"
                    else:
                        continue

                    # Skip if already seen
                    if normalized in seen:
                        continue
                    seen.add(normalized)

                    # Validate date
                    day_int = int(normalized.split('/')[0])
                    month_int = int(normalized.split('/')[1])
                    if not (1 <= day_int <= 31 and 1 <= month_int <= 12):
                        continue

                    # Check context for date type
                    context = text[max(0, match.start() - 50):match.start()].lower()
                    date_type = 'unknown'
                    if any(kw in context for kw in ['facture', 'invoice', 'date', 'du', 'le']):
                        date_type = 'invoice_date'
                    elif any(kw in context for kw in ['échéance', 'echeance', 'due', 'paiement', 'avant']):
                        date_type = 'due_date'
                    elif any(kw in context for kw in ['livraison', 'delivery', 'expédition']):
                        date_type = 'delivery_date'

                    dates.append(ExtractedField(
                        value=normalized,
                        confidence=0.85 if fmt in ['dmy', 'ymd'] else 0.75,
                        source='regex',
                        pattern_name=date_type,
                        position=(match.start(), match.end())
                    ))

                except (ValueError, IndexError):
                    continue

        return dates

    # =========================================================================
    # ADDRESS BLOCK EXTRACTION
    # =========================================================================

    def extract_addresses(self, text: str, paragraphs: Optional[List[Dict]] = None) -> Dict[str, Optional[ExtractedField]]:
        """
        Extract address blocks using keyword detection and spatial analysis.

        This uses LOCAL heuristics - no LLM calls.

        Args:
            text: Document text
            paragraphs: Optional Azure paragraph data with spatial info

        Returns:
            Dict with 'billing', 'shipping', 'vendor' address blocks
        """
        results = {'billing': None, 'shipping': None, 'vendor': None}

        for addr_type, keywords in self.ADDRESS_KEYWORDS.items():
            for keyword in keywords:
                pattern = re.compile(keyword, re.IGNORECASE | re.MULTILINE)
                match = pattern.search(text)

                if match:
                    # Extract block after keyword (up to next section or 200 chars)
                    start = match.end()
                    # Look for end markers
                    end_markers = [
                        r'\n\s*\n',  # Double newline
                        r'\n[A-Z][^a-z]+:',  # Next section header
                        r'(?:factur|livr|ship|bill|total|montant|tva)',  # Invoice keywords
                    ]

                    end = start + 200  # Default max length
                    for marker in end_markers:
                        marker_match = re.search(marker, text[start:start + 300], re.IGNORECASE)
                        if marker_match:
                            end = min(end, start + marker_match.start())

                    block = text[start:end].strip()

                    # Clean up the block
                    block = re.sub(r'\s+', ' ', block)
                    block = block.strip()

                    if len(block) > 10:  # Minimum valid address length
                        results[addr_type] = ExtractedField(
                            value=block,
                            confidence=0.75,
                            source='regex',
                            pattern_name=f'{addr_type}_address',
                            position=(start, end)
                        )
                        break  # Found address for this type, move to next

        return results

    # =========================================================================
    # VAT AND IBAN EXTRACTION
    # =========================================================================

    def extract_vat_numbers(self, text: str) -> List[ExtractedField]:
        """Extract VAT/TVA numbers."""
        if not text:
            return []

        results = []
        seen = set()

        for pattern in self._compiled_vat:
            for match in pattern.finditer(text):
                value = match.group(0).upper()
                clean = re.sub(r'\s', '', value)

                if clean in seen:
                    continue
                seen.add(clean)

                # Check context
                context = text[max(0, match.start() - 30):match.end() + 10].lower()
                has_keyword = any(kw in context for kw in ['tva', 'vat', 'tax', 'intracommunautaire'])

                results.append(ExtractedField(
                    value=value,
                    confidence=0.85 if has_keyword else 0.7,
                    source='regex',
                    pattern_name='VAT',
                    position=(match.start(), match.end())
                ))

        return results

    def extract_ibans(self, text: str) -> List[ExtractedField]:
        """Extract IBAN numbers."""
        if not text:
            return []

        results = []
        seen = set()

        for pattern in self._compiled_iban:
            for match in pattern.finditer(text):
                value = match.group(0).upper()
                clean = re.sub(r'\s', '', value)

                if clean in seen:
                    continue
                seen.add(clean)

                # Validate IBAN checksum (basic check)
                is_valid = self._validate_iban_checksum(clean)

                results.append(ExtractedField(
                    value=value,
                    confidence=0.9 if is_valid else 0.7,
                    source='regex',
                    pattern_name='IBAN',
                    position=(match.start(), match.end())
                ))

        return results

    def _validate_iban_checksum(self, iban: str) -> bool:
        """Validate IBAN using mod-97 checksum."""
        try:
            # Move first 4 chars to end
            rearranged = iban[4:] + iban[:4]
            # Convert letters to numbers (A=10, B=11, ...)
            numeric = ''
            for char in rearranged:
                if char.isdigit():
                    numeric += char
                else:
                    numeric += str(ord(char) - 55)
            # Check mod 97
            return int(numeric) % 97 == 1
        except:
            return False

    # =========================================================================
    # FULL EXTRACTION
    # =========================================================================

    def extract_all(self, text: str, vendor_name: Optional[str] = None,
                    paragraphs: Optional[List[Dict]] = None) -> LocalExtractionResult:
        """
        Run all local extractions on the document text.

        Args:
            text: Document text
            vendor_name: Optional vendor name for email matching
            paragraphs: Optional Azure paragraph data

        Returns:
            LocalExtractionResult with all extractions and best candidates
        """
        result = LocalExtractionResult()

        # Run all extractors
        result.emails = self.extract_emails(text, vendor_name)
        result.phones = self.extract_phones(text)
        result.siret_siren = self.extract_siret_siren(text)
        result.dates = self.extract_dates(text)
        result.vat_numbers = self.extract_vat_numbers(text)
        result.ibans = self.extract_ibans(text)

        # Extract addresses
        addresses = self.extract_addresses(text, paragraphs)
        if addresses['billing']:
            result.addresses.append(addresses['billing'])
            result.billing_address = addresses['billing'].value
        if addresses['shipping']:
            result.addresses.append(addresses['shipping'])
            result.shipping_address = addresses['shipping'].value

        # Set best candidates
        if result.emails:
            result.best_email = result.emails[0].value
        if result.phones:
            result.best_phone = result.phones[0].value
        if result.siret_siren:
            result.best_siret = result.siret_siren[0].value

        return result

    # =========================================================================
    # UTILITIES
    # =========================================================================

    def _fuzzy_match(self, str1: str, str2: str) -> float:
        """Calculate fuzzy match ratio between two strings."""
        return SequenceMatcher(None, str1, str2).ratio()


# =============================================================================
# AZURE RESULT MERGER
# =============================================================================

class AzureResultMerger:
    """
    Merges Azure Document Intelligence results with local extractions.

    Priority:
    1. Azure result (if available and confidence > threshold)
    2. Local extraction (for PII fields like email, phone, SIRET)
    3. LLM fallback (ONLY for contextual fields, with anonymized text)
    """

    def __init__(self, confidence_threshold: float = 0.7):
        """
        Initialize the merger.

        Args:
            confidence_threshold: Minimum Azure confidence to keep a field
        """
        self.confidence_threshold = confidence_threshold
        self.local_extractor = LocalExtractor()

    def merge(self, azure_result: Dict[str, Any],
              document_text: str,
              vendor_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Merge Azure results with local extractions.

        Args:
            azure_result: Raw Azure Document Intelligence result
            document_text: Full document text for local extraction
            vendor_name: Vendor name from Azure (for email matching)

        Returns:
            Enhanced result with locally extracted fields
        """
        # Run local extraction
        local = self.local_extractor.extract_all(document_text, vendor_name)

        # Create merged result (copy Azure result)
        merged = dict(azure_result)

        # Field mapping: azure_field -> (local_field, extractor)
        field_mappings = [
            ('VendorEmail', 'best_email', lambda: local.best_email),
            ('VendorPhone', 'best_phone', lambda: local.best_phone),
            ('VendorTaxId', 'best_siret', lambda: local.best_siret),
            ('BillingAddress', 'billing_address', lambda: local.billing_address),
            ('ShippingAddress', 'shipping_address', lambda: local.shipping_address),
        ]

        for azure_field, local_field, getter in field_mappings:
            azure_value = self._get_azure_field(azure_result, azure_field)

            if not azure_value:
                local_value = getter()
                if local_value:
                    merged[azure_field] = {
                        'value': local_value,
                        'confidence': 0.8,
                        'source': 'local_regex'
                    }
                    logger.info(f"Filled {azure_field} from local extraction: {local_value[:50]}...")

        # Add all extracted IBANs (Azure often misses these)
        if local.ibans and not self._get_azure_field(azure_result, 'PaymentDetails'):
            merged['PaymentDetails'] = {
                'value': {'iban': local.ibans[0].value},
                'confidence': local.ibans[0].confidence,
                'source': 'local_regex'
            }

        # Add local extraction metadata
        merged['_local_extraction'] = {
            'emails_found': len(local.emails),
            'phones_found': len(local.phones),
            'siret_found': len(local.siret_siren),
            'dates_found': len(local.dates),
            'addresses_found': len(local.addresses),
            'ibans_found': len(local.ibans),
        }

        return merged

    def _get_azure_field(self, azure_result: Dict, field_name: str) -> Optional[str]:
        """Get a field value from Azure result, checking confidence."""
        field = azure_result.get(field_name)
        if not field:
            return None

        if isinstance(field, dict):
            confidence = field.get('confidence', 0)
            if confidence < self.confidence_threshold:
                return None
            return field.get('value')

        return field if field else None


# =============================================================================
# LLM FALLBACK (Privacy-Safe)
# =============================================================================

class SafeLLMExtractor:
    """
    LLM-based extraction for contextual fields that local regex can't handle.

    🛡️ CRITICAL: Text is ALWAYS anonymized before sending to LLM.
    The LLM only sees: "Facturé à <ORG>. Paiement sous 30 jours."
    It extracts "30 jours" without knowing who the client is.
    """

    def __init__(self):
        """Initialize the safe LLM extractor."""
        # Import here to avoid circular imports
        from services.privacy import PrivacyAirlock, sanitize_for_llm
        self.privacy_airlock = PrivacyAirlock()
        self.sanitize = sanitize_for_llm

    def extract_payment_terms(self, document_text: str) -> Optional[Dict[str, Any]]:
        """
        Extract payment terms using LLM (with anonymized text).

        Args:
            document_text: Raw document text

        Returns:
            Dict with payment_days, payment_method, etc.
        """
        try:
            from utils.prompt_loader import load_prompt
            from utils.model_factory import get_model
            from langchain_core.messages import SystemMessage, HumanMessage
            from langchain_core.output_parsers import JsonOutputParser
        except ImportError:
            logger.warning("LLM utilities not available")
            return None

        # 🛡️ ANONYMIZE BEFORE SENDING TO LLM
        clean_text, mappings = self.sanitize(document_text[:2000])

        # Extract only the relevant section for payment terms
        payment_section = self._extract_payment_section(clean_text)

        if not payment_section:
            return None

        # Send anonymized text to LLM
        prompt = f"""Extract payment terms from this invoice text. The text has been anonymized for privacy.

TEXT:
{payment_section}

Return JSON with:
- payment_days: number of days for payment (e.g., 30)
- payment_method: method mentioned (e.g., "bank transfer", "check")
- discount_early: early payment discount if mentioned (e.g., "2% if paid within 10 days")
- late_penalty: late payment penalty if mentioned
"""

        try:
            llm = get_model("fast")
            parser = JsonOutputParser()
            chain = llm | parser

            result = chain.invoke([
                SystemMessage(content="You extract payment terms from invoices. Return only valid JSON."),
                HumanMessage(content=prompt)
            ])

            return result

        except Exception as e:
            logger.error(f"LLM extraction failed: {e}")
            return None

    def _extract_payment_section(self, text: str) -> Optional[str]:
        """Extract the section of text likely containing payment terms."""
        keywords = [
            r'paiement', r'payment', r'règlement', r'reglement',
            r'échéance', r'echeance', r'conditions', r'modalités'
        ]

        for kw in keywords:
            match = re.search(kw, text, re.IGNORECASE)
            if match:
                # Extract 200 chars around the keyword
                start = max(0, match.start() - 50)
                end = min(len(text), match.end() + 200)
                return text[start:end]

        return None


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def extract_invoice_pii(text: str, vendor_name: Optional[str] = None) -> LocalExtractionResult:
    """
    Convenience function for extracting PII from invoice text.

    This is the main entry point for local extraction.

    Args:
        text: Invoice text content
        vendor_name: Optional vendor name for email matching

    Returns:
        LocalExtractionResult with all extracted fields
    """
    extractor = LocalExtractor()
    return extractor.extract_all(text, vendor_name)


def enhance_azure_result(azure_result: Dict, document_text: str) -> Dict:
    """
    Convenience function to enhance Azure results with local extractions.

    Args:
        azure_result: Raw Azure Document Intelligence result
        document_text: Full document text

    Returns:
        Enhanced result dictionary
    """
    vendor_name = None
    if 'VendorName' in azure_result:
        vendor_field = azure_result['VendorName']
        vendor_name = vendor_field.get('value') if isinstance(vendor_field, dict) else vendor_field

    merger = AzureResultMerger()
    return merger.merge(azure_result, document_text, vendor_name)
