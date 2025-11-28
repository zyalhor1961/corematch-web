import os
import json
from datetime import datetime, date
from typing import List, Dict, Any, Optional
from supabase import create_client, Client
import openai
from azure.ai.formrecognizer import AnalyzeResult

class AzureInvoiceProcessor:
    def __init__(self, supabase_url: str, supabase_key: str, openai_api_key: str):
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.openai_client = openai.OpenAI(api_key=openai_api_key)

    def process_and_store(self, invoice_id: str, azure_result: AnalyzeResult):
        """
        Process Azure result, update invoice record, and store RAG chunks.
        """
        print(f"🧠 Smart Chunking for Invoice {invoice_id}...")
        
        if not azure_result.documents:
            print("⚠️ No documents found in Azure result.")
            return

        document = azure_result.documents[0]
        fields = document.fields

        # 1. Extract Top-Level Fields
        vendor_name = fields.get("VendorName").value if fields.get("VendorName") else "Unknown Vendor"
        invoice_date = fields.get("InvoiceDate").value if fields.get("InvoiceDate") else None
        total_amount = fields.get("InvoiceTotal").value.amount if fields.get("InvoiceTotal") and fields.get("InvoiceTotal").value else None
        currency = fields.get("InvoiceTotal").value.symbol if fields.get("InvoiceTotal") and fields.get("InvoiceTotal").value else "EUR"
        
        # Handle Invoice Number - prefer extracted, fallback to existing ID if needed (though usually we want the extracted one)
        invoice_number_extracted = fields.get("InvoiceId").value if fields.get("InvoiceId") else None

        # 2. Update Parent Record in Supabase
        update_data = {
            "vendor_name": str(vendor_name),
            "currency": str(currency),
            # Store the raw JSON result for future re-processing
            "raw_azure_data": self._serialize_azure_result(azure_result)
        }
        
        if invoice_date:
            update_data["invoice_date"] = invoice_date.isoformat()
        if total_amount:
            update_data["total_amount"] = float(total_amount)
        if invoice_number_extracted:
            update_data["invoice_number"] = str(invoice_number_extracted)

        try:
            self.supabase.table("invoices").update(update_data).eq("id", invoice_id).execute()
            print("✅ Invoice parent record updated.")
        except Exception as e:
            print(f"❌ Failed to update invoice record: {e}")

        # 3. Generate Chunks
        chunks = []

        # A. Summary Chunk (Key-Value Pairs)
        kv_text = f"[Vendor: {vendor_name}] DOCUMENT SUMMARY:\n"
        
        # Azure Key-Value pairs are at the top level in AnalyzeResult
        if azure_result.key_value_pairs:
            for kv in azure_result.key_value_pairs:
                if kv.key and kv.value:
                    key_text = kv.key.content
                    val_text = kv.value.content
                    kv_text += f"- {key_text}: {val_text}\n"
        
        chunks.append({
            "invoice_id": invoice_id,
            "content": kv_text,
            "chunk_type": "summary",
            "page_number": 1 # Default to 1 for summary
        })

        # B. Table Chunks
        for table_idx, table in enumerate(azure_result.tables):
            # Construct Markdown Table
            # 1. Identify columns
            # We need to grid this out. Azure gives cells with row_index and column_index.
            rows = table.row_count
            cols = table.column_count
            
            # Initialize grid
            grid = [["" for _ in range(cols)] for _ in range(rows)]
            
            for cell in table.cells:
                grid[cell.row_index][cell.column_index] = cell.content

            # Build Markdown string
            md_table = f"[Vendor: {vendor_name}] TABLE {table_idx + 1}:\n"
            
            # Header
            md_table += "| " + " | ".join(grid[0]) + " |\n"
            md_table += "| " + " | ".join(["---"] * cols) + " |\n"
            
            # Rows
            for r in range(1, rows):
                md_table += "| " + " | ".join(grid[r]) + " |\n"

            chunks.append({
                "invoice_id": invoice_id,
                "content": md_table,
                "chunk_type": "table",
                "page_number": table.bounding_regions[0].page_number if table.bounding_regions else 1
            })

        # 4. Generate Embeddings & Insert
        print(f"🧮 Generating embeddings for {len(chunks)} chunks...")
        for chunk in chunks:
            try:
                # Generate Embedding
                response = self.openai_client.embeddings.create(
                    input=chunk["content"],
                    model="text-embedding-3-small"
                )
                embedding = response.data[0].embedding
                
                # Insert into Supabase
                data_to_insert = {
                    "invoice_id": chunk["invoice_id"],
                    "content": chunk["content"],
                    "chunk_type": chunk["chunk_type"],
                    "page_number": chunk["page_number"],
                    "embedding": embedding
                }
                
                self.supabase.table("invoice_chunks").insert(data_to_insert).execute()
                
            except Exception as e:
                print(f"❌ Failed to process chunk: {e}")

        print("✨ Smart Chunking Complete.")

    def _serialize_azure_result(self, result: AnalyzeResult) -> Dict:
        """Helper to convert Azure result to JSON-serializable dict."""
        def make_serializable(obj):
            if isinstance(obj, (datetime, float, int, str, bool, type(None))):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                return obj
            if hasattr(obj, 'isoformat'): # Handle date objects
                return obj.isoformat()
            if isinstance(obj, dict):
                return {k: make_serializable(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [make_serializable(i) for i in obj]
            return str(obj)

        try:
            # First get the dict representation
            data = result.to_dict()
            # Then ensure everything inside is serializable
            return make_serializable(data)
        except:
            # Fallback if to_dict is not available or fails
            return {"status": "serialization_failed", "content": result.content}
