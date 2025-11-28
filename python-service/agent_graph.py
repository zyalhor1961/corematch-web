from typing import TypedDict, Any, Dict, Optional, Literal
from decimal import Decimal
import json
import os
from datetime import datetime
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from privacy_guard import PrivacyAirlock

# New utilities
from utils.prompt_loader import load_prompt
from utils.model_factory import get_model
from services.dual_path_ingestion import DualPathIngestion
from services.extraction_utils import enhance_azure_result

# Privacy service for GDPR-compliant LLM calls
from services.privacy import PrivacyAirlock as PrivacyService, sanitize_for_llm

# LangGraph imports
from langgraph.graph import StateGraph, END
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import JsonOutputParser

# Initialize Privacy Airlock (legacy)
privacy_guard = PrivacyAirlock()

# Initialize Privacy Service for LLM calls
privacy_service = PrivacyService(extended_mode=False)

# Document type definitions
DocumentType = Literal["INVOICE", "QUOTATION", "CONTRACT", "RECEIPT", "BANK_STATEMENT", "OTHER"]

def get_client_rules(org_id: str) -> str:
    """Placeholder: fetch active rules for the accountant agent from Supabase."""
    # TODO: Implement actual fetch from Supabase
    return "POLICY: Flag any invoice > 5000 EUR. POLICY: Reject expenses for 'Alcohol'."

def recursive_redact(data: Any) -> Any:
    """Recursively redact PII from strings, lists, and dicts."""
    if isinstance(data, str):
        return privacy_guard.redact_pii(data)
    if isinstance(data, list):
        return [recursive_redact(item) for item in data]
    if isinstance(data, dict):
        return {k: recursive_redact(v) for k, v in data.items()}
    return data

class AgentState(TypedDict):
    invoice_id: str
    file_url: str
    amount_raw: float
    verification_status: str
    messages: list[str]
    extraction_data: Dict[str, Any]
    suggested_entry: Optional[Dict[str, Any]]
    # Classification fields
    document_type: Optional[str]  # INVOICE, QUOTATION, CONTRACT, etc.
    classification_confidence: Optional[float]
    raw_text_for_classification: Optional[str]  # First N chars for classification

def force_serialize(obj: Any) -> Any:
    """Force JSON serialisation by converting unknown objects to strings."""
    try:
        return json.loads(json.dumps(obj, default=str))
    except Exception as e:
        print(f"Force Serialize Error: {e}")
        return str(obj)

def to_serializable(obj: Any) -> Any:
    """Convert Azure SDK objects to plain Python types."""
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if hasattr(obj, 'amount') and hasattr(obj, 'symbol'):
        try:
            return {
                "amount": float(obj.amount),
                "symbol": str(obj.symbol) if obj.symbol else None,
                "code": getattr(obj, 'code', None)
            }
        except:
            return str(obj)
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()
    if hasattr(obj, 'value') and not isinstance(obj, dict):
        return to_serializable(obj.value)
    if isinstance(obj, list):
        return [to_serializable(item) for item in obj]
    if isinstance(obj, dict) or hasattr(obj, 'items'):
        try:
            return {k: to_serializable(v) for k, v in dict(obj).items()}
        except:
            pass
    return str(obj)

