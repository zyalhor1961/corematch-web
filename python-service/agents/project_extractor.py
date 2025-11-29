"""
Project Extractor Agent - Extracts structured BTP project data from news articles

This agent uses an LLM to analyze news articles and extract:
- Project information (name, type, budget, location, phase)
- Organizations involved (MOA, MOE, contractors)
- News metadata

The extracted data is structured for insertion into the shark_* tables.
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field, asdict
from datetime import datetime
from openai import AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError

from utils.prompt_loader import load_prompt

# Configure logging
logger = logging.getLogger(__name__)

# Initialize OpenAI client
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ============================================================
# Output Models (Pydantic for validation)
# ============================================================

class ExtractedProject(BaseModel):
    """Extracted project data from article"""
    name: str
    type: Optional[str] = None
    description_short: Optional[str] = None
    location_city: Optional[str] = None
    location_region: Optional[str] = None
    country: str = "FR"
    budget_amount: Optional[float] = None
    budget_currency: str = "EUR"
    start_date_est: Optional[str] = None
    end_date_est: Optional[str] = None
    phase: str = "detection"
    sector_tags: List[str] = Field(default_factory=list)


class ExtractedOrganization(BaseModel):
    """Extracted organization data from article"""
    name: str
    org_type: Optional[str] = None
    city: Optional[str] = None
    region: Optional[str] = None
    country: str = "FR"
    role_in_project: str = "autre"


class ExtractedNews(BaseModel):
    """Extracted news metadata"""
    title: Optional[str] = None
    source_name: Optional[str] = None
    published_at: Optional[str] = None
    role_of_news: str = "source"


class ExtractionResult(BaseModel):
    """Complete extraction result"""
    project: Optional[ExtractedProject] = None
    organizations: List[ExtractedOrganization] = Field(default_factory=list)
    news: Optional[ExtractedNews] = None

    # Metadata
    extraction_success: bool = True
    error_message: Optional[str] = None
    raw_response: Optional[str] = None


# ============================================================
# Project Extractor Agent
# ============================================================

class ProjectExtractor:
    """
    LLM-based agent that extracts structured BTP project data from news articles.

    Usage:
        extractor = ProjectExtractor()
        result = await extractor.extract(
            article_text="La mairie de Toulouse lance un projet...",
            source_url="https://example.com/article",
            source_name="Le Moniteur"
        )
    """

    def __init__(
        self,
        model: str = "gpt-4o",
        temperature: float = 0.1,
        max_tokens: int = 2000
    ):
        self.model = model
        self.temperature = temperature
        self.max_tokens = max_tokens

    async def extract(
        self,
        article_text: str,
        source_url: str,
        source_name: Optional[str] = None,
        region_hint: Optional[str] = None,
        published_at: Optional[str] = None
    ) -> ExtractionResult:
        """
        Extract project data from an article.

        Args:
            article_text: Full text of the article
            source_url: URL of the article
            source_name: Name of the news source (e.g., "Le Moniteur")
            region_hint: Optional hint about the region
            published_at: Optional publication date (YYYY-MM-DD)

        Returns:
            ExtractionResult with project, organizations, and news data
        """
        try:
            # Load and render the prompt
            prompts = load_prompt(
                "project_extractor",
                variables={
                    "article_text": article_text[:15000],  # Limit text length
                    "source_url": source_url,
                    "source_name": source_name or "Source inconnue",
                    "region_hint": region_hint,
                    "published_at": published_at
                }
            )

            # Call the LLM
            response = await openai_client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": prompts["system"]},
                    {"role": "user", "content": prompts["user"]}
                ],
                temperature=self.temperature,
                max_tokens=self.max_tokens,
                response_format={"type": "json_object"}
            )

            raw_response = response.choices[0].message.content
            logger.debug(f"Raw LLM response: {raw_response}")

            # Parse the JSON response
            return self._parse_response(raw_response, source_url, source_name)

        except Exception as e:
            logger.error(f"Extraction failed for {source_url}: {e}")
            return ExtractionResult(
                extraction_success=False,
                error_message=str(e)
            )

    def _parse_response(
        self,
        raw_response: str,
        source_url: str,
        source_name: Optional[str]
    ) -> ExtractionResult:
        """Parse and validate the LLM response."""
        try:
            data = json.loads(raw_response)

            # Check if project is null (article not about a BTP project)
            if data.get("project") is None:
                logger.info(f"No BTP project found in article: {source_url}")
                return ExtractionResult(
                    project=None,
                    organizations=[],
                    news=None,
                    extraction_success=True,
                    raw_response=raw_response
                )

            # Validate project
            project_data = data.get("project", {})
            if not project_data.get("name"):
                logger.warning(f"Project has no name, skipping: {source_url}")
                return ExtractionResult(
                    project=None,
                    organizations=[],
                    news=None,
                    extraction_success=True,
                    error_message="Project name is missing",
                    raw_response=raw_response
                )

            project = ExtractedProject(**project_data)

            # Validate organizations
            organizations = []
            for org_data in data.get("organizations", []):
                if org_data.get("name"):
                    try:
                        org = ExtractedOrganization(**org_data)
                        organizations.append(org)
                    except ValidationError as e:
                        logger.warning(f"Invalid organization data: {e}")

            # Validate news
            news_data = data.get("news", {})
            if news_data:
                # Ensure source_url is preserved
                news = ExtractedNews(**news_data)
            else:
                news = ExtractedNews(
                    title=project.name,
                    source_name=source_name,
                    role_of_news="source"
                )

            return ExtractionResult(
                project=project,
                organizations=organizations,
                news=news,
                extraction_success=True,
                raw_response=raw_response
            )

        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON response: {e}")
            return ExtractionResult(
                extraction_success=False,
                error_message=f"Invalid JSON: {e}",
                raw_response=raw_response
            )
        except ValidationError as e:
            logger.error(f"Validation error: {e}")
            return ExtractionResult(
                extraction_success=False,
                error_message=f"Validation error: {e}",
                raw_response=raw_response
            )


# ============================================================
# Convenience function
# ============================================================

async def extract_project_from_article(
    article_text: str,
    source_url: str,
    source_name: Optional[str] = None,
    region_hint: Optional[str] = None,
    published_at: Optional[str] = None
) -> ExtractionResult:
    """
    Convenience function to extract project data from an article.

    Example:
        result = await extract_project_from_article(
            article_text="La mairie de Toulouse annonce un projet de 50M€...",
            source_url="https://lemoniteur.fr/article/123",
            source_name="Le Moniteur",
            region_hint="Occitanie"
        )

        if result.project:
            print(f"Project: {result.project.name}")
            print(f"Budget: {result.project.budget_amount}€")
    """
    extractor = ProjectExtractor()
    return await extractor.extract(
        article_text=article_text,
        source_url=source_url,
        source_name=source_name,
        region_hint=region_hint,
        published_at=published_at
    )
