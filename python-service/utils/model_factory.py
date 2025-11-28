import os
from typing import Any
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

def get_model(task_type: str) -> Any:
    """Return a LangChain chat model based on the task type.

    - ``ocr_complex`` / ``extraction`` → Claude 3.5 Sonnet (Anthropic)
    - ``reasoning`` / ``finance`` → GPT‑4o (OpenAI)
    """
    task_type = task_type.lower()
    if task_type in {"ocr_complex", "extraction"}:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set in environment")
        return ChatAnthropic(model="claude-3-5-sonnet-20240620", temperature=0, api_key=api_key)
    elif task_type in {"reasoning", "finance"}:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY not set in environment")
        return ChatOpenAI(model="gpt-4o", temperature=0, api_key=api_key)
    else:
        raise ValueError(f"Unsupported task_type: {task_type}")
