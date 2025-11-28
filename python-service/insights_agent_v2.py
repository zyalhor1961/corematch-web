"""
Enhanced Insights Agent - Version 2.0
Multi-data sources, Redis cache, query history, smart suggestions, multi-language
"""

import pandas as pd
import json
from typing import Dict, Any, List, Optional, Tuple
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from supabase import create_client
import os
import re
from datetime import datetime, timedelta
import hashlib
import redis
from utils.prompt_loader import load_prompt

# Initialize clients
supabase = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)

# Redis cache (optional - graceful fallback if not available)
try:
    redis_client = redis.Redis(
        host=os.getenv("REDIS_HOST", "localhost"),
        port=int(os.getenv("REDIS_PORT", 6379)),
        db=0,
        decode_responses=True
    )
    redis_client.ping()
    REDIS_AVAILABLE = True
    print("✅ Redis cache connected")
except:
    REDIS_AVAILABLE = False
    print("⚠️  Redis not available - caching disabled")


# ===== DATA FETCHING =====

def fetch_all_data(org_id: str) -> Dict[str, pd.DataFrame]:
    """
    Fetch ALL available data types for an organization.
    Returns a dict of DataFrames: {'invoices': df, 'clients': df, 'products': df, 'orders': df}
    """
    data = {}
    
    # 1. Invoices
    try:
        inv_response = supabase.table("invoices").select(
            "id, invoice_number, client_name, date_issued, "
            "total_amount, status, created_at"
        ).eq("org_id", org_id).execute()
        
        if inv_response.data:
            df = pd.DataFrame(inv_response.data)
            # Convert dates
            for col in ['date_issued', 'created_at']:
                if col in df.columns:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
            if 'total_amount' in df.columns:
                df['total_amount'] = pd.to_numeric(df['total_amount'], errors='coerce')
            data['invoices'] = df
            print(f"📊 Loaded {len(df)} invoices")
    except Exception as e:
        print(f"⚠️  Could not load invoices: {e}")
    
    # 2. Clients (if table exists)
    try:
        client_response = supabase.table("clients").select("*").eq("org_id", org_id).execute()
        if client_response.data:
            data['clients'] = pd.DataFrame(client_response.data)
            print(f"👥 Loaded {len(data['clients'])} clients")
    except:
        pass
    
    # 3. Products (if table exists)
    try:
        product_response = supabase.table("products").select("*").eq("org_id", org_id).execute()
        if product_response.data:
            data['products'] = pd.DataFrame(product_response.data)
            print(f"📦 Loaded {len(data['products'])} products")
    except:
        pass
    
    # 4. Orders/Quotes (if table exists)
    try:
        order_response = supabase.table("quotes").select("*").eq("org_id", org_id).execute()
        if order_response.data:
            data['orders'] = pd.DataFrame(order_response.data)
            print(f"📋 Loaded {len(data['orders'])} orders")
    except:
        pass
    
    return data


# ===== LANGUAGE DETECTION =====

def detect_language(query: str) -> str:
    """Detect if query is in French or English"""
    french_keywords = ['quoi', 'quel', 'combien', 'montant', 'fournisseur', 'facture', 'client']
    english_keywords = ['what', 'which', 'how', 'amount', 'vendor', 'invoice', 'customer']
    
    query_lower = query.lower()
    french_count = sum(1 for kw in french_keywords if kw in query_lower)
    english_count = sum(1 for kw in english_keywords if kw in query_lower)
    
    return 'fr' if french_count > english_count else 'en'


# ===== REDIS CACHE =====

def generate_cache_key(query: str, org_id: str) -> str:
    """Generate a unique cache key for a query"""
    content = f"{org_id}:{query}".encode('utf-8')
    return f"insights:{hashlib.md5(content).hexdigest()}"


def get_cached_result(query: str, org_id: str) -> Optional[Dict]:
    """Try to get result from cache"""
    if not REDIS_AVAILABLE:
        return None
    
    try:
        key = generate_cache_key(query, org_id)
        cached = redis_client.get(key)
        if cached:
            print("💾 Cache HIT")
            return json.loads(cached)
    except Exception as e:
        print(f"Cache read error: {e}")
    return None


def cache_result(query: str, org_id: str, result: Dict, ttl: int = 3600):
    """Store result in cache with TTL (default 1 hour)"""
    if not REDIS_AVAILABLE:
        return
    
    try:
        key = generate_cache_key(query, org_id)
        redis_client.setex(key, ttl, json.dumps(result, default=str))
        print("💾 Result cached")
    except Exception as e:
        print(f"Cache write error: {e}")


