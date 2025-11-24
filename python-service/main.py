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

from datetime import datetime

# --- NEW HELPER FUNCTION ---
def log_step(invoice_id: str, title: str, detail: str, status: str = "processing"):
    """Writes a structured step to Supabase"""
    try:
        new_step = {
            "title": title,
            "detail": detail,
            "status": status,
            "timestamp": datetime.now().isoformat()
        }
        # Fetch current steps to append
        res = supabase.table("jobs").select("steps").eq("invoice_id", invoice_id).execute()
        current_steps = res.data[0].get("steps", []) if res.data else []
        current_steps.append(new_step)

        supabase.table("jobs").update({"steps": current_steps}).eq("invoice_id", invoice_id).execute()
    except Exception as e:
        print(f"Log Error: {e}")

# --- UPDATED LOGIC ---
def run_agent_task(invoice_id: str, amount: float):
    try:
        # 1. Start
        log_step(invoice_id, "Agent Activated", "Initializing Accountant Agent...", "done")
        supabase.table("jobs").update({"status": "processing"}).eq("invoice_id", invoice_id).execute()
        
        # 2. Analysis
        log_step(invoice_id, "Reading Invoice", f"Extracted Amount: €{amount}", "done")
        
        # 3. FETCH DYNAMIC POLICIES (The Upgrade)
        # Note: In production, filter by org_id here. For demo, we take the first active rule.
        log_step(invoice_id, "Policy Engine", "Fetching corporate rules from database...", "processing")
        
        policy_response = supabase.table("org_policies")\
            .select("*")\
            .eq("rule_name", "Max Spend Limit")\
            .execute()
            
        limit = 5000.0 # Default fallback
        if policy_response.data:
            rule = policy_response.data[0]
            limit = float(rule['threshold_amount'])
            log_step(invoice_id, "Policy Engine", f"Applied Rule: {rule['rule_description']} (€{limit})", "done")
        else:
            log_step(invoice_id, "Policy Engine", f"No custom rules found. Using default (€{limit})", "done")

        # 4. Execute Logic
        import time
        time.sleep(1)
        
        if amount > limit:
            status = "NEEDS_APPROVAL"
            log_step(invoice_id, "Risk Analysis", f"Amount €{amount} exceeds limit of €{limit}.", "warning")
            log_step(invoice_id, "Final Decision", "Escalated to CFO for review.", "done")
        else:
            status = "APPROVED"
            log_step(invoice_id, "Compliance Check", "Amount is within budget.", "done")
            log_step(invoice_id, "Final Decision", "Payment scheduled automatically.", "done")

        # Final DB Update
        supabase.table("jobs").update({
            "status": "completed", 
            "result": status
        }).eq("invoice_id", invoice_id).execute()
        
    except Exception as e:
        log_step(invoice_id, "System Error", str(e), "error")
        print(f"Error: {e}")

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

if __name__ == "__main__":
    import uvicorn
    import os
    
    # 1. Get the PORT from Railway (default to 8000 if running locally)
    port = int(os.getenv("PORT", 8000))
    
    # 2. Print it so we can see it in the logs
    print(f"🚀 Starting Brain on 0.0.0.0:{port}")
    
    # 3. Run the server
    uvicorn.run(app, host="0.0.0.0", port=port)