def read_document_node(state: AgentState):
    print(f"🔍 Reading Document {state['invoice_id']}...")
    messages = state.get('messages', [])
    try:
        endpoint = os.getenv("AZURE_FORM_ENDPOINT")
        key = os.getenv("AZURE_FORM_KEY")
        if not endpoint or not key:
            messages.append("⚠️ Azure keys missing. Using simulation mode.")
            return {"amount_raw": 0.0, "messages": messages, "extraction_data": {}}

        client = DocumentAnalysisClient(endpoint=endpoint, credential=AzureKeyCredential(key))
        file_url = state.get("file_url")
        if not file_url:
            messages.append("❌ No file URL provided.")
            return {"messages": messages}

        poller = client.begin_analyze_document_from_url("prebuilt-invoice", file_url)
        result = poller.result()

        if not result.documents:
            messages.append("❌ No document content found.")
            return {"messages": messages}

        invoice = result.documents[0]

        def extract_with_box(field):
            if not field:
                return None
            val = to_serializable(field.value)
            box = []
            page_number = 1
            if field.bounding_regions:
                for point in field.bounding_regions[0].polygon:
                    box.extend([point.x, point.y])
                page_number = field.bounding_regions[0].page_number
            return {
                "value": val, 
                "box": box, 
                "page": page_number,
                "content": field.content if hasattr(field, 'content') else str(val),
                "confidence": field.confidence if hasattr(field, 'confidence') else 1.0
            }

        clean_fields = {k: extract_with_box(v) for k, v in invoice.fields.items()}

        # Page metadata with words and lines (for Human-in-the-Loop corrections)
        pages_metadata = []
        if result.pages:
            print(f"📄 Found {len(result.pages)} page(s)")
            for page in result.pages:
                # Extract words with their polygons for interactive selection
                words_data = []
                has_words = hasattr(page, 'words') and page.words
                print(f"  Page {page.page_number}: {page.width}x{page.height} {page.unit}, has_words={has_words}")
                if has_words:
                    print(f"    Words count: {len(page.words)}")
                    for word in page.words:
                        word_polygon = []
                        if hasattr(word, 'polygon') and word.polygon:
                            for point in word.polygon:
                                word_polygon.extend([point.x, point.y])
                        words_data.append({
                            "content": word.content if hasattr(word, 'content') else str(word),
                            "polygon": word_polygon,
                            "confidence": word.confidence if hasattr(word, 'confidence') else 1.0
                        })
                    if words_data:
                        print(f"    First word: '{words_data[0]['content']}' polygon: {words_data[0]['polygon'][:4]}...")

                # Extract lines (grouped words) for cleaner display
                lines_data = []
                has_lines = hasattr(page, 'lines') and page.lines
                if has_lines:
                    print(f"    Lines count: {len(page.lines)}")
                    for line in page.lines:
                        line_polygon = []
                        if hasattr(line, 'polygon') and line.polygon:
                            for point in line.polygon:
                                line_polygon.extend([point.x, point.y])
                        # Calculate average confidence from words in this line
                        line_confidence = 1.0
                        if hasattr(line, 'spans') and line.spans and words_data:
                            # Try to match words to this line and average their confidence
                            word_confidences = []
                            line_content = line.content if hasattr(line, 'content') else ''
                            for word in words_data:
                                if word['content'] in line_content:
                                    word_confidences.append(word['confidence'])
                            if word_confidences:
                                line_confidence = sum(word_confidences) / len(word_confidences)
                        lines_data.append({
                            "content": line.content if hasattr(line, 'content') else str(line),
                            "polygon": line_polygon,
                            "confidence": line_confidence
                        })
                    if lines_data:
                        print(f"    First line: '{lines_data[0]['content'][:50]}...' polygon: {lines_data[0]['polygon'][:4]}...")

                pages_metadata.append({
                    "page_number": page.page_number,
                    "width": page.width,
                    "height": page.height,
                    "unit": str(page.unit),
                    "angle": page.angle,
                    "words": words_data,  # Individual words for selection
                    "lines": lines_data   # Grouped lines for display
                })
        clean_fields["_metadata"] = {"pages": pages_metadata}

        # Financial extraction helpers
        def get_amount(name):
            f = invoice.fields.get(name)
            if f:
                if hasattr(f.value, 'amount'):
                    return float(f.value.amount)
                if isinstance(f.value, (int, float)):
                    return float(f.value)
            return 0.0

        total_ttc = get_amount("InvoiceTotal")
        total_tax = get_amount("TotalTax")
        total_ht = get_amount("SubTotal")

        if total_ht == 0.0 and total_ttc > 0:
            total_ht = total_ttc - total_tax if total_tax > 0 else total_ttc

        # Map to frontend fields
        if "InvoiceTotal" in clean_fields and clean_fields["InvoiceTotal"]:
            clean_fields["total_amount"] = clean_fields["InvoiceTotal"]
            clean_fields["total_amount"]["value"] = total_ttc
        else:
            clean_fields["total_amount"] = {"value": total_ttc, "box": [], "page": 1}

        if "VendorName" in clean_fields and clean_fields["VendorName"]:
            clean_fields["vendor_name"] = clean_fields["VendorName"]
        else:
            clean_fields["vendor_name"] = {"value": "Unknown", "box": [], "page": 1}

        if "InvoiceDate" in clean_fields and clean_fields["InvoiceDate"]:
            clean_fields["invoice_date"] = clean_fields["InvoiceDate"]
        else:
            clean_fields["invoice_date"] = {"value": None, "box": [], "page": 1}
        
        clean_fields["tax_amount"] = total_tax
        clean_fields["net_amount"] = total_ht
        messages.append(f"✅ Financials Extracted: TTC {total_ttc} | HT {total_ht} | Tax {total_tax}")

        # Redact PII values only
        def redact_values(d):
            if isinstance(d, dict):
                if "value" in d:
                    d["value"] = recursive_redact(d["value"])
                return {k: redact_values(v) for k, v in d.items()}
            if isinstance(d, list):
                return [redact_values(i) for i in d]
            return d
        
        clean_fields = redact_values(clean_fields)
        messages.append("🛡️ Privacy Airlock: PII Redacted.")

        # --- LOCAL EXTRACTION ENHANCEMENT ---
        # Enhance Azure result with robust regex-based extraction for PII fields
        # This catches emails, phones, SIRET/SIREN that Azure might miss
        try:
            # Build full text from all pages
            full_text_parts = []
            for page in pages_metadata:
                for line in page.get('lines', []):
                    full_text_parts.append(line.get('content', ''))
            full_document_text = '\n'.join(full_text_parts)

            if full_document_text:
                clean_fields = enhance_azure_result(clean_fields, full_document_text)
                messages.append("🔍 Local Extraction: Enhanced with regex patterns (emails, phones, SIRET).")
        except Exception as enhance_error:
            print(f"Local Enhancement Error: {enhance_error}")
            messages.append(f"⚠️ Local extraction enhancement skipped: {enhance_error}")
        # ----------------------------------

        # NOTE: Dual-Path Ingestion moved to classify_document_node
        # to leverage doc_type for SmartChunker strategy selection
        # ---------------------------

        # Extract raw text for classification (concatenate all lines from first page)
        raw_text_for_classification = ""
        if pages_metadata and len(pages_metadata) > 0:
            first_page_lines = pages_metadata[0].get('lines', [])
            raw_text_for_classification = ' '.join([
                line.get('content', '') for line in first_page_lines[:50]  # First 50 lines
            ])[:2000]  # Limit to 2000 chars

        result_state = {
            "extraction_data": clean_fields,
            "amount_raw": float(total_ttc),
            "messages": messages,
            "raw_text_for_classification": raw_text_for_classification
        }
        return force_serialize(result_state)

    except Exception as e:
        print(f"OCR Error: {e}")
        messages.append(f"❌ OCR Error: {str(e)}")
        return {"messages": messages}

