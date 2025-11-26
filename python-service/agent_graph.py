from typing import TypedDict, Annotated, Any, Dict, Optional
from decimal import Decimal
from langgraph.graph import StateGraph, END
import json
import os
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential
from privacy_guard import PrivacyAirlock

# Initialize Privacy Airlock
privacy_guard = PrivacyAirlock()

def get_client_rules(org_id: str) -> str:
    """
    Placeholder: Connects to Supabase to fetch active rules for the accountant agent.
    """
    # TODO: Fetch from 'org_policies' table where org_id = org_id AND active = true
    # For now, return a static rule to demonstrate the concept.
    return "POLICY: Flag any invoice > 5000 EUR. POLICY: Reject expenses for 'Alcohol'."

def recursive_redact(data: Any) -> Any:
    """
    Recursively redact PII from a dictionary or list.
    """
    if isinstance(data, str):
        return privacy_guard.redact_pii(data)
    if isinstance(data, list):
        return [recursive_redact(item) for item in data]
    if isinstance(data, dict):
        return {k: recursive_redact(v) for k, v in data.items()}
    return data

# 1. Define the State (The "Memory" of the request)
class AgentState(TypedDict):
    invoice_id: str
    file_url: str 
    amount_raw: float
    verification_status: str
    messages: list[str]
    extraction_data: Dict[str, Any]
    suggested_entry: Optional[Dict[str, Any]] # New field for AI suggestion

def force_serialize(obj: Any) -> Any:
    """
    Nuclear option: Forces the object to be JSON serializable by converting
    anything unknown to a string.
    """
    try:
        return json.loads(json.dumps(obj, default=str))
    except Exception as e:
        print(f"Force Serialize Error: {e}")
        return str(obj)

def to_serializable(obj: Any) -> Any:
    """
    Recursively converts complex Azure AI objects into standard Python types.
    """
    if obj is None:
        return None
    
    # 1. Primitives are safe
    if isinstance(obj, (str, int, float, bool)):
        return obj

    # 2. Handle Azure CurrencyValue (Duck Typing)
    # Return a dict to preserve both amount and currency symbol
    if hasattr(obj, 'amount') and hasattr(obj, 'symbol'):
        try:
            return {
                "amount": float(obj.amount),
                "symbol": str(obj.symbol) if obj.symbol else None,
                "code": getattr(obj, 'code', None)
            }
        except:
            return str(obj)

    # 3. Handle Azure DateValue 
    if hasattr(obj, 'isoformat'):
        return obj.isoformat()

    # 4. Handle Azure DocumentField (wrapper)
    if hasattr(obj, 'value') and not isinstance(obj, dict):
        return to_serializable(obj.value)
    
    # 5. Handle Lists
    if isinstance(obj, list):
        return [to_serializable(item) for item in obj]
    
    # 6. Handle Dictionaries
    if isinstance(obj, dict) or hasattr(obj, 'items'):
        try:
            return {k: to_serializable(v) for k, v in dict(obj).items()}
        except:
            pass
            
    # 7. Fallback: Convert to string
    return str(obj)

# 2. Define Nodes

