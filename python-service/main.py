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
        # 1. INITIALISATION ET LOGS
        # On efface l'historique précédent pour une nouvelle analyse propre
        first_step = [{
            "title": "Agent Activé",
            "detail": "Connexion aux services Azure AI...",
            "status": "done",
            "timestamp": datetime.now().isoformat()
        }]
        
        supabase.table("jobs").update({
            "status": "processing",
            "steps": first_step
        }).eq("invoice_id", invoice_id).execute()

        # 2. CONFIGURATION AZURE (Avec tes noms de variables)
        azure_endpoint = os.getenv("AZURE_DI_ENDPOINT")
        azure_key = os.getenv("AZURE_DI_API_KEY")
        
        if not azure_endpoint or not azure_key:
            log_step(invoice_id, "Erreur Système", "Clés Azure manquantes", "error")
            return

        document_analysis_client = DocumentAnalysisClient(
            endpoint=azure_endpoint, 
            credential=AzureKeyCredential(azure_key)
        )

        # 3. RÉCUPÉRATION DU FICHIER
        log_step(invoice_id, "Lecture Document", "Téléchargement du PDF depuis le Cloud...", "processing")
        
        inv_data = supabase.table("invoices").select("file_url").eq("id", invoice_id).execute()
        if not inv_data.data or not inv_data.data[0]['file_url']:
            raise Exception("Fichier introuvable")
            
        file_url = inv_data.data[0]['file_url']

        # 4. ENVOI À AZURE (OCR INTELLIGENT)
        log_step(invoice_id, "OCR Azure", "Extraction et structuration des données...", "processing")
        
        poller = document_analysis_client.begin_analyze_document_from_url("prebuilt-invoice", file_url)
        result = poller.result()
        
        if not result.documents:
            raise Exception("Document illisible ou vide")
            
        invoice_data = result.documents[0]
        
        # Extraction du Montant Total
        amount_field = invoice_data.fields.get("InvoiceTotal")
        if amount_field and amount_field.value:
            real_amount = float(amount_field.value.amount)
        else:
            real_amount = 0.0
            
        # Extraction du Vendeur (LandingAI, Uber, etc.)
        vendor_field = invoice_data.fields.get("VendorName")
        vendor_name = vendor_field.value if vendor_field else "Fournisseur Inconnu"

        # Mise à jour de l'interface avec les vraies données
        log_step(invoice_id, "Analyse Terminée", f"Fournisseur : {vendor_name} | Montant : {real_amount} €", "done")
        
        # Sauvegarde des données réelles dans la base
        supabase.table("invoices").update({
            "total_amount": real_amount,
            "client_name": vendor_name,
            "status": "PROCESSING"
        }).eq("id", invoice_id).execute()

        # 5. MOTEUR DE RÈGLES (Policy Engine)
        # On utilise le vrai montant extrait par Azure !
        limit = 5000.0
        log_step(invoice_id, "Contrôle de Gestion", f"Vérification plafond ({limit} €)...", "processing")
        
        import time
        time.sleep(1) # Pause pour l'effet visuel
        
        if real_amount > limit:
            status = "NEEDS_APPROVAL"
            log_step(invoice_id, "Alerte Risque", f"Le montant ({real_amount} €) dépasse le seuil autorisé.", "warning")
            log_step(invoice_id, "Décision Finale", "Bloqué pour validation DAF.", "done")
        else:
            status = "APPROVED"
            log_step(invoice_id, "Conformité", "Montant dans le budget.", "done")
            log_step(invoice_id, "Décision Finale", "Validé pour paiement.", "done")

        # Finalisation
        supabase.table("jobs").update({
            "status": "completed", 
            "result": status
        }).eq("invoice_id", invoice_id).execute()
        
        # Mise à jour du statut final de la facture
        supabase.table("invoices").update({"status": status}).eq("id", invoice_id).execute()

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
