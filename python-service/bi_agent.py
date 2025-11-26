import pandas as pd
import json
from typing import List, Dict, Any, Union

class DataAnalystAgent:
    """
    A simple Data Analyst Agent that uses Pandas to generate insights and visualizations
    from raw data based on natural language-like queries (or structured requests).
    """

    def __init__(self):
        pass

    def analyze(self, query: str, data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyzes the provided data based on the query.
        
        Args:
            query: A string describing the analysis (e.g., "spend by vendor", "monthly total").
                   For this MVP, we'll use simple keyword matching.
            data: A list of dictionaries representing the dataset (e.g., invoices).

        Returns:
            A dictionary representing the visualization configuration (Chart.js style or Table).
        """
        if not data:
            return {"type": "error", "message": "No data provided for analysis."}

        df = pd.DataFrame(data)
        
        # Ensure numeric columns are actually numeric
        if 'total_amount' in df.columns:
            df['total_amount'] = pd.to_numeric(df['total_amount'], errors='coerce').fillna(0)
        
        # Ensure date columns are datetime
        if 'invoice_date' in df.columns:
            df['invoice_date'] = pd.to_datetime(df['invoice_date'], errors='coerce')

        query = query.lower()

        # --- SCENARIO 1: SPEND BY VENDOR (Bar Chart) ---
        if "vendor" in query or "supplier" in query:
            if 'vendor_name' not in df.columns or 'total_amount' not in df.columns:
                 return {"type": "error", "message": "Missing required columns: vendor_name, total_amount"}

            # Group by Vendor and Sum Amount
            grouped = df.groupby('vendor_name')['total_amount'].sum().sort_values(ascending=False).head(10)
            
            return {
                "type": "bar",
                "title": "Top Spend by Vendor",
                "labels": grouped.index.tolist(),
                "datasets": [
                    {
                        "label": "Total Spend (€)",
                        "data": grouped.values.tolist(),
                        "backgroundColor": "rgba(0, 180, 216, 0.6)", # Teal
                        "borderColor": "rgba(0, 180, 216, 1)",
                        "borderWidth": 1
                    }
                ]
            }

        # --- SCENARIO 2: SPEND OVER TIME (Line/Bar Chart) ---
        elif "month" in query or "time" in query or "trend" in query:
            if 'invoice_date' not in df.columns or 'total_amount' not in df.columns:
                return {"type": "error", "message": "Missing required columns: invoice_date, total_amount"}

            # Group by Month
            # df['month'] = df['invoice_date'].dt.strftime('%Y-%m')
            # grouped = df.groupby('month')['total_amount'].sum().sort_index()
            
            # Use a safer approach for resampling if index is set, or just string formatting
            df['month_year'] = df['invoice_date'].dt.to_period('M').astype(str)
            grouped = df.groupby('month_year')['total_amount'].sum().sort_index()

            return {
                "type": "line",
                "title": "Monthly Spend Trend",
                "labels": grouped.index.tolist(),
                "datasets": [
                    {
                        "label": "Monthly Total (€)",
                        "data": grouped.values.tolist(),
                        "borderColor": "#4ade80", # Green
                        "backgroundColor": "rgba(74, 222, 128, 0.2)",
                        "fill": True,
                        "tension": 0.4
                    }
                ]
            }

        # --- SCENARIO 3: RAW DATA (Table) ---
        elif "list" in query or "table" in query or "details" in query:
            # Select relevant columns for display
            display_cols = [col for col in ['invoice_id', 'vendor_name', 'invoice_date', 'total_amount', 'status'] if col in df.columns]
            
            # Convert to list of dicts, handling date formatting
            records = df[display_cols].copy()
            if 'invoice_date' in records.columns:
                records['invoice_date'] = records['invoice_date'].dt.strftime('%Y-%m-%d')
            
            return {
                "type": "table",
                "title": "Invoice Details",
                "columns": display_cols,
                "rows": records.to_dict(orient='records')
            }

        # --- DEFAULT: SUMMARY STATS ---
        else:
            total_spend = df['total_amount'].sum()
            invoice_count = len(df)
            avg_spend = df['total_amount'].mean() if invoice_count > 0 else 0

            return {
                "type": "kpi",
                "title": "Key Metrics",
                "data": {
                    "total_spend": f"{total_spend:.2f} €",
                    "invoice_count": invoice_count,
                    "average_invoice": f"{avg_spend:.2f} €"
                }
            }