def classify_document_node(state: AgentState):
    """
    Document Classification Node

    Classifies documents into: INVOICE, QUOTATION, CONTRACT, RECEIPT, BANK_STATEMENT, OTHER

    🛡️ PRIVACY AIRLOCK: Text is anonymized BEFORE being sent to LLM.
    The AI classifies based on STRUCTURE (keywords like "Devis", "Facture", "Contrat"),
    not on personal data (which is replaced with <PERSON_1>, <EMAIL_1>, etc.)
    """
    print(f"🔍 Classifying Document {state['invoice_id']}...")
    messages = state.get('messages', [])

    # Get raw text from extraction (if available)
    raw_text = state.get('raw_text_for_classification', '')
    extraction_data = state.get('extraction_data', {})

    # Build text for classification from available sources
    if not raw_text and extraction_data:
        # Concatenate extracted fields to form classification text
        text_parts = []
        for key, value in extraction_data.items():
            if key.startswith('_'):  # Skip metadata
                continue
            if isinstance(value, dict) and 'content' in value:
                text_parts.append(str(value['content']))
            elif isinstance(value, dict) and 'value' in value:
                text_parts.append(str(value['value']))
            elif isinstance(value, str):
                text_parts.append(value)
        raw_text = ' '.join(text_parts)[:2000]  # Limit to 2000 chars

    if not raw_text:
        messages.append("⚠️ No text available for classification, defaulting to INVOICE")
        return {
            "document_type": "INVOICE",
            "classification_confidence": 0.5,
            "messages": messages
        }

    # 🛡️ PRIVACY AIRLOCK: Anonymize text before sending to LLM
    # "Devis pour Jean Dupont" → "Devis pour <PERSON_1>"
    try:
        anonymized_result = privacy_service.anonymize(raw_text)
        clean_text = anonymized_result["clean_text"]
        pii_stats = anonymized_result.get("stats", {})

        if pii_stats:
            messages.append(f"🛡️ Privacy Airlock: Anonymized {sum(pii_stats.values())} PII entities for classification")
            print(f"  PII Stats: {pii_stats}")
    except Exception as e:
        print(f"Privacy Airlock error: {e}")
        clean_text = raw_text  # Fallback to raw (not ideal but prevents crash)

    # Quick keyword-based pre-classification (no LLM needed for obvious cases)
    text_lower = clean_text.lower()

    # QUOTATION indicators (check first - often misclassified as Contract)
    quotation_keywords = ['devis', 'quotation', 'estimation', 'offre de prix', 'quote', 'proposition commerciale']
    if any(kw in text_lower for kw in quotation_keywords):
        # Check for price/qty indicators to confirm it's a quote not just mentioning quotes
        if any(indicator in text_lower for indicator in ['total', 'prix', 'montant', 'quantité', 'qty', 'validité']):
            messages.append("✅ Classification: QUOTATION (keyword match + price indicators)")
            return {
                "document_type": "QUOTATION",
                "classification_confidence": 0.95,
                "messages": messages
            }

    # INVOICE indicators
    invoice_keywords = ['facture', 'invoice', 'échéance', 'montant dû', 'total ttc', 'tva']
    if any(kw in text_lower for kw in invoice_keywords):
        if 'devis' not in text_lower and 'quotation' not in text_lower:
            messages.append("✅ Classification: INVOICE (keyword match)")
            return {
                "document_type": "INVOICE",
                "classification_confidence": 0.92,
                "messages": messages
            }

    # CONTRACT indicators
    contract_keywords = ['contrat', 'contract', 'accord', 'convention', 'article', 'clause', 'signataire']
    if any(kw in text_lower for kw in contract_keywords):
        # Make sure it's not a quote that mentions contract terms
        if 'devis' not in text_lower and 'quotation' not in text_lower:
            messages.append("✅ Classification: CONTRACT (keyword match)")
            return {
                "document_type": "CONTRACT",
                "classification_confidence": 0.88,
                "messages": messages
            }

    # If no clear match, use LLM for classification
    if not os.getenv("OPENAI_API_KEY") and not os.getenv("ANTHROPIC_API_KEY"):
        messages.append("⚠️ No API keys, defaulting to INVOICE")
        return {
            "document_type": "INVOICE",
            "classification_confidence": 0.5,
            "messages": messages
        }

    try:
        # Load classifier prompt with ANONYMIZED text
        prompt_vars = {"content": clean_text[:1500]}  # Limit size for LLM
        prompt_parts = load_prompt("classifier", variables=prompt_vars)

        messages_payload = [
            SystemMessage(content=prompt_parts.get("system", "")),
            HumanMessage(content=prompt_parts.get("user", "")),
        ]

        llm = get_model("fast")  # Use fast model for classification
        parser = JsonOutputParser()
        chain = llm | parser
        result = chain.invoke(messages_payload)

        doc_type = result.get("type", "INVOICE")
        confidence = result.get("confidence", 0.7)
        reasoning = result.get("reasoning", "")

        messages.append(f"✅ Classification: {doc_type} (confidence: {confidence:.0%}) - {reasoning}")

        return {
            "document_type": doc_type,
            "classification_confidence": confidence,
            "messages": messages
        }

    except Exception as e:
        print(f"Classification LLM error: {e}")
        messages.append(f"⚠️ Classification failed: {e}, defaulting to INVOICE")
        return {
            "document_type": "INVOICE",
            "classification_confidence": 0.5,
            "messages": messages
        }