# ===== QUERY HISTORY =====

def save_query_history(org_id: str, query: str, result_type: str, execution_time: float, language: str):
    """Save query to history for analytics"""
    try:
        supabase.table("insights_queries").insert({
            "organization_id": org_id,
            "query": query,
            "result_type": result_type,
            "execution_time_ms": int(execution_time * 1000),
            "language": language,
            "created_at": datetime.now().isoformat()
        }).execute()
    except Exception as e:
        print(f"Failed to save query history: {e}")


def get_popular_queries(org_id: str, limit: int = 10) -> List[Dict]:
    """Get most popular queries for this organization"""
    try:
        response = supabase.table("insights_queries")\
            .select("query, COUNT(*) as count")\
            .eq("organization_id", org_id)\
            .group_by("query")\
            .order("count", desc=True)\
            .limit(limit)\
            .execute()
        return response.data or []
    except:
        return []


# ===== SMART SUGGESTIONS =====

def generate_smart_suggestions(data_context: Dict[str, pd.DataFrame], language: str = 'fr') -> List[str]:
    """
    Generate intelligent question suggestions based on available data.
    Uses LLM to create contextual, relevant questions.
    """
    # Build data summary
    data_summary = []
    for table_name, df in data_context.items():
        if not df.empty:
            data_summary.append(f"{table_name}: {len(df)} rows, columns: {', '.join(df.columns[:10])}")

    if not data_summary:
        return []

    # Load prompts from YAML
    prompts = load_prompt("insights_suggestions", {
        "data_summary": "\n".join(data_summary),
        "language": "French" if language == 'fr' else "English"
    })

    prompt_template = ChatPromptTemplate.from_messages([
        ("system", prompts["system"]),
        ("human", prompts["user"])
    ])

    try:
        chain = prompt_template | llm
        response = chain.invoke({})
        
        # Parse JSON response with regex to handle markdown blocks
        content = response.content.strip()
        # Extract JSON array if embedded in text
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
            
        suggestions = json.loads(content)
        return suggestions[:5]
    except Exception as e:
        print(f"Failed to generate suggestions: {e}. Content was: {response.content if 'response' in locals() else 'N/A'}")
        # Fallback suggestions
        if language == 'fr':
            return [
                "Top 5 fournisseurs par montant total",
                "Évolution des dépenses par mois",
                "Factures en attente d'approbation",
                "Montant moyen par fournisseur",
                "Distribution des statuts de factures"
            ]
        else:
            return [
                "Top 5 vendors by total amount",
                "Monthly spending trend",
                "Pending invoices",
                "Average amount per vendor",
                "Invoice status distribution"
            ]


# ===== ENHANCED CODE GENERATION =====

# ===== SCHEMA DEFINITION =====

DB_SCHEMA = {
    "invoices": [
        "id", "invoice_number", "client_name", "date_issued", "due_date", 
        "total_amount", "status", "created_at"
    ],
    "clients": [
        "id", "name", "email", "company_name", "phone", "address", "city", "country"
    ],
    "products": [
        "id", "name", "description", "unit_price", "sku", "category"
    ],
    "orders": [
        "id", "quote_number", "client_name", "total_amount", "status", "date_issued", "valid_until"
    ]
}

def generate_pandas_code_multi_table(query: str, data_context: Dict[str, pd.DataFrame], language: str) -> str:
    """
    Enhanced code generation that handles multiple tables and JOINs.
    """
    # Build context about available tables
    tables_info = []
    for table_name, df in data_context.items():
        # Use schema definition if available, otherwise fallback to actual columns
        columns = DB_SCHEMA.get(table_name, df.columns.tolist())
        tables_info.append(f"- `{table_name}`: {', '.join(columns)}")

    lang_instruction = "French" if language == 'fr' else "English"

    # Load prompts from YAML
    prompts = load_prompt("insights_pandas_multi", {
        "tables_info": chr(10).join(tables_info),
        "language": lang_instruction,
        "query": query
    })

    prompt = ChatPromptTemplate.from_messages([
        ("system", prompts["system"]),
        ("human", prompts["user"])
    ])

    chain = prompt | llm
    response = chain.invoke({})
    
    # Extract code
    code = response.content.strip()
    code = re.sub(r'```python\n?', '', code)
    code = re.sub(r'```\n?', '', code)
    
    return code.strip()


