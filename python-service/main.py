import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from agent_graph import app_graph
from privacy_guard import airlock
from datetime import datetime, timedelta
from azure.ai.formrecognizer import DocumentAnalysisClient
from azure.core.credentials import AzureKeyCredential

load_dotenv()

# Initialize
app = FastAPI(title="CoreMatch Brain", version="1.0.0")

# CORS configuration for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_KEY")
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
        inv_data = supabase.table("invoices").select("file_url").eq("id", invoice_id).execute()
        if not inv_data.data or not inv_data.data[0]['file_url']:
            raise Exception("Fichier introuvable")
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
    # Create initial job record
    try:
        supabase.table("jobs").insert({
            "invoice_id": job.invoice_id,
            "status": "pending"
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

if __name__ == "__main__":
    import uvicorn
    import os
    
    # 1. Get the PORT from Railway (default to 8000 if running locally)
    port = int(os.getenv("PORT", 8000))
    
    # 2. Print it so we can see it in the logs
    print(f"🚀 Starting Brain on 0.0.0.0:{port}")
    
    # 3. Run the server
    uvicorn.run(app, host="0.0.0.0", port=port)