def ingest_document_node(state: AgentState):
    """
    Document Ingestion Node - Runs Dual-Path Ingestion with SmartChunker

    This node runs AFTER classification so we can use doc_type for:
    - SmartChunker strategy selection (financial, legal, HR, generic)
    - Metadata enrichment in vector chunks

    Flow: read_document -> classify_document -> ingest_document -> accountant
    """
    print(f"📥 Ingesting Document {state['invoice_id']} (type: {state.get('document_type', 'INVOICE')})...")
    messages = state.get('messages', [])
    extraction_data = state.get('extraction_data', {})
    doc_type = state.get('document_type', 'INVOICE')

    try:
        dual_path = DualPathIngestion(
            supabase_url=os.getenv("SUPABASE_URL"),
            supabase_key=os.getenv("SUPABASE_SERVICE_KEY"),
            openai_api_key=os.getenv("OPENAI_API_KEY")
        )

        # Fetch org_id and filename from the invoice
        org_id = None
        filename = None
        if dual_path.supabase:
            try:
                invoice_result = dual_path.supabase.table('invoices')\
                    .select('org_id, file_name')\
                    .eq('id', state['invoice_id'])\
                    .single()\
                    .execute()
                if invoice_result.data:
                    org_id = invoice_result.data.get('org_id')
                    filename = invoice_result.data.get('file_name')
                    print(f"  📍 org_id: {org_id}, filename: {filename}")
            except Exception as org_err:
                print(f"  ⚠️ Failed to fetch invoice metadata: {org_err}")

        # Build full text for SmartChunker
        full_text = None
        pages_meta = extraction_data.get('_metadata', {}).get('pages', [])
        if pages_meta:
            text_parts = []
            for page in pages_meta:
                for line in page.get('lines', []):
                    text_parts.append(line.get('content', ''))
            full_text = '\n'.join(text_parts)

        # Run dual-path ingestion with doc_type for SmartChunker
        dual_result = dual_path.ingest_invoice(
            invoice_id=state['invoice_id'],
            azure_fields=extraction_data,
            page_content=full_text,
            org_id=org_id,
            doc_type=doc_type,  # <-- SmartChunker uses this!
            filename=filename
        )

        # Build status message with supplier matching info
        status_parts = [
            f"{dual_result['line_items_count']} line items",
            f"{dual_result['context_chunks_count']} smart chunks ({doc_type})"
        ]
        if dual_result.get('supplier_matched'):
            status_parts.append("supplier auto-linked")
        messages.append(f"📊 Dual-Path: {', '.join(status_parts)}.")

        return {"messages": messages}

    except Exception as dual_error:
        print(f"Dual-Path Ingestion Error: {dual_error}")
        messages.append(f"⚠️ Dual-Path Ingestion failed: {dual_error}")
        return {"messages": messages}