def execute_pandas_code_multi_table(code: str, data_context: Dict[str, pd.DataFrame]) -> Any:
    """
    Execute generated Pandas code with multiple DataFrames available.
    """
    # Create namespace with all tables
    namespace = {
        'pd': pd,
        'np': __import__('numpy'),
        'result': None
    }
    
    # Add all DataFrames to namespace
    for table_name, df in data_context.items():
        namespace[table_name] = df
    
    # Security check
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
        exec(code, namespace)
        return namespace.get('result')
    except Exception as e:
        raise RuntimeError(f"Code execution failed: {str(e)}")


# ===== MAIN ENHANCED AGENT NODE =====

def insights_agent_enhanced(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enhanced Insights Agent with all new features.
    """
    query = state.get("query", "")
    org_id = state.get("org_id", "")
    
    if not query or not org_id:
        return {
            **state,
            "error": "Missing query or org_id",
            "result": None
        }
    
    start_time = datetime.now()
    
    try:
        # 1. Detect language
        language = detect_language(query)
        print(f"🌐 Detected language: {language}")
        
        # 2. Check cache
        cached = get_cached_result(query, org_id)
        if cached:
            return {
                **state,
                "result": cached,
                "from_cache": True,
                "error": None
            }
        
        # 3. Fetch all data
        print(f"📊 Fetching data for org: {org_id}")
        data_context = fetch_all_data(org_id)
        
        if not data_context:
            return {
                **state,
                "result": {
                    "type": "text",
                    "data": {"value": "No data available" if language == 'en' else "Aucune donnée disponible"},
                    "summary": "No data found for this organization." if language == 'en' else "Aucune donnée trouvée pour cette organisation."
                }
            }
        
        # 4. Generate code
        print(f"🤖 Generating Pandas code for: {query}")
        code = generate_pandas_code_multi_table(query, data_context, language)
        print(f"📝 Generated code:\n{code}")
        
        # 5. Execute code
        print("⚙️ Executing code...")
        result = execute_pandas_code_multi_table(code, data_context)
        print(f"✅ Execution successful")
        
        # 6. Determine visualization type
        from insights_agent import determine_visualization_type, format_result_for_frontend
        viz_type = determine_visualization_type(result, query)
        print(f"📈 Visualization type: {viz_type}")
        
        # 7. Format for frontend
        formatted_result = format_result_for_frontend(result, viz_type)
        
        # 8. Generate summary in detected language
        print("💬 Generating summary...")
        results_json = json.dumps(
            formatted_result['data'][:5] if isinstance(formatted_result['data'], list) else formatted_result['data']
        )

        # Load prompts from YAML
        summary_prompts = load_prompt("insights_summary", {
            "language": "French" if language == 'fr' else "English",
            "query": query,
            "results": results_json
        })

        summary_prompt = ChatPromptTemplate.from_messages([
            ("system", summary_prompts["system"]),
            ("human", summary_prompts["user"])
        ])

        chain = summary_prompt | llm
        summary_response = chain.invoke({})
        
        formatted_result['summary'] = summary_response.content.strip()
        formatted_result['language'] = language
        
        # 9. Cache result
        cache_result(query, org_id, formatted_result)
        
        # 10. Save to history
        execution_time = (datetime.now() - start_time).total_seconds()
        save_query_history(org_id, query, viz_type, execution_time, language)
        
        print(f"✅ Insights generated successfully in {execution_time:.2f}s")
        
        return {
            **state,
            "result": formatted_result,
            "generated_code": code,
            "from_cache": False,
            "execution_time": execution_time,
            "error": None
        }
    
    except Exception as e:
        print(f"❌ Error in insights agent: {str(e)}")
        return {
            **state,
            "error": str(e),
            "result": {
                "type": "text",
                "data": {"value": f"Error: {str(e)}"},
                "summary": "An error occurred during analysis." if language == 'en' else "Une erreur s'est produite lors de l'analyse."
            }
        }


# ===== SUGGESTIONS ENDPOINT =====

def get_suggestions_for_org(org_id: str, language: str = 'fr') -> Dict[str, Any]:
    """
    Get smart suggestions for an organization.
    Returns both AI-generated and popular queries.
    """
    # Fetch data to understand context
    data_context = fetch_all_data(org_id)
    
    # Generate AI suggestions
    ai_suggestions = generate_smart_suggestions(data_context, language)
    
    # Get popular queries
    popular = get_popular_queries(org_id, limit=5)
    popular_queries = [item['query'] for item in popular]
    
    return {
        "ai_suggestions": ai_suggestions,
        "popular_queries": popular_queries,
        "data_available": list(data_context.keys())
    }