def read_document_node(state: AgentState):
    print(f"🔍 Reading Document {state['invoice_id']}...")
    messages = state.get('messages', [])
    
    try:
        endpoint = os.getenv("AZURE_FORM_ENDPOINT")
        key = os.getenv("AZURE_FORM_KEY")
        
        if not endpoint or not key:
            messages.append("⚠️ Azure keys missing. Using simulation mode.")
            return {
                "amount_raw": 0.0, 
                "messages": messages,
                "extraction_data": {}
            }

        document_analysis_client = DocumentAnalysisClient(
            endpoint=endpoint, 
            credential=AzureKeyCredential(key)
        )
        
        file_url = state.get("file_url")
        if not file_url:
             messages.append("❌ No file URL provided.")
             return {"messages": messages}

        poller = document_analysis_client.begin_analyze_document_from_url("prebuilt-invoice", file_url)
        result = poller.result()
        
        if not result.documents:
             messages.append("❌ No document content found.")
             return {"messages": messages}
             
        invoice = result.documents[0]
        
        # Helper to extract value and box
        def extract_with_box(field):
            if not field:
                return None
            val = to_serializable(field.value)
            box = []
            page_number = 1
            if field.bounding_regions:
                # Flatten the polygon points: [x1, y1, x2, y2, ...]
                for point in field.bounding_regions[0].polygon:
                    box.extend([point.x, point.y])
                page_number = field.bounding_regions[0].page_number
            return {"value": val, "box": box, "page": page_number}

        # Explicitly extract key fields with boxes
        clean_fields = {}
        for key, field in invoice.fields.items():
            clean_fields[key] = extract_with_box(field)

        # Extract Page Metadata (Dimensions) for scaling
        pages_metadata = []
        if result.pages:
            for page in result.pages:
                pages_metadata.append({
                    "page_number": page.page_number,
                    "width": page.width,
                    "height": page.height,
                    "unit": str(page.unit) # Explicitly convert Enum to string
                })
        
        # Add metadata to clean_fields so it's passed to frontend
        clean_fields["_metadata"] = {"pages": pages_metadata}

        # --- SMART EXTRACTION (User Logic) ---
        # Extract financial breakdown directly from Azure fields
        def get_amount(field_name):
            f = invoice.fields.get(field_name)
            if f:
                if hasattr(f.value, 'amount'): return float(f.value.amount)
                if isinstance(f.value, (int, float)): return float(f.value)
            return 0.0

        total_ttc = get_amount("InvoiceTotal")
        total_tax = get_amount("TotalTax")
        total_ht = get_amount("SubTotal")

        # Fallback: If Azure missed SubTotal, ONLY THEN do we calculate it
        if total_ht == 0.0 and total_ttc > 0:
            if total_tax > 0:
                total_ht = total_ttc - total_tax
            else:
                # Default assumption if really nothing is found
                total_ht = total_ttc 

        # --- FRONTEND MAPPING (Preserve Boxes) ---
        # Map Azure keys to Frontend keys, preserving the box if available
        
        # 1. Total Amount
        if "InvoiceTotal" in clean_fields and clean_fields["InvoiceTotal"]:
            clean_fields["total_amount"] = clean_fields["InvoiceTotal"]
            # Ensure value is the smart extracted float
            clean_fields["total_amount"]["value"] = total_ttc
        else:
            clean_fields["total_amount"] = {"value": total_ttc, "box": [], "page": 1}

        # 2. Vendor Name
        if "VendorName" in clean_fields and clean_fields["VendorName"]:
            clean_fields["vendor_name"] = clean_fields["VendorName"]
        else:
            clean_fields["vendor_name"] = {"value": "Unknown", "box": [], "page": 1}

        # 3. Invoice Date
        if "InvoiceDate" in clean_fields and clean_fields["InvoiceDate"]:
            clean_fields["invoice_date"] = clean_fields["InvoiceDate"]
        else:
            clean_fields["invoice_date"] = {"value": None, "box": [], "page": 1}
            
        # 4. Invoice ID
        if "InvoiceId" in clean_fields and clean_fields["InvoiceId"]:
            clean_fields["invoice_id"] = clean_fields["InvoiceId"]
        else:
            clean_fields["invoice_id"] = {"value": "Unknown", "box": [], "page": 1}

        # Add Tax and Net for Accountant (no box needed usually, but good to have)
        clean_fields["tax_amount"] = total_tax
        clean_fields["net_amount"] = total_ht
        
        messages.append(f"✅ Financials Extracted: TTC {total_ttc} | HT {total_ht} | Tax {total_tax}")
        # -------------------------------------

        # --- PRIVACY AIRLOCK ---
        # Redact PII from the extracted data before it enters the system state
        # Note: We only redact the 'value', not the 'box'
        def recursive_redact_with_box(data: Any) -> Any:
            if isinstance(data, dict):
                # Don't redact metadata or smart fields
                if "_metadata" in data and data is clean_fields: pass
                if "total_amount" in data and data is clean_fields: pass
                
                if "value" in data:
                    data["value"] = recursive_redact(data["value"])
                    return data
            return recursive_redact(data)

        # Apply redaction but preserve metadata structure
        sanitized_fields = {}
        for k, v in clean_fields.items():
            if k in ["_metadata", "total_amount", "tax_amount", "net_amount", "vendor_name", "invoice_date", "invoice_id"]:
                sanitized_fields[k] = v
            else:
                sanitized_fields[k] = recursive_redact_with_box(v)
        
        clean_fields = sanitized_fields
        messages.append("🛡️ Privacy Airlock: PII Redacted from extraction data.")
        # -----------------------
        
        # NUCLEAR SAFETY NET: Force serialization of the ENTIRE return object
        # This guarantees that LangGraph will never receive a non-serializable object
        result_state = {
            "extraction_data": clean_fields,
            "amount_raw": float(total_ttc),
            "messages": messages
        }
        
        return force_serialize(result_state)

    except Exception as e:
        print(f"OCR Error: {e}")
        messages.append(f"❌ OCR Error: {str(e)}")
        return {"messages": messages}

