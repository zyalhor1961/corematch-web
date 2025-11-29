"""
CoreMatch Agents Package

AI-powered agents for business automation:
- LeadSniper: Smart B2B prospect finder using Exa.ai
- EnrichmentAgent: Deep company data extraction using Firecrawl + OpenAI
- ProjectExtractor: BTP project extraction from news articles (Shark Hunter)
- SherlockAgent: OSINT agent for B2B lead hunting
"""

from .growth_agent import LeadSniper, find_prospects
from .enrichment_agent import (
    enrich_company_data,
    CompanyData,
    SuggestedContact,
    EnrichmentResult
)
from .project_extractor import (
    ProjectExtractor,
    extract_project_from_article,
    ExtractionResult,
    ExtractedProject,
    ExtractedOrganization,
    ExtractedNews
)

__all__ = [
    # Growth Agent
    "LeadSniper",
    "find_prospects",
    # Enrichment Agent
    "enrich_company_data",
    "CompanyData",
    "SuggestedContact",
    "EnrichmentResult",
    # Project Extractor (Shark Hunter)
    "ProjectExtractor",
    "extract_project_from_article",
    "ExtractionResult",
    "ExtractedProject",
    "ExtractedOrganization",
    "ExtractedNews"
]