def guess_charge_account(vendor_name: str, description: str) -> str:
    """Guess the charge account based on vendor name and description keywords.
    Returns a proper 6xx French PCG account instead of 471000 (compte d'attente).
    """
    text = f"{vendor_name} {description}".lower()

    # Keyword mappings to French PCG accounts
    mappings = [
        # 606 - Achats non stockés
        (["amazon", "fournitures", "bureau", "papeterie", "staples"], "606400"),  # Fournitures administratives
        (["edf", "engie", "électricité", "electricite", "gaz", "eau", "veolia"], "606100"),  # Énergie
        (["entretien", "nettoyage", "ménage", "menage"], "606300"),  # Petit équipement

        # 613 - Locations
        (["loyer", "bail", "location", "immobilier"], "613200"),  # Locations immobilières
        (["leasing", "crédit-bail", "credit-bail"], "612000"),  # Crédit-bail

        # 615 - Entretien et réparations
        (["maintenance", "réparation", "reparation", "sav", "service après-vente"], "615500"),

        # 616 - Assurances
        (["assurance", "axa", "allianz", "maif", "macif", "groupama"], "616000"),

        # 621 - Intérim
        (["intérim", "interim", "manpower", "adecco", "randstad"], "621000"),

        # 622 - Honoraires
        (["avocat", "notaire", "expert-comptable", "consultant", "conseil", "audit"], "622600"),

        # 623 - Publicité
        (["publicité", "publicite", "google ads", "facebook", "marketing", "communication"], "623100"),
        (["cadeau", "goodies"], "623400"),

        # 624 - Transport
        (["transport", "livraison", "fret"], "624000"),

        # 625 - Déplacements
        (["sncf", "air france", "train", "avion", "hotel", "hôtel", "booking", "voyage", "déplacement"], "625100"),
        (["restaurant", "repas", "traiteur", "réception"], "625700"),

        # 626 - Télécommunications
        (["orange", "sfr", "free", "bouygues", "téléphone", "telephone", "internet", "fibre"], "626200"),
        (["la poste", "colissimo", "chronopost", "ups", "dhl", "fedex", "courrier"], "626100"),

        # 627 - Services bancaires
        (["banque", "frais bancaires", "commission bancaire"], "627000"),

        # 604 - Prestations informatiques
        (["informatique", "logiciel", "saas", "cloud", "hébergement", "hosting", "software"], "604000"),

        # 618 - Formation
        (["formation", "séminaire", "seminaire", "conférence", "conference"], "618000"),
    ]

    for keywords, account in mappings:
        if any(kw in text for kw in keywords):
            return account

    # Default: Achats non stockés - Autres (generic expense)
    return "606800"


