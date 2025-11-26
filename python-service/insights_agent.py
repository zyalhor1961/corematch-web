"""
Insights Agent - AI-Powered Business Intelligence
Generates and executes Pandas code to answer business questions about invoice data.
"""

import pandas as pd
import json
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from supabase import create_client
import os
import re
from io import StringIO
import sys

# Initialize Supabase
supabase = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# Initialize LLM
llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)


def fetch_invoices_data(org_id: str) -> pd.DataFrame:
    """
    Fetch all invoices for an organization from Supabase.
    Returns a Pandas DataFrame ready for analysis.
    """
    try:
        response = supabase.table("invoices").select(
            "id, invoice_number, vendor_name, invoice_date, due_date, "
            "total_amount, currency, status, payment_date, created_at"
        ).eq("organization_id", org_id).execute()
        
        if not response.data:
            return pd.DataFrame()
        
        df = pd.DataFrame(response.data)
        
        # Convert date columns to datetime
        date_columns = ['invoice_date', 'due_date', 'payment_date', 'created_at']
        for col in date_columns:
            if col in df.columns:
                df[col] = pd.to_datetime(df[col], errors='coerce')
        
        # Convert amount to numeric
        if 'total_amount' in df.columns:
            df['total_amount'] = pd.to_numeric(df['total_amount'], errors='coerce')
        
        return df
    
    except Exception as e:
        print(f"Error fetching invoices: {e}")
        return pd.DataFrame()


def generate_pandas_code(query: str, df_columns: List[str]) -> str:
    """
    Use LLM to generate Pandas code that answers the business question.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are a Python Pandas expert. Generate ONLY executable Python code to answer the user's question.

Available DataFrame: `df` with columns: {columns}

RULES:
1. Return ONLY Python code, no explanations
2. Use ONLY these imports: pandas (as pd), numpy (as np)
3. Store the final result in a variable called `result`
4. For aggregations, return a DataFrame or Series
5. Keep code simple and secure - NO file operations, NO system calls
6. For top N queries, use .head(N)
7. For charts, prepare data in a format ready for visualization
8. Always handle missing values appropriately

RESPONSE FORMAT:
- For tables: result should be a DataFrame
- For single values: result should be a dict like {{"value": X, "label": "Description"}}
- For charts: result should be a DataFrame with columns suitable for plotting

Example for "top 5 vendors by total amount":
```python
result = df.groupby('vendor_name')['total_amount'].sum().sort_values(ascending=False).head(5).reset_index()
result.columns = ['vendor', 'total']
```"""),
        ("human", "{query}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({
        "query": query,
        "columns": ", ".join(df_columns)
    })
    
    # Extract code from response
    code = response.content.strip()
    
    # Remove markdown code blocks if present
    code = re.sub(r'```python\n?', '', code)
    code = re.sub(r'```\n?', '', code)
    
    return code.strip()


def execute_pandas_code_safely(code: str, df: pd.DataFrame) -> Any:
    """
    Execute generated Pandas code in a restricted environment.
    Returns the result or raises an exception.
    """
    # Create a restricted namespace
    namespace = {
        'pd': pd,
        'df': df,
        'np': __import__('numpy'),
        'result': None
    }
    
    # Forbidden operations for security
    forbidden_patterns = [
        r'import\s+(?!pandas|numpy)',
        r'__',
        r'eval',
        r'exec',
        r'compile',
        r'open',
        r'file',
        r'input',
        r'raw_input',
        r'subprocess',
        r'os\.',
        r'sys\.',
    ]
    
    for pattern in forbidden_patterns:
        if re.search(pattern, code, re.IGNORECASE):
            raise ValueError(f"Forbidden operation detected: {pattern}")
    
    try:
        # Execute the code
        exec(code, namespace)
        return namespace.get('result')
    except Exception as e:
        raise RuntimeError(f"Code execution failed: {str(e)}")


def determine_visualization_type(result: Any, query: str) -> str:
    """
    Determine the best visualization type based on the result and query.
    """
    query_lower = query.lower()
    
    # Check query keywords
    if any(word in query_lower for word in ['trend', 'over time', 'timeline', 'evolution']):
        return 'line_chart'
    
    if any(word in query_lower for word in ['top', 'bottom', 'ranking', 'comparison']):
        return 'bar_chart'
    
    if any(word in query_lower for word in ['distribution', 'breakdown', 'proportion']):
        return 'pie_chart'
    
    # Check result structure
    if isinstance(result, pd.DataFrame):
        if len(result) > 10:
            return 'table'
        elif len(result.columns) == 2:
            return 'bar_chart'
        else:
            return 'table'
    
    if isinstance(result, dict) and 'value' in result:
        return 'metric'
    
    return 'table'


