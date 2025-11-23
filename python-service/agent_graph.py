from typing import TypedDict, Annotated
from decimal import Decimal
from langgraph.graph import StateGraph, END

# 1. Define the State (The "Memory" of the request)
class AgentState(TypedDict):
    invoice_id: str
    amount_raw: float
    verification_status: str
    messages: list[str]

# 2. Define the "Accountant" Node (Business Logic)
def accountant_node(state: AgentState):
    print(f"🤖 Accountant analyzing Invoice #{state['invoice_id']}...")
    
    # THE PYTHON ADVANTAGE: High-precision math
    amount = Decimal(str(state['amount_raw']))
    threshold = Decimal("5000.00")
    
    messages = state['messages']
    
    if amount > threshold:
        # Logic: Needs CFO approval
        status = "NEEDS_APPROVAL"
        messages.append(f"Amount {amount} exceeds limit of {threshold}. Escalating to CFO.")
    else:
        # Logic: Auto-approve
        status = "APPROVED"
        messages.append(f"Amount {amount} is within limits. Auto-approved.")
        
    return {
        "verification_status": status,
        "messages": messages
    }

# 3. Build the Graph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("accountant", accountant_node)

# Set entry point
workflow.set_entry_point("accountant")

# Set finish point
workflow.add_edge("accountant", END)

# Compile the brain
app_graph = workflow.compile()