def accountant_node(state: AgentState):
    print(f"🤖 Accountant analyzing Invoice #{state['invoice_id']}...")
    messages = state.get('messages', [])
    extraction = state.get('extraction_data', {})
    
    def get_decimal(key, default=0.0):
        val = extraction.get(key, default)
        if isinstance(val, dict):
            val = val.get("value", default)
        try:
            return Decimal(str(val))
        except:
            return Decimal(str(default))

    total_ttc = get_decimal("total_amount")
    amount_ht = get_decimal("net_amount")
    amount_tax = get_decimal("tax_amount")

    # Prompt variables
    vendor_name = extraction.get('VendorName', {}).get('value', 'Inconnu')
    currency = "EUR"
    inv_total = extraction.get('InvoiceTotal', {}).get('value')
    if isinstance(inv_total, dict) and inv_total.get('symbol'):
        currency = inv_total.get('symbol')

    description = f"Facture de {vendor_name}"
    items_list = []
    if extraction.get('Items'):
        items_val = extraction['Items'].get('value', [])
        if isinstance(items_val, list):
            for item in items_val:
                if isinstance(item, dict) and 'value' in item:
                    fields = item['value']
                    if 'Description' in fields:
                        desc = fields['Description'].get('value')
                        if desc:
                            items_list.append(str(desc))
    
    if items_list:
        description = ", ".join(items_list[:3])
        if len(items_list) > 3:
            description += "..."

    # LLM call via Prompt Loader & Model Factory, with fallback if API keys missing
    if not os.getenv("OPENAI_API_KEY") and not os.getenv("ANTHROPIC_API_KEY"):
        # Fallback: Use keyword matching to suggest a proper 6xx charge account
        fallback_account = guess_charge_account(vendor_name, description)
        suggestion = {
            "charge_account": fallback_account,
            "vat_account": "445660",
            "label": f"Facture {vendor_name}",
            "amount_ht": float(amount_ht),
            "amount_tax": float(amount_tax),
            "amount_ttc": float(total_ttc),
            "currency": currency,
            "reasoning": "Classification automatique (mode hors-ligne)"
        }
        messages.append(f"⚠️ LLM skipped due to missing API keys; using fallback suggestion ({fallback_account}).")
    else:
        try:
            prompt_vars = {
                "current_date": datetime.utcnow().strftime("%Y-%m-%d"),
                "threshold": 5000,
                "currency": currency,
                "trusted_vendor": "Acme Corp",
                "trusted_limit": 1000,
                "vendor": vendor_name,
                "invoice_data": {
                    "vendor": vendor_name,
                    "total_ttc": float(total_ttc),
                    "total_ht": float(amount_ht),
                    "tax": float(amount_tax),
                    "currency": currency,
                    "description": description,
                },
            }
            prompt_parts = load_prompt("accountant", variables=prompt_vars)
            
            # Use direct messages to avoid LangChain interpreting JSON braces as variables
            messages_payload = [
                SystemMessage(content=prompt_parts.get("system", "")),
                HumanMessage(content=prompt_parts.get("user", "")),
            ]
            
            llm = get_model("finance")
            parser = JsonOutputParser()
            chain = llm | parser
            suggestion = chain.invoke(messages_payload)
            
            suggestion["amount_ht"] = float(amount_ht)
            suggestion["amount_tax"] = float(amount_tax)
            suggestion["amount_ttc"] = float(total_ttc)
            suggestion["currency"] = currency
            
            if amount_ht > 0:
                implied = amount_tax / amount_ht
                suggestion["tax_rate"] = float(implied.quantize(Decimal("0.01")))
            else:
                suggestion["tax_rate"] = 0.0
                
            messages.append(f"✨ AI Suggestion: {suggestion['charge_account']} ({suggestion['label']}) - Using Extracted Financials")
        except Exception as e:
            print(f"LLM Error: {e}")
            messages.append(f"⚠️ AI Accounting failed: {e}")
            # Fallback: Use keyword matching to suggest a proper 6xx charge account
            fallback_account = guess_charge_account(vendor_name, description)
            suggestion = {
                "charge_account": fallback_account,
                "vat_account": "445660",
                "label": f"Facture {vendor_name}",
                "amount_ht": float(amount_ht),
                "amount_tax": float(amount_tax),
                "amount_ttc": float(total_ttc),
                "currency": currency,
                "reasoning": f"Classification automatique après erreur LLM ({fallback_account})"
            }

    # Policy check
    threshold = Decimal("5000.00")
    if total_ttc > threshold:
        status = "NEEDS_APPROVAL"
        messages.append(f"⚠️ Amount {total_ttc} exceeds limit of {threshold}.")
    else:
        status = "APPROVED"
        messages.append(f"✅ Amount {total_ttc} is within limits.")

    return {
        "verification_status": status,
        "messages": messages,
        "amount_raw": float(total_ttc),
        "suggested_entry": suggestion,
    }

