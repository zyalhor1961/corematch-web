"""
CoreMatch Agents Package

AI-powered agents for business automation:
- LeadSniper: Smart B2B prospect finder using Exa.ai
- EnrichmentAgent: Deep company data extraction using Firecrawl + OpenAI
"""

from .growth_agent import LeadSniper, find_prospects
from .enrichment_agent import (
    enrich_company_data,
    CompanyData,
    SuggestedContact,
    EnrichmentResult
)

__all__ = [
    # Growth Agent
    "LeadSniper",
    "find_prospects",
    # Enrichment Agent
    "enrich_company_data",
    "CompanyData",
    "SuggestedContact",
    "EnrichmentResult"
]
