import os
import sys

# Fix Windows console encoding for emojis
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from supabase.lib.client_options import ClientOptions
from dotenv import load_dotenv
import base64
import json
from agent_graph import app_graph
from privacy_guard import airlock
from datetime import datetime, timedelta
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

load_dotenv()

# Initialize
app = FastAPI(title="CoreMatch Brain", version="1.0.0")

# CORS configuration for Next.js (localhost + production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3000",
        "https://www.corematch.fr",
        "https://corematch.fr",
        "https://*.vercel.app",
        "https://*.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")


if not url or not key:
    print("❌ CRITICAL: Supabase credentials missing in main.py!")

# Use simple client creation to avoid version mismatch issues
supabase: Client = create_client(url, key)

# Request Schema
class JobRequest(BaseModel):
    invoice_id: str
    amount: float

# --- HELPER FUNCTION ---
def log_step(invoice_id: str, title: str, detail: str, status: str = "processing"):
    """
    Writes a structured step to Supabase. 
    SMART LOGIC: If the last step has the same title, update it. Otherwise, append new.
    """
    try:
        new_step = {
            "title": title,
            "detail": detail,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        
        # Fetch current steps
        response = supabase.table("jobs").select("steps").eq("invoice_id", invoice_id).execute()
        
        if response.data:
            current_steps = response.data[0].get("steps", []) or []
            
            # CHECK: Is the last step the same as this one?
            if current_steps and current_steps[-1]['title'] == title:
                # UPDATE the existing step (Turn spinner into checkmark)
                current_steps[-1] = new_step
            else:
                # APPEND a new step
                # FIX: If we are moving to a NEW step, mark the previous one as done
                if current_steps and current_steps[-1]['status'] == 'processing':
                    current_steps[-1]['status'] = 'done'
                    
                current_steps.append(new_step)
            
            supabase.table("jobs").update({
                "steps": current_steps
            }).eq("invoice_id", invoice_id).execute()
            
    except Exception as e:
        print(f"❌ Failed to log step: {e}")

# --- AZURE OCR AGENT TASK ---
def run_agent_task(invoice_id: str, amount: float):
    try:
        # 1. INITIALISATION
        log_step(invoice_id, "Agent Activé", "Démarrage du Brain...", "processing")
        
        # 2. Get File URL
        original_id = invoice_id
        invoice_id = invoice_id.strip()
        
        log_step(original_id, "Debug Fetch", f"Querying: '{invoice_id}'", "processing")

        # Determine if we should query 'id' (UUID) or 'invoice_number' (String)
        import uuid
        is_uuid = False
        try:
            uuid.UUID(invoice_id)
            is_uuid = True
        except ValueError:
            is_uuid = False

        inv_data = None
        if is_uuid:
            # Try finding by ID first
            inv_data = supabase.table("invoices").select("file_url").eq("id", invoice_id).execute()
            
            # If not found by ID, try invoice_number
            if not inv_data.data:
                inv_data = supabase.table("invoices").select("file_url").eq("invoice_number", invoice_id).execute()
        else:
            # Not a UUID, so it must be an invoice_number
            inv_data = supabase.table("invoices").select("file_url").eq("invoice_number", invoice_id).execute()

        if not inv_data.data:
            log_step(invoice_id, "Erreur Fetch", "Invoice not found in database", "error")
            raise Exception("Fichier introuvable")

        if not inv_data.data[0].get('file_url'):
             log_step(invoice_id, "Erreur Fetch", "File URL is missing", "error")
             raise Exception("Fichier introuvable (URL vide)")
             
        file_url = inv_data.data[0]['file_url']
        
        # 3. RUN LANGGRAPH (The new Agent Brain)
        log_step(invoice_id, "Analyse IA", "Exécution du graphe d'agents (OCR + Comptable)...", "processing")
        
        inputs = {
            "invoice_id": invoice_id, 
            "file_url": file_url, 
            "amount_raw": amount,
            "messages": []
        }
        
        # Invoke the graph!
        result = app_graph.invoke(inputs)
        
        # 4. PROCESS RESULTS
        extraction = result.get("extraction_data", {})
        suggestion = result.get("suggested_entry", {})
        status = result.get("verification_status", "NEEDS_APPROVAL")
        messages = result.get("messages", [])
        
        # Log Agent Messages as Steps
        for msg in messages:
            # Simple heuristic to map messages to steps
            title = "Info Brain"
            if "OCR" in msg: title = "Lecture OCR"
            elif "Privacy" in msg: title = "Privacy Airlock"
            elif "Suggestion" in msg: title = "Expert Comptable"
            elif "Amount" in msg: title = "Contrôle"
            
            log_step(invoice_id, title, msg, "done")

        # Extract key fields for the main table
        real_amount = result.get("amount_raw", 0.0)
        
        vendor_name = "Inconnu"
        # Handle the mapped vendor_name from agent_graph
        v_field = extraction.get("vendor_name")
        if v_field:
            # It's a dict {value: ..., box: ...}
            val = v_field.get("value")
            if val: vendor_name = str(val)

        # Inject the AI Suggestion into extraction_data so frontend can see it
        if suggestion:
            extraction["ai_suggestion"] = suggestion

        # UPDATE DATABASE
        supabase.table("invoices").update({
            "total_amount": real_amount,
            "client_name": vendor_name,
            "extraction_data": extraction, # Sanitized & Smart!
            "status": status
        }).eq("id", invoice_id).execute()

        # Final Job Status
        supabase.table("jobs").update({
            "status": "completed", 
            "result": status
        }).eq("invoice_id", invoice_id).execute()
        
        log_step(invoice_id, "Terminé", f"Analyse terminée. Statut: {status}", "done")

    except Exception as e:
        print(f"❌ Error: {e}")
        log_step(invoice_id, "Erreur Critique", str(e), "error")
        supabase.table("jobs").update({"status": "failed"}).eq("invoice_id", invoice_id).execute()

@app.post("/analyze-invoice")
async def analyze_invoice(job: JobRequest, background_tasks: BackgroundTasks):
    """
    Next.js calls this endpoint.
    We return '200 OK' immediately, and the Agent runs in the background.
    """
    # Check if there's already a running job for this invoice
    try:
        existing = supabase.table("jobs").select("id, status").eq("invoice_id", job.invoice_id).execute()

        # If there's already a pending or processing job, don't create a new one
        if existing.data:
            active_jobs = [j for j in existing.data if j['status'] in ('pending', 'processing')]
            if active_jobs:
                return {"message": "Job already in progress", "job_id": job.invoice_id, "skipped": True}

            # Delete old completed/failed jobs for this invoice before creating new one
            supabase.table("jobs").delete().eq("invoice_id", job.invoice_id).execute()

        # Create new job record
        supabase.table("jobs").insert({
            "invoice_id": job.invoice_id,
            "status": "pending",
            "steps": []
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

    # Trigger background task
    background_tasks.add_task(run_agent_task, job.invoice_id, job.amount)
    return {"message": "Agent triggered successfully", "job_id": job.invoice_id}

@app.get("/")
def health_check():
    return {"status": "CoreMatch Brain is operational 🧠", "version": "1.0.0"}

@app.get("/health")
def health():
    """Health check endpoint for monitoring"""
    try:
        # Test Supabase connection
        supabase.table("jobs").select("id").limit(1).execute()
        return {"status": "healthy", "supabase": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

# --- INSIGHTS AGENT ENDPOINTS (Enhanced V2) ---
class InsightsRequest(BaseModel):
    query: str
    org_id: str

class ExportRequest(BaseModel):
    result: dict
    query: str
    org_name: str = "Organization"
    format: str = "pdf"  # or "excel"

@app.post("/insights")
async def get_insights(request: InsightsRequest):
    """
    AI-Powered Business Intelligence Endpoint (Enhanced V2)
    - Multi-data source support (invoices, clients, products, orders)
    - Redis caching
    - Query history tracking
    - Multi-language support (FR/EN)
    """
    try:
        from insights_agent_v2 import insights_agent_enhanced
        
        # Run the enhanced insights agent
        result = insights_agent_enhanced({
            "query": request.query,
            "org_id": request.org_id
        })
        
        if result.get("error"):
            print(f"❌ Agent Error: {result['error']}")
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Convert any pandas Timestamp or datetime objects to ISO strings for JSON serialization
        import pandas as pd
        from datetime import datetime
        def _convert(obj):
            if isinstance(obj, (pd.Timestamp, datetime)):
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: _convert(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [_convert(i) for i in obj]
            return obj
        result = _convert(result)
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"❌ Critical Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"{str(e)}")

@app.get("/insights/suggestions/{org_id}")
async def get_suggestions(org_id: str, language: str = "fr"):
    """
    Get smart question suggestions for an organization.
    Returns AI-generated suggestions and popular queries.
    """
    try:
        from insights_agent_v2 import get_suggestions_for_org
        
        suggestions = get_suggestions_for_org(org_id, language)
        return suggestions
    
    except Exception as e:
        print(f"❌ Suggestions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/insights/export")
async def export_insights(request: ExportRequest):
    """
    Export insights result to PDF or Excel.
    Returns base64-encoded file for download.
    """
    try:
        from insights_export import create_pdf_report, create_excel_report, export_to_base64
        
        if request.format == "pdf":
            file_bytes = create_pdf_report(request.result, request.query, request.org_name)
        elif request.format == "excel":
            file_bytes = create_excel_report(request.result, request.query, request.org_name)
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use 'pdf' or 'excel'")
        
        # Convert to base64 for frontend download
        b64_data = export_to_base64(file_bytes, request.format)
        
        return {
            "data": b64_data,
            "filename": f"insights_report_{request.org_name}.{request.format}",
            "format": request.format
        }
    
    except Exception as e:
        print(f"❌ Export error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- GROWTH AGENT (LeadSniper) ENDPOINTS ---
class GrowthSearchRequest(BaseModel):
    user_business: str
    org_id: str | None = None  # Fetch operating_city from Supabase
    geography: str | None = None  # Manual override: "Lyon, France"
    exclude_domains: list[str] | None = None
    max_results: int = 10
    strict_geo_filter: bool = True  # Enable LLM geo-validation

class LeadInsertRequest(BaseModel):
    org_id: str
    leads: list[dict]

@app.post("/growth/search")
async def growth_search(request: GrowthSearchRequest):
    """
    Smart Growth Agent: Find qualified B2B prospects using Exa.ai semantic search
    with strict geographic restrictions.

    The agent:
    1. Fetches org's operating_city from Supabase (or uses manual geography)
    2. Generates geo-targeted queries (avoiding competitor keywords)
    3. Searches with Exa.ai + site:.fr for French domains
    4. Validates each lead's geographic zone with LLM
    5. Classifies results as prospect/competitor/partner
    6. Returns only in-zone qualified prospects

    Example:
        POST /growth/search
        {
            "user_business": "Rénovation bâtiment",
            "org_id": "uuid-here",
            "geography": "Lyon, France",
            "exclude_domains": ["bouygues.com", "vinci.com"],
            "max_results": 10,
            "strict_geo_filter": true
        }
    """
    try:
        from agents.growth_agent import find_prospects

        result = await find_prospects(
            user_business=request.user_business,
            org_id=request.org_id,
            geography=request.geography,
            exclude_domains=request.exclude_domains,
            max_results=request.max_results,
            strict_geo_filter=request.strict_geo_filter
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Search failed"))

        return result

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Growth agent not available. Make sure exa-py is installed: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/growth/save-leads")
async def save_growth_leads(request: LeadInsertRequest):
    """
    Save prospects found by Growth Agent to the leads table.

    Example:
        POST /growth/save-leads
        {
            "org_id": "uuid-here",
            "leads": [{ ... prospect data ... }]
        }
    """
    try:
        saved_count = 0
        errors = []

        for lead in request.leads:
            try:
                # Prepare lead data for insertion
                lead_data = {
                    "org_id": request.org_id,
                    "company_name": lead.get("company_name", "Unknown"),
                    "website": lead.get("website"),
                    "contact_name": lead.get("contact_name"),
                    "contact_email": lead.get("contact_email"),
                    "status": lead.get("status", "new"),
                    "potential_value": lead.get("potential_value", 0),
                    "probability": lead.get("probability", lead.get("ai_score", 50)),
                    "currency": lead.get("currency", "EUR"),
                    "ai_summary": lead.get("ai_summary"),
                    "ai_next_action": lead.get("ai_next_action"),
                }

                # Insert into leads table
                supabase.table("leads").insert(lead_data).execute()
                saved_count += 1

            except Exception as e:
                errors.append({
                    "company": lead.get("company_name", "Unknown"),
                    "error": str(e)
                })

        return {
            "success": True,
            "saved_count": saved_count,
            "total_submitted": len(request.leads),
            "errors": errors if errors else None
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/growth/status")
async def growth_status():
    """Check if Growth Agent (Exa.ai) is available."""
    try:
        import exa_py
        exa_key = os.getenv("EXA_API_KEY")

        return {
            "available": bool(exa_key),
            "exa_configured": bool(exa_key),
            "message": "Growth Agent ready" if exa_key else "EXA_API_KEY not configured"
        }
    except ImportError:
        return {
            "available": False,
            "exa_configured": False,
            "message": "exa-py not installed. Run: pip install exa-py"
        }


# --- CRM HUNT ENDPOINT (Frontend-Friendly Wrapper) ---
class CRMHuntRequest(BaseModel):
    query: str                          # Target description (what we're hunting for)
    city: str | None = None             # City filter (e.g., "Lyon")
    region: str | None = None           # Region filter (e.g., "Rhône-Alpes")
    geography: str | None = None        # Full geography string (e.g., "Lyon, Rhône-Alpes, France")
    radius: int = 20                    # Search radius in km (0 = city only, up to 100km)
    org_id: str | None = None           # Org ID for Supabase location lookup
    user_id: str | None = None          # User ID for tracking who created the search
    exclude_domains: list[str] | None = None
    max_results: int = 10
    # NEW: Search type and criteria for multi-purpose sourcing
    search_type: str = "clients"        # "clients" | "suppliers" | "partners"
    criteria: str | None = None         # Optional criteria (e.g., "Occasion, Livraison rapide")


@app.post("/crm/hunt")
async def crm_hunt(request: CRMHuntRequest):
    """
    CRM Hunter Mode - Find qualified B2B prospects and save to Supabase.

    This endpoint:
    1. Checks credit balance (returns 402 if insufficient)
    2. Deducts 1 credit from organization
    3. Calls the Growth Agent (LeadSniper) to search via Exa.ai
    4. Saves the search to `lead_searches` table
    5. Saves each prospect to `sourced_leads` table
    6. Returns the search_id so frontend can track/reload results

    Example:
        POST /crm/hunt
        {
            "query": "Hôtels ayant besoin de rénovation",
            "city": "Lyon",
            "region": "Rhône-Alpes",
            "org_id": "uuid-here"
        }

    Returns:
        {
            "success": true,
            "search_id": "uuid",
            "prospects": [...],
            "metadata": { ... },
            "credits_remaining": 49
        }
    """
    try:
        from agents.growth_agent import find_prospects

        # Require org_id for saving
        if not request.org_id:
            raise HTTPException(status_code=400, detail="org_id is required")

        # ============================================================
        # CREDIT CHECK & DEDUCTION
        # ============================================================
        # 1. Fetch current credit balance
        org_result = supabase.table("organizations") \
            .select("credits_balance") \
            .eq("id", request.org_id) \
            .single() \
            .execute()

        if not org_result.data:
            raise HTTPException(status_code=404, detail="Organization not found")

        current_balance = org_result.data.get("credits_balance", 0) or 0
        print(f"[CRM Hunt] Credit balance: {current_balance}")

        # 2. Check if balance is sufficient (cost = 1 credit per search)
        if current_balance < 1:
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "Insufficient credits",
                    "message": "Oups ! Réservoir vide. Vous n'avez plus de crédits.",
                    "credits_required": 1,
                    "credits_balance": current_balance
                }
            )

        # 3. Deduct 1 credit BEFORE the search (fail early if DB error)
        new_balance = current_balance - 1
        supabase.table("organizations") \
            .update({"credits_balance": new_balance}) \
            .eq("id", request.org_id) \
            .execute()
        print(f"[CRM Hunt] Deducted 1 credit. New balance: {new_balance}")

        # Build geography/location string if not provided
        geography = request.geography
        location = None
        if not geography:
            parts = []
            if request.city:
                parts.append(request.city)
            if request.region:
                parts.append(request.region)
            parts.append("France")  # Default country
            geography = ", ".join(parts)
            location = ", ".join(filter(None, [request.city, request.region]))
        else:
            location = geography

        print(f"[CRM Hunt] Query: '{request.query}'")
        print(f"[CRM Hunt] Geography: '{geography}'")
        print(f"[CRM Hunt] Org ID: '{request.org_id}'")
        print(f"[CRM Hunt] Search Type: '{request.search_type}'")
        print(f"[CRM Hunt] Criteria: '{request.criteria}'")

        # Call the LeadSniper agent with DUAL CONTEXT:
        # - target_query: What the user typed in the search (e.g., "Hôtels ayant besoin de rénovation")
        # - user_business_context: Who the user is (from DB, e.g., "Entreprise de rénovation bâtiment")
        # - search_type: "clients" | "suppliers" | "partners"
        # - criteria: Optional refinement criteria
        result = await find_prospects(
            user_business=request.query,  # Legacy param for backwards compat
            org_id=request.org_id,
            geography=geography,
            exclude_domains=request.exclude_domains or [],
            max_results=request.max_results,
            strict_geo_filter=True,
            target_query=request.query,
            user_business_context=None,  # TODO: Add business_description column to organizations table
            search_type=request.search_type,
            criteria=request.criteria,
            radius=request.radius  # Radius in km (0 = city only)
        )

        if not result.get("success"):
            raise HTTPException(status_code=500, detail=result.get("error", "Hunt failed"))

        prospects = result.get("prospects", [])

        # ============================================================
        # SAVE TO SUPABASE
        # ============================================================
        search_id = None

        try:
            # 1. Create lead_searches row
            search_data = {
                "org_id": request.org_id,
                "query_text": request.query,
                "location": location or None,
                "results_count": len(prospects),
            }
            if request.user_id:
                search_data["created_by"] = request.user_id

            search_result = supabase.table("lead_searches").insert(search_data).execute()

            if search_result.data:
                search_id = search_result.data[0]["id"]
                print(f"[CRM Hunt] Created lead_search: {search_id}")

                # 2. Create sourced_leads rows for each prospect
                if prospects and search_id:
                    sourced_leads_data = []
                    for prospect in prospects:
                        sourced_leads_data.append({
                            "search_id": search_id,
                            "org_id": request.org_id,
                            "company_name": prospect.get("company_name") or prospect.get("title") or "Unknown",
                            "url": prospect.get("website") or prospect.get("url"),
                            "exa_summary": prospect.get("ai_summary") or prospect.get("description", "")[:500],
                            "exa_score": prospect.get("ai_score") or prospect.get("probability") or 50,
                        })

                    if sourced_leads_data:
                        supabase.table("sourced_leads").insert(sourced_leads_data).execute()
                        print(f"[CRM Hunt] Saved {len(sourced_leads_data)} sourced_leads")

        except Exception as db_error:
            # Don't fail the whole request if DB save fails
            print(f"[CRM Hunt] Warning: Failed to save to Supabase: {db_error}")
            import traceback
            traceback.print_exc()

        # Build metadata
        metadata = result.get("metadata", {})
        metadata["requested_city"] = request.city
        metadata["requested_region"] = request.region

        return {
            "success": True,
            "search_id": search_id,
            "prospects": prospects,
            "metadata": metadata,
            "credits_remaining": new_balance
        }

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Growth Agent not available. Make sure exa-py is installed: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# --- CRM SOURCING ENDPOINTS (Fetch saved searches/leads) ---

@app.get("/crm/searches/{org_id}")
async def get_lead_searches(org_id: str, limit: int = 50):
    """
    Get all lead searches for an organization.
    Returns list of searches ordered by most recent first.
    """
    try:
        result = supabase.table("lead_searches") \
            .select("*") \
            .eq("org_id", org_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()

        return {
            "success": True,
            "searches": result.data or []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/crm/searches/{org_id}/{search_id}/leads")
async def get_sourced_leads(org_id: str, search_id: str):
    """
    Get all sourced leads for a specific search.
    """
    try:
        result = supabase.table("sourced_leads") \
            .select("*") \
            .eq("search_id", search_id) \
            .eq("org_id", org_id) \
            .order("exa_score", desc=True) \
            .execute()

        return {
            "success": True,
            "leads": result.data or []
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class EnrichConvertRequest(BaseModel):
    offer_type: str = "renovation"  # User's business type for Sherlock


@app.post("/crm/sourced-leads/{lead_id}/enrich-and-convert")
async def enrich_and_convert_sourced_lead(lead_id: str, request: EnrichConvertRequest = None):
    """
    Enrich a sourced lead and convert it to a CRM lead.

    Now with SMART ROUTING:
    - News/Media URL → Sherlock Agent (extracts real company + decision-makers)
    - Corporate URL → Standard Enrichment Agent

    Steps:
    1. Fetch the sourced_lead
    2. Detect URL type (news vs corporate)
    3. Call appropriate agent (Sherlock or Enrichment)
    4. Create a new lead in the CRM with contacts
    5. Update sourced_lead with enrichment data
    """
    try:
        from agents.enrichment_agent import enrich_company_data, is_news_media_url, scrape_website
        from agents.sherlock_agent import sherlock_enrich

        offer_type = request.offer_type if request else "renovation"

        # 1. Fetch the sourced lead
        sourced_result = supabase.table("sourced_leads") \
            .select("*") \
            .eq("id", lead_id) \
            .single() \
            .execute()

        if not sourced_result.data:
            raise HTTPException(status_code=404, detail="Sourced lead not found")

        sourced_lead = sourced_result.data

        # Check if already converted
        if sourced_lead.get("is_converted_to_lead"):
            return {
                "success": True,
                "already_converted": True,
                "lead_id": sourced_lead.get("lead_id"),
                "message": "Lead already converted to CRM"
            }

        url = sourced_lead.get("url")
        if not url:
            raise HTTPException(status_code=400, detail="Sourced lead has no URL")

        print(f"[Enrich&Convert] Enriching: {url}")

        enrichment_data = None
        sherlock_contacts = []
        enrichment_mode = "standard"

        # 2. SMART ROUTING: Detect if this is a news article
        if is_news_media_url(url):
            print(f"[Enrich&Convert] 🕵️ SHERLOCK MODE - News/Media URL detected")
            enrichment_mode = "sherlock"

            # Scrape the article first
            scrape_result = await scrape_website(url)
            if scrape_result.get("success") and scrape_result.get("markdown"):
                article_text = scrape_result["markdown"]

                # Run Sherlock
                sherlock_result = await sherlock_enrich(
                    article_text=article_text,
                    offer_type=offer_type,
                    article_url=url
                )

                if sherlock_result.get("success"):
                    # Build enrichment_data from Sherlock result
                    company_info = sherlock_result.get("company", {})
                    sherlock_contacts = sherlock_result.get("contacts", [])

                    enrichment_data = {
                        "company_name": company_info.get("name"),
                        "short_description": company_info.get("project_type"),
                        "headquarters": company_info.get("location"),
                        "ai_score": 75,  # News = active company
                        "ai_summary": f"🕵️ Sherlock: {company_info.get('project_type', 'Projet identifié')}",
                        "ai_next_action": f"Contacter les {len(sherlock_contacts)} décideurs identifiés",
                        "sherlock_contacts": sherlock_contacts,
                        "target_roles": sherlock_result.get("target_roles", []),
                    }

                    # Add best contact if available
                    if sherlock_contacts:
                        best_contact = sherlock_contacts[0]
                        enrichment_data["suggested_contact"] = {
                            "name": best_contact.get("name"),
                            "role": best_contact.get("role"),
                            "linkedin_url": best_contact.get("linkedin_url"),
                        }

        # 3. Standard enrichment for corporate sites
        if enrichment_mode == "standard" or not enrichment_data:
            print(f"[Enrich&Convert] 📊 STANDARD MODE - Corporate URL")
            enrichment_result = await enrich_company_data(url=url)

            if enrichment_result.success and enrichment_result.company_data:
                enrichment_data = enrichment_result.company_data.model_dump()

        # 4. Create CRM lead
        lead_data = {
            "org_id": sourced_lead["org_id"],
            "company_name": enrichment_data.get("company_name") if enrichment_data else sourced_lead["company_name"],
            "website": url,
            "status": "new",
            "probability": enrichment_data.get("ai_score", 50) if enrichment_data else int(sourced_lead.get("exa_score") or 50),
            "ai_summary": enrichment_data.get("ai_summary") if enrichment_data else sourced_lead.get("exa_summary"),
            "ai_next_action": enrichment_data.get("ai_next_action") if enrichment_data else None,
        }

        # Add contact info if available
        if enrichment_data:
            if enrichment_data.get("suggested_contact"):
                contact = enrichment_data["suggested_contact"]
                lead_data["contact_name"] = contact.get("name")
                lead_data["contact_email"] = contact.get("email") or contact.get("email_pattern")
                lead_data["contact_phone"] = contact.get("phone")
            elif enrichment_data.get("ceo_name"):
                lead_data["contact_name"] = enrichment_data.get("ceo_name")
            if enrichment_data.get("contact_email"):
                lead_data["contact_email"] = enrichment_data.get("contact_email")

        # Extract domain for logo (use company name for news articles)
        if enrichment_mode == "sherlock" and enrichment_data:
            company_name = enrichment_data.get("company_name", "")
            domain_guess = company_name.lower().replace(" ", "").replace("-", "")[:20] + ".fr"
            lead_data["logo_url"] = f"https://logo.clearbit.com/{domain_guess}"
        else:
            domain = url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
            lead_data["logo_url"] = f"https://logo.clearbit.com/{domain}"

        lead_result = supabase.table("leads").insert(lead_data).execute()
        new_lead_id = lead_result.data[0]["id"] if lead_result.data else None

        print(f"[Enrich&Convert] Created lead: {new_lead_id}")

        # 5. Update sourced_lead
        update_data = {
            "is_enriched": True,
            "is_converted_to_lead": True,
            "enriched_at": datetime.now().isoformat(),
            "converted_at": datetime.now().isoformat(),
        }
        if new_lead_id:
            update_data["lead_id"] = new_lead_id
        if enrichment_data:
            update_data["enrichment_data"] = enrichment_data

        supabase.table("sourced_leads") \
            .update(update_data) \
            .eq("id", lead_id) \
            .execute()

        return {
            "success": True,
            "lead_id": new_lead_id,
            "enrichment_mode": enrichment_mode,
            "enrichment_data": enrichment_data,
            "sherlock_contacts": sherlock_contacts if enrichment_mode == "sherlock" else [],
            "message": f"Lead enriched via {enrichment_mode.upper()} and added to CRM"
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- ENRICHMENT AGENT ENDPOINTS ---
class EnrichRequest(BaseModel):
    url: str
    my_business: str | None = None  # For competitor detection


@app.post("/enrich")
async def enrich_lead(request: EnrichRequest):
    """
    Deep Company Enrichment using Firecrawl + OpenAI.

    Scrapes the target URL and extracts structured company data:
    - Company name, description, sector
    - Contact information (CEO, emails, phones)
    - Sales intelligence (buying signals, pain points)
    - Competitor detection (if my_business provided)

    Example:
        POST /enrich
        {
            "url": "marriott.com",
            "my_business": "Renovation batiment"
        }

    Returns:
        {
            "success": true,
            "company_data": { ... structured data ... },
            "source_url": "https://marriott.com"
        }
    """
    try:
        from agents.enrichment_agent import enrich_company_data

        result = await enrich_company_data(
            url=request.url,
            my_business=request.my_business
        )

        if not result.success:
            raise HTTPException(status_code=500, detail=result.error or "Enrichment failed")

        # Convert Pydantic models to dict for JSON response
        response_data = {
            "success": result.success,
            "source_url": result.source_url,
            "error": result.error,
        }

        if result.company_data:
            company_dict = result.company_data.model_dump()
            response_data["company_data"] = company_dict

            # Also flatten key fields to top level for backwards compatibility
            response_data["company_name"] = company_dict.get("company_name")
            response_data["description"] = company_dict.get("short_description")
            response_data["sector"] = company_dict.get("sector")
            response_data["headquarters"] = company_dict.get("headquarters")
            response_data["employee_count"] = company_dict.get("employee_count")
            response_data["ai_summary"] = company_dict.get("ai_summary")
            response_data["ai_score"] = company_dict.get("ai_score")
            response_data["ai_next_action"] = company_dict.get("ai_next_action")
            response_data["relationship_type"] = company_dict.get("relationship_type")
            response_data["relationship_reasoning"] = company_dict.get("relationship_reasoning")
            response_data["buying_signals"] = company_dict.get("buying_signals")
            response_data["pain_points"] = company_dict.get("pain_points")
            response_data["suggested_contact"] = company_dict.get("suggested_contact")

            # Add logo URL
            domain = request.url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
            response_data["logo_url"] = f"https://logo.clearbit.com/{domain}"
            response_data["website"] = f"https://{domain}"

        return response_data

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Enrichment agent not available. Check firecrawl-py is installed: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/enrich/status")
async def enrich_status():
    """Check if Enrichment Agent (Firecrawl) is available."""
    try:
        from firecrawl import FirecrawlApp
        firecrawl_key = os.getenv("FIRECRAWL_API_KEY")

        return {
            "available": bool(firecrawl_key),
            "firecrawl_configured": bool(firecrawl_key),
            "message": "Enrichment Agent ready" if firecrawl_key else "FIRECRAWL_API_KEY not configured"
        }
    except ImportError:
        return {
            "available": False,
            "firecrawl_configured": False,
            "message": "firecrawl-py not installed. Run: pip install firecrawl-py"
        }


# --- CRM DEEP ENRICHMENT ENDPOINT (For Hunter Mode) ---
class CRMDeepEnrichRequest(BaseModel):
    url: str                              # Website URL to enrich
    user_business_context: str            # What the user sells (for scoring)
    candidate_city: str | None = None     # City from Hunter results
    candidate_sector: str | None = None   # Sector from Hunter results


@app.post("/crm/deep-enrich")
async def crm_deep_enrich(request: CRMDeepEnrichRequest):
    """
    Deep Enrichment for Hunter Mode - Triggered when user selects a prospect.

    This endpoint performs deep analysis of a prospect:
    1. Scrapes the website with Firecrawl
    2. Extracts CEO name, contact email, LinkedIn
    3. Calculates a win probability score (0-100)
    4. Generates a strategic summary and next action

    Example:
        POST /crm/deep-enrich
        {
            "url": "https://hotel-royal-lyon.fr",
            "user_business_context": "Rénovation bâtiment Lyon",
            "candidate_city": "Lyon",
            "candidate_sector": "Hospitality"
        }

    Returns:
        {
            "success": true,
            "ceo_name": "Jean Dupont",
            "contact_email": "contact@hotel-royal-lyon.fr",
            "probability_score": 87,
            "ai_summary": "Strategic summary...",
            "ai_next_action": "Email CEO about renovation needs",
            ...
        }
    """
    try:
        from agents.enrichment_agent import deep_enrich_for_hunter

        print(f"[CRM DeepEnrich] URL: {request.url}")
        print(f"[CRM DeepEnrich] Business: {request.user_business_context}")
        print(f"[CRM DeepEnrich] City: {request.candidate_city}")

        result = await deep_enrich_for_hunter(
            url=request.url,
            user_business_context=request.user_business_context,
            candidate_city=request.candidate_city,
            candidate_sector=request.candidate_sector
        )

        # Convert Pydantic model to dict for JSON response
        response_data = result.model_dump()

        # Add logo URL for UI
        domain = request.url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]
        response_data["logo_url"] = f"https://logo.clearbit.com/{domain}"
        response_data["website"] = f"https://{domain}"

        return response_data

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Enrichment agent not available: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/morning-briefing")
async def generate_briefing():
    """
    Aggregates yesterday's agent activity into a structured summary.
    """
    # 1. Define the time window (Last 24 hours)
    yesterday = datetime.now() - timedelta(days=1)
    
    # 2. Query Supabase for recent jobs
    response = supabase.table("jobs")\
        .select("*")\
        .gte("created_at", yesterday.isoformat())\
        .execute()
        
    jobs = response.data or []
    
    # 3. Calculate Stats
    total_processed = len(jobs)
    needs_approval = len([j for j in jobs if j.get('result') == 'NEEDS_APPROVAL'])
    auto_approved = len([j for j in jobs if j.get('result') == 'APPROVED'])
    
    # 4. Identify "Red Flags" (High priority items)
    flagged_items = []
    for job in jobs:
        if job.get('result') == 'NEEDS_APPROVAL':
            # Extract the amount from the steps log if possible, or just use ID
            flagged_items.append({
                "id": job['invoice_id'],
                "reason": "Exceeded spend limit",
                "time": job['created_at']
            })

    # 5. Generate the "Natural Language" Summary
    # (In a real version, OpenAI would write this paragraph)
    summary_text = (
        f"Good morning. In the last 24 hours, I processed {total_processed} invoices. "
        f"{auto_approved} were cleared automatically. "
        f"I need your attention on {needs_approval} items that exceeded company policy."
    )

    return {
        "date": datetime.now().strftime("%B %d, %Y"),
        "summary": summary_text,
        "stats": {
            "total": total_processed,
            "approved": auto_approved,
            "flagged": needs_approval
        },
        "action_items": flagged_items
    }


# --- SHERLOCK OSINT AGENT ENDPOINTS ---
class SherlockRequest(BaseModel):
    article_text: str              # Full article content
    offer_type: str = "renovation" # User's business type (beton, logiciel_btp, etc.)
    article_url: str | None = None # Optional source URL


@app.post("/sherlock/enrich")
async def sherlock_enrich_endpoint(request: SherlockRequest):
    """
    Sherlock OSINT Agent - Intelligent Lead Enrichment from Articles

    This endpoint takes an article about a project (construction, renovation,
    infrastructure, etc.) and returns qualified decision-maker contacts.

    Pipeline:
    1. Extract entities (company, project_type, location, budget, phase)
    2. Infer target roles based on project and offer_type
    3. Build Exa queries for LinkedIn profiles
    4. Score profiles for relevance (anti-homonymy)
    5. Return ranked contacts with scores

    Example:
        POST /sherlock/enrich
        {
            "article_text": "Toulouse Métropole lance un projet de réhabilitation...",
            "offer_type": "beton",
            "article_url": "https://ladepeche.fr/article/..."
        }

    Returns:
        {
            "success": true,
            "company": {
                "name": "Toulouse Métropole Habitat",
                "location": "Toulouse",
                "project_type": "réhabilitation logements sociaux",
                "budget": 12000000
            },
            "contacts": [
                {
                    "name": "Michel Martin",
                    "role": "Directeur du Patrimoine",
                    "score": 0.92,
                    "score_label": "A",
                    "linkedin_url": "https://linkedin.com/in/...",
                    "why_relevant": "..."
                }
            ],
            "target_roles": ["Directeur du patrimoine", "Chargé d'opérations"]
        }
    """
    try:
        from agents.sherlock_agent import sherlock_enrich

        print(f"[Sherlock] Received enrichment request")
        print(f"[Sherlock] Offer type: {request.offer_type}")
        print(f"[Sherlock] Article length: {len(request.article_text)} chars")

        result = await sherlock_enrich(
            article_text=request.article_text,
            offer_type=request.offer_type,
            article_url=request.article_url
        )

        return result

    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Sherlock agent not available: {str(e)}"
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sherlock/status")
async def sherlock_status():
    """Check if Sherlock agent is available."""
    try:
        from agents.sherlock_agent import exa_client
        exa_key = os.getenv("EXA_API_KEY")

        return {
            "available": bool(exa_key),
            "exa_configured": bool(exa_key),
            "message": "Sherlock Agent ready" if exa_key else "EXA_API_KEY not configured"
        }
    except ImportError:
        return {
            "available": False,
            "message": "Sherlock agent module not found"
        }


if __name__ == "__main__":
    import uvicorn
    import os
    
    # 1. Get the PORT from Railway (default to 8000 if running locally)
    port = int(os.getenv("PORT", 8000))
    
    # 2. Print it so we can see it in the logs
    print(f"🚀 Starting Brain on 0.0.0.0:{port}")
    
    # 3. Run the server
    uvicorn.run(app, host="0.0.0.0", port=port)