def format_result_for_frontend(result: Any, viz_type: str) -> Dict[str, Any]:
    """
    Format the Pandas result into a JSON structure for the frontend.
    """
    if isinstance(result, pd.DataFrame):
        # Convert DataFrame to list of dicts
        data = result.to_dict('records')
        
        # For charts, we keep the original data structure
        # The frontend will handle x/y mapping automatically
        if viz_type in ['bar_chart', 'line_chart'] and len(result.columns) == 2:
            pass # Do nothing, keep original data
        
        return {
            'type': viz_type,
            'data': data,
            'columns': list(result.columns) if viz_type == 'table' else None
        }
    
    elif isinstance(result, pd.Series):
        df = result.reset_index()
        return format_result_for_frontend(df, viz_type)
    
    elif isinstance(result, dict):
        return {
            'type': 'metric',
            'data': result
        }
    
    else:
        return {
            'type': 'text',
            'data': {'value': str(result)}
        }


def generate_summary(query: str, result_data: Dict[str, Any]) -> str:
    """
    Generate a natural language summary of the results using LLM.
    """
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a business analyst. Provide a concise 1-2 sentence summary of the data analysis results in French."),
        ("human", "Question: {query}\n\nResults: {results}\n\nProvide a brief summary:")
    ])
    
    chain = prompt | llm
    response = chain.invoke({
        "query": query,
        "results": json.dumps(result_data['data'][:5] if isinstance(result_data['data'], list) else result_data['data'])
    })
    
    return response.content.strip()


def insights_agent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main LangGraph node for the Insights Agent.
    
    Input state:
        - query: str (business question)
        - org_id: str (organization ID)
    
    Output state:
        - result: Dict with type, data, summary
        - error: str (if any)
    """
    query = state.get("query", "")
    org_id = state.get("org_id", "")
    
    if not query or not org_id:
        return {
            **state,
            "error": "Missing query or org_id",
            "result": None
        }
    
    try:
        # Step 1: Fetch data
        print(f"📊 Fetching invoices for org: {org_id}")
        df = fetch_invoices_data(org_id)
        
        if df.empty:
            return {
                **state,
                "result": {
                    "type": "text",
                    "data": {"value": "Aucune donnée disponible"},
                    "summary": "Aucune facture trouvée pour cette organisation."
                }
            }
        
        print(f"✅ Loaded {len(df)} invoices")
        
        # Step 2: Generate Pandas code
        print(f"🤖 Generating Pandas code for: {query}")
        code = generate_pandas_code(query, df.columns.tolist())
        print(f"📝 Generated code:\n{code}")
        
        # Step 3: Execute code safely
        print("⚙️ Executing code...")
        result = execute_pandas_code_safely(code, df)
        print(f"✅ Execution successful")
        
        # Step 4: Determine visualization type
        viz_type = determine_visualization_type(result, query)
        print(f"📈 Visualization type: {viz_type}")
        
        # Step 5: Format for frontend
        formatted_result = format_result_for_frontend(result, viz_type)
        
        # Step 6: Generate summary
        print("💬 Generating summary...")
        summary = generate_summary(query, formatted_result)
        formatted_result['summary'] = summary
        
        print(f"✅ Insights generated successfully")
        
        return {
            **state,
            "result": formatted_result,
            "generated_code": code,
            "error": None
        }
    
    except Exception as e:
        print(f"❌ Error in insights agent: {str(e)}")
        return {
            **state,
            "error": str(e),
            "result": {
                "type": "text",
                "data": {"value": f"Erreur: {str(e)}"},
                "summary": "Une erreur s'est produite lors de l'analyse."
            }
        }


# For standalone testing
if __name__ == "__main__":
    # Test the agent
    test_state = {
        "query": "Top 5 fournisseurs par montant total",
        "org_id": "test-org-id"
    }
    
    result = insights_agent_node(test_state)
    print("\n" + "="*50)
    print("RESULT:")
    print(json.dumps(result.get('result'), indent=2, default=str))
