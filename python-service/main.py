import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
from agent_graph import app_graph

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

# Background Task Runner
def run_agent_task(invoice_id: str, amount: float):
    try:
        # 1. Update DB: Mark as Processing
        supabase.table("jobs").update({"status": "processing"}).eq("invoice_id", invoice_id).execute()
        
        # 2. Run LangGraph
        inputs = {
            "invoice_id": invoice_id, 
            "amount_raw": amount, 
            "verification_status": "pending", 
            "messages": []
        }
        result = app_graph.invoke(inputs)
        
        # 3. Write Final Result to DB (The "Shadow Ledger")
        supabase.table("jobs").update({
            "status": "completed",
            "result": result["verification_status"],
            "logs": result["messages"]
        }).eq("invoice_id", invoice_id).execute()
        
        print(f"✅ Job {invoice_id} completed: {result['verification_status']}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        supabase.table("jobs").update({"status": "failed", "logs": [str(e)]}).eq("invoice_id", invoice_id).execute()

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