def accountant_node(state: AgentState):
    print(f"🤖 Accountant analyzing Invoice #{state['invoice_id']}...")
    messages = state.get('messages', [])
    
    # 1. Get the Financials from Smart Extraction
    extraction = state.get('extraction_data', {})
    
    # Helper to safely get Decimal from potential dict or value
    def get_decimal_value(key, default=0.0):
        val = extraction.get(key, default)
        if isinstance(val, dict):
            val = val.get("value", default)
        try:
            return Decimal(str(val))
        except:
            return Decimal(str(default))

    # Trust Azure's extraction
    total_ttc = get_decimal_value("total_amount")
    amount_ht = get_decimal_value("net_amount")
    amount_tax = get_decimal_value("tax_amount")
    
    # 2. Prepare Data for LLM
    vendor_name = "Inconnu"
    if extraction.get('VendorName'):
        vendor_name = extraction['VendorName'].get('value', 'Inconnu')
        
    # Currency
    currency = "EUR"
    if extraction.get('InvoiceTotal'):
        val = extraction['InvoiceTotal'].get('value')
        if isinstance(val, dict) and val.get('symbol'):
            currency = val.get('symbol') # e.g. '$' or '€'

    # Description from Items
    description = f"Facture de {vendor_name}"
    items_list = []
    if extraction.get('Items'):
        items_val = extraction['Items'].get('value', [])
        if isinstance(items_val, list):
            for item in items_val:
                # item is a dict with 'value' which is a dict of fields
                if isinstance(item, dict) and 'value' in item:
                    fields = item['value']
                    if 'Description' in fields:
                        desc_val = fields['Description'].get('value')
                        if desc_val:
                            items_list.append(str(desc_val))
    
    if items_list:
        description = ", ".join(items_list[:3]) # Take first 3 items
        if len(items_list) > 3:
            description += "..."
    
    # 3. Call LLM for Accounting Suggestion
    try:
        from langchain_openai import ChatOpenAI
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.output_parsers import JsonOutputParser

        llm = ChatOpenAI(model="gpt-4o", temperature=0)
        
        parser = JsonOutputParser()
        
        system_prompt = """Tu es un Expert Comptable français expérimenté.
        Ta mission est d'analyser les données d'une facture et de proposer la meilleure imputation comptable selon le Plan Comptable Général (PCG).
        
        Règles :
        1. Analyse le fournisseur, le montant, la devise et la description.
        2. Choisis le compte de charge (Classe 6) le plus pertinent.
        3. Choisis le compte de TVA déductible (445660) SI applicable.
        4. Propose un libellé d'écriture clair.
        5. Estime le taux de TVA (0% si étranger ou franchise).
        
        Retourne UNIQUEMENT un JSON valide avec ces clés :
        {{
            "charge_account": "6xxxx",
            "vat_account": "445660",
            "label": "Libellé de l'écriture",
            "tax_rate": 0.00
        }}
        """
        
        human_prompt = f"""
        Fournisseur : {vendor_name}
        Montant TTC : {total_ttc} {currency}
        Montant HT : {amount_ht} {currency}
        Montant TVA : {amount_tax} {currency}
        Description / Lignes : {description}
        Contexte : Facture reçue ce jour.
        """
        
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            ("human", human_prompt)
        ])
        
        chain = prompt | llm | parser
        suggestion = chain.invoke({})
        
        # Use the EXTRACTED amounts as the source of truth
        suggestion['amount_ht'] = float(amount_ht)
        suggestion['amount_tax'] = float(amount_tax)
        suggestion['amount_ttc'] = float(total_ttc)
        suggestion['currency'] = currency
        
        # Calculate implied rate for display
        if amount_ht > 0:
            implied_rate = amount_tax / amount_ht
            suggestion['tax_rate'] = float(implied_rate.quantize(Decimal("0.01")))
        else:
            suggestion['tax_rate'] = 0.0
        
        messages.append(f"✨ AI Suggestion: {suggestion['charge_account']} ({suggestion['label']}) - Using Extracted Financials")
        
    except Exception as e:
        print(f"LLM Error: {e}")
        messages.append(f"⚠️ AI Accounting failed: {e}")
        # Fallback
        suggestion = {
            "charge_account": "471000", # Compte d'attente
            "vat_account": "445660",
            "label": f"Facture {vendor_name}",
            "amount_ht": float(amount_ht),
            "amount_tax": float(amount_tax),
            "amount_ttc": float(total_ttc),
            "currency": currency
        }

    # 4. Policy Check (on Total TTC)
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
        "suggested_entry": suggestion
    }

# 3. Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("read_document", read_document_node)
workflow.add_node("accountant", accountant_node)

workflow.set_entry_point("read_document")

workflow.add_edge("read_document", "accountant")
workflow.add_edge("accountant", END)

app_graph = workflow.compile()