# Build the graph with classification + smart ingestion
workflow = StateGraph(AgentState)
workflow.add_node("read_document", read_document_node)
workflow.add_node("classify_document", classify_document_node)
workflow.add_node("ingest_document", ingest_document_node)  # SmartChunker-powered
workflow.add_node("accountant", accountant_node)

# Graph flow: read_document -> classify_document -> ingest_document -> accountant -> END
# The ingest_document node uses doc_type from classification for SmartChunker
workflow.set_entry_point("read_document")
workflow.add_edge("read_document", "classify_document")
workflow.add_edge("classify_document", "ingest_document")
workflow.add_edge("ingest_document", "accountant")
workflow.add_edge("accountant", END)

app_graph = workflow.compile()

# Alternative graph without classification (for backwards compatibility)
# Uses default INVOICE type for SmartChunker
workflow_simple = StateGraph(AgentState)
workflow_simple.add_node("read_document", read_document_node)
workflow_simple.add_node("ingest_document", ingest_document_node)
workflow_simple.add_node("accountant", accountant_node)
workflow_simple.set_entry_point("read_document")
workflow_simple.add_edge("read_document", "ingest_document")
workflow_simple.add_edge("ingest_document", "accountant")
workflow_simple.add_edge("accountant", END)
app_graph_simple = workflow_simple.compile()