"""
Growth Agent (LeadSniper) - Intelligent B2B Prospect Finder with Geographic Restrictions

This agent uses Exa.ai for semantic search and OpenAI for reasoning
to find qualified prospects while avoiding competitors.

Key Features:
- Geographic restrictions based on organization's operating_city
- Smart query generation that avoids competitor keywords
- LLM-based geographic validation of each lead
- Automatic filtering of out-of-zone prospects
"""

import os
import json
import asyncio
from typing import Optional
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from openai import AsyncOpenAI
from exa_py import Exa
from supabase import create_client, Client
from utils.prompt_loader import load_prompt

# Initialize clients
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
exa_client = Exa(api_key=os.getenv("EXA_API_KEY"))

# Supabase client for fetching org location
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(supabase_url, supabase_key) if supabase_url and supabase_key else None


@dataclass
class GeoLocation:
    """Organization's geographic operating zone"""
    city: Optional[str] = None
    country: Optional[str] = None
    region: Optional[str] = None


@dataclass
class ProspectLead:
    """Structured lead data ready for Supabase insertion"""
    company_name: str
    website: str
    description: Optional[str] = None
    sector: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_score: int = 50
    ai_next_action: Optional[str] = None
    relationship_type: str = "prospect"
    buying_signals: Optional[list[str]] = None
    detected_city: Optional[str] = None
    is_in_zone: bool = True
    source: str = "growth_agent"


class LeadSniper:
    """
    Smart Growth Agent that finds qualified B2B prospects using semantic search
    with strict geographic restrictions.

    The agent follows a 5-step process:
    1. LOCATION: Fetch organization's operating city/country from Supabase
    2. REASONING: Generate smart search queries with geographic context
    3. SEARCH: Use Exa.ai semantic search with domain filtering
    4. GEO-VALIDATION: Verify each lead is in the target zone using LLM
    5. FILTERING: Classify results and format for Supabase
    """

    def __init__(
        self,
        max_results_per_query: int = 10,
        num_queries: int = 3,
        strict_geo_filter: bool = True
    ):
        self.max_results_per_query = max_results_per_query
        self.num_queries = num_queries
        self.strict_geo_filter = strict_geo_filter

    async def find_prospects(
        self,
        user_business_description: str,
        org_id: Optional[str] = None,
        target_geography: Optional[str] = None,
        exclude_domains: Optional[list[str]] = None,
        target_query: Optional[str] = None,
        user_business_context: Optional[str] = None,
        search_type: str = "clients",
        criteria: Optional[str] = None,
        radius: int = 20
    ) -> dict:
        """
        Main entry point: Find qualified prospects with geographic restrictions.

        Args:
            user_business_description: What the user sells (legacy, for backwards compat)
            org_id: Organization ID to fetch location from Supabase
            target_geography: Manual override for geography (e.g., "Paris, France")
            exclude_domains: List of domains to exclude (e.g., known competitors)
            target_query: What the user is searching for (e.g., "Hôtels ayant besoin de rénovation")
            user_business_context: Who the user is (from DB, e.g., "Entreprise de rénovation bâtiment")
            search_type: Type of search - "clients", "suppliers", or "partners"
            criteria: Optional specific criteria (e.g., "Occasion, Livraison rapide")
            radius: Search radius in km (0 = city only, up to 100km)

        Returns:
            dict with 'prospects' list and 'metadata'
        """
        # Use new params if provided, fallback to legacy
        search_target = target_query or user_business_description
        business_context = user_business_context or user_business_description

        try:
            # Step 1: Get organization's geographic zone
            print(f"[LeadSniper] Step 1: Fetching organization location...")
            geo_location = await self._get_org_location(org_id, target_geography)
            print(f"[LeadSniper] Operating zone: {geo_location.city}, {geo_location.country}")
            print(f"[LeadSniper] Business context: {business_context}")
            print(f"[LeadSniper] Search target: {search_target}")
            print(f"[LeadSniper] Search type: {search_type}")
            print(f"[LeadSniper] Criteria: {criteria}")
            print(f"[LeadSniper] Radius: {radius}km")

            # Step 2: Generate smart search queries with geographic context
            print(f"[LeadSniper] Step 2: Generating geo-targeted queries...")
            queries = await self._generate_geo_queries(
                search_target,
                geo_location,
                business_context,
                search_type,
                criteria,
                radius
            )
            print(f"[LeadSniper] Generated {len(queries)} geo-targeted queries")

            # Step 3: Execute Exa searches with domain filtering
            print("[LeadSniper] Step 3: Executing Exa semantic searches...")
            raw_results = await self._execute_geo_searches(
                queries,
                geo_location,
                exclude_domains
            )
            print(f"[LeadSniper] Found {len(raw_results)} raw results")

            # Step 4: Geo-validate each result with LLM
            print("[LeadSniper] Step 4: Validating geographic zone for each lead...")
            validated_results = await self._validate_geography(
                raw_results,
                geo_location
            )

            # Filter to only in-zone leads
            in_zone = [r for r in validated_results if r.get("is_in_zone", False)]
            out_of_zone = [r for r in validated_results if not r.get("is_in_zone", False)]
            print(f"[LeadSniper] Geo-validation: {len(in_zone)} in zone, {len(out_of_zone)} filtered out")

            # Step 5: Classify and filter results
            print("[LeadSniper] Step 5: Classifying and formatting results...")
            classified_results = await self._classify_results(
                in_zone,
                business_context,  # Use business context for competitor detection
                search_type  # Pass search type for context-aware classification
            )

            # Count by type
            prospects = [r for r in classified_results if r.get("relationship_type") == "prospect"]
            competitors = [r for r in classified_results if r.get("relationship_type") == "competitor"]
            partners = [r for r in classified_results if r.get("relationship_type") == "partner"]

            print(f"[LeadSniper] Final: {len(prospects)} prospects, {len(competitors)} competitors filtered")

            # Format for Supabase
            formatted_leads = self._format_for_supabase(prospects)

            return {
                "success": True,
                "prospects": formatted_leads,
                "metadata": {
                    "queries_used": queries,
                    "total_raw_results": len(raw_results),
                    "in_zone_results": len(in_zone),
                    "out_of_zone_filtered": len(out_of_zone),
                    "prospects_found": len(prospects),
                    "competitors_filtered": len(competitors),
                    "partners_found": len(partners),
                    "user_business": business_context,
                    "search_target": search_target,
                    "geographic_zone": {
                        "city": geo_location.city,
                        "country": geo_location.country,
                        "region": geo_location.region
                    }
                }
            }

        except Exception as e:
            print(f"[LeadSniper] Error: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "prospects": [],
                "metadata": {}
            }

    async def _get_org_location(
        self,
        org_id: Optional[str],
        manual_geography: Optional[str]
    ) -> GeoLocation:
        """
        Step 1: Fetch organization's operating location from Supabase.
        Falls back to manual geography if org_id not provided.
        """
        # If manual override provided, parse it
        if manual_geography:
            parts = manual_geography.split(",")
            return GeoLocation(
                city=parts[0].strip() if len(parts) > 0 else None,
                country=parts[1].strip() if len(parts) > 1 else None,
                region=parts[2].strip() if len(parts) > 2 else None
            )

        # Fetch from Supabase if org_id provided
        if org_id and supabase:
            try:
                response = supabase.table("organizations").select(
                    "operating_city, operating_country, operating_region"
                ).eq("id", org_id).single().execute()

                if response.data:
                    return GeoLocation(
                        city=response.data.get("operating_city"),
                        country=response.data.get("operating_country"),
                        region=response.data.get("operating_region")
                    )
            except Exception as e:
                print(f"[LeadSniper] Warning: Could not fetch org location: {e}")

        # Default fallback
        return GeoLocation(city=None, country="France")

    async def _generate_geo_queries(
        self,
        target_query: str,
        geo: GeoLocation,
        user_business_context: Optional[str] = None,
        search_type: str = "clients",
        criteria: Optional[str] = None,
        radius: int = 20
    ) -> list[str]:
        """
        Step 2: Generate search queries with strict geographic context.

        Args:
            target_query: What the user is searching for (e.g., "Hôtels ayant besoin de rénovation")
            geo: Geographic location constraints
            user_business_context: Who the user is (e.g., "Entreprise de rénovation bâtiment")
            search_type: "clients", "suppliers", or "partners"
            criteria: Optional specific criteria (e.g., "Occasion, Livraison rapide")
            radius: Search radius in km (0 = city only)
        """
        city_context = geo.city or "la région"
        country_context = geo.country or "France"

        # Load prompts from YAML with all contexts
        # Use section parameter to select the right prompt set based on search_type
        prompts = load_prompt(
            "growth_agent_queries",
            variables={
                "city": city_context,
                "country": country_context,
                "num_queries": self.num_queries,
                "target_query": target_query,
                "user_business_context": user_business_context or "une entreprise",
                "search_type": search_type,
                "criteria": criteria or "",
                "radius": radius,
                # Backwards compat
                "user_business": target_query
            },
            section=search_type  # "clients", "suppliers", or "partners"
        )

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompts["system"]},
                    {"role": "user", "content": prompts["user"]}
                ],
                temperature=0.7,
                max_tokens=500
            )

            content = response.choices[0].message.content.strip()
            content = content.replace("```json", "").replace("```", "").strip()
            queries = json.loads(content)

            return queries[:self.num_queries]

        except Exception as e:
            print(f"[LeadSniper] Query generation error: {e}")
            # Fallback queries with geographic context
            city = geo.city or "France"
            return [
                f"entreprises {city} {target_query}",
                f"PME {city} recherche {target_query}",
                f"commerces {city} {target_query}"
            ]

    async def _execute_geo_searches(
        self,
        queries: list[str],
        geo: GeoLocation,
        exclude_domains: Optional[list[str]] = None,
        use_news_filter: bool = True,
        freshness_months: int = 6
    ) -> list[dict]:
        """
        Step 3: Execute Exa searches with domain filtering and temporal filtering.

        Args:
            queries: List of search queries
            geo: Geographic location constraints
            exclude_domains: Domains to exclude
            use_news_filter: If True, prioritize recent news/articles
            freshness_months: Only return results from the last N months (default 6)
        """
        all_results = []
        seen_urls = set()

        # Calculate date filter (only results from last N months)
        start_date = (datetime.now() - timedelta(days=freshness_months * 30)).strftime("%Y-%m-%d")
        print(f"[LeadSniper] Temporal filter: Only results after {start_date}")

        for query in queries:
            try:
                # Build search kwargs with temporal filtering
                search_kwargs = {
                    "num_results": self.max_results_per_query,
                    "text": True,
                    "start_published_date": start_date,  # Only recent content!
                }

                # For French searches, add city/region context
                modified_query = query
                if geo.city:
                    if geo.city.lower() not in query.lower():
                        modified_query = f"{query} {geo.city}"

                # Add news/actualité keywords for fresher results
                if use_news_filter:
                    news_query = f"{modified_query} actualité OR projet OR annonce OR inauguration"
                else:
                    news_query = modified_query

                print(f"[LeadSniper] Searching: '{news_query[:80]}...'")

                search_results = exa_client.search_and_contents(
                    news_query,
                    **search_kwargs
                )

                for result in search_results.results:
                    # Skip duplicates
                    if result.url in seen_urls:
                        continue
                    seen_urls.add(result.url)

                    # Skip excluded domains
                    if exclude_domains:
                        domain = self._extract_domain(result.url)
                        if any(exc in domain for exc in exclude_domains):
                            continue

                    # Extract publish date if available
                    published_date = None
                    if hasattr(result, 'published_date') and result.published_date:
                        published_date = result.published_date

                    all_results.append({
                        "url": result.url,
                        "title": result.title,
                        "text": result.text[:3000] if result.text else "",
                        "highlights": result.highlights if hasattr(result, 'highlights') else [],
                        "score": result.score if hasattr(result, 'score') else 0,
                        "source_query": query,
                        "published_date": published_date  # Track freshness
                    })

            except Exception as e:
                print(f"[LeadSniper] Search error for query '{query}': {e}")
                continue

        # Sort by freshness (most recent first) if dates available
        all_results.sort(
            key=lambda x: x.get("published_date") or "1900-01-01",
            reverse=True
        )

        return all_results

    async def _validate_geography(
        self,
        results: list[dict],
        geo: GeoLocation
    ) -> list[dict]:
        """
        Step 4: Use LLM to validate each lead is in the target geographic zone.
        Extracts postal code and city, checks if in target area.
        """
        if not results or not self.strict_geo_filter:
            # If no strict filter, assume all in zone
            for r in results:
                r["is_in_zone"] = True
                r["detected_city"] = "Non vérifié"
            return results

        target_city = geo.city or "France"
        target_country = geo.country or "France"

        # Process in batches
        batch_size = 5
        validated = []

        for i in range(0, len(results), batch_size):
            batch = results[i:i + batch_size]
            batch_validated = await self._validate_geo_batch(batch, target_city, target_country)
            validated.extend(batch_validated)

        return validated

    async def _validate_geo_batch(
        self,
        batch: list[dict],
        target_city: str,
        target_country: str
    ) -> list[dict]:
        """Validate a batch of results for geographic zone."""

        batch_data = []
        for item in batch:
            batch_data.append({
                "url": item["url"],
                "title": item["title"],
                "text_preview": item["text"][:1500] if item["text"] else ""
            })

        # Load prompts from YAML
        prompts = load_prompt("growth_agent_geo_validation", {
            "target_city": target_city,
            "target_country": target_country,
            "batch_count": len(batch),
            "batch_data": json.dumps(batch_data, ensure_ascii=False, indent=2)
        })

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompts["system"]},
                    {"role": "user", "content": prompts["user"]}
                ],
                temperature=0.2,
                max_tokens=2000
            )

            content = response.choices[0].message.content.strip()
            content = content.replace("```json", "").replace("```", "").strip()
            validations = json.loads(content)

            # Merge validation results with original data
            result = []
            for i, item in enumerate(batch):
                if i < len(validations):
                    item["is_in_zone"] = validations[i].get("is_in_zone", False)
                    item["detected_city"] = validations[i].get("detected_city", "Non trouvé")
                    item["geo_confidence"] = validations[i].get("confidence", "low")
                    item["geo_reasoning"] = validations[i].get("reasoning", "")
                else:
                    # Default to in-zone if validation missing (conservative)
                    item["is_in_zone"] = True
                    item["detected_city"] = "Non vérifié"
                result.append(item)

            return result

        except Exception as e:
            print(f"[LeadSniper] Geo validation error: {e}")
            # On error, keep all results but mark as unverified
            for item in batch:
                item["is_in_zone"] = True  # Conservative: don't filter on error
                item["detected_city"] = "Erreur validation"
            return batch

    async def _classify_results(
        self,
        results: list[dict],
        user_business: str,
        search_type: str = "clients"
    ) -> list[dict]:
        """
        Step 5: Classify each result as prospect/competitor/partner.

        Args:
            results: List of raw results to classify
            user_business: User's business description
            search_type: "clients", "suppliers", or "partners" - affects classification logic
        """
        if not results:
            return []

        batch_size = 5
        classified = []

        for i in range(0, len(results), batch_size):
            batch = results[i:i + batch_size]
            batch_classified = await self._classify_batch(batch, user_business, search_type)
            classified.extend(batch_classified)

        return classified

    async def _classify_batch(
        self,
        batch: list[dict],
        user_business: str,
        search_type: str = "clients"
    ) -> list[dict]:
        """Classify a batch of results.

        Args:
            batch: List of results to classify
            user_business: User's business description
            search_type: "clients", "suppliers", or "partners" - affects classification logic
        """

        batch_data = []
        for item in batch:
            batch_data.append({
                "url": item["url"],
                "title": item["title"],
                "text_preview": item["text"][:500] if item["text"] else "",
                "detected_city": item.get("detected_city", "N/A"),
                "highlights": item.get("highlights", [])[:3]
            })

        # Load prompts from YAML with search_type section
        prompts = load_prompt(
            "growth_agent_classification",
            variables={
                "user_business": user_business,
                "batch_count": len(batch),
                "batch_data": json.dumps(batch_data, ensure_ascii=False, indent=2)
            },
            section=search_type  # "clients", "suppliers", or "partners"
        )

        try:
            response = await openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": prompts["system"]},
                    {"role": "user", "content": prompts["user"]}
                ],
                temperature=0.3,
                max_tokens=2000
            )

            content = response.choices[0].message.content.strip()
            content = content.replace("```json", "").replace("```", "").strip()
            classifications = json.loads(content)

            result = []
            for i, item in enumerate(batch):
                if i < len(classifications):
                    merged = {**item, **classifications[i]}
                    result.append(merged)
                else:
                    item["relationship_type"] = "unknown"
                    item["ai_score"] = 30
                    result.append(item)

            return result

        except Exception as e:
            print(f"[LeadSniper] Classification error: {e}")
            for item in batch:
                item["relationship_type"] = "unknown"
                item["ai_score"] = 30
            return batch

    def _format_for_supabase(self, prospects: list[dict]) -> list[dict]:
        """Format prospects for Supabase leads table insertion."""
        formatted = []

        for p in prospects:
            lead = {
                "company_name": p.get("company_name") or p.get("title", "Unknown"),
                "website": p.get("url", ""),
                "description": p.get("text", "")[:500] if p.get("text") else None,
                "sector": p.get("sector"),
                "ai_summary": p.get("ai_summary"),
                "ai_score": p.get("ai_score", 50),
                "ai_next_action": p.get("ai_next_action"),
                "relationship_type": "prospect",
                "buying_signals": p.get("buying_signals", []),
                "detected_city": p.get("detected_city"),
                "geo_confidence": p.get("geo_confidence"),
                "source": "growth_agent",
                "source_query": p.get("source_query"),
                "potential_value": 0,
                "probability": min(p.get("ai_score", 50), 100),
                "currency": "EUR",
                "status": "new",
                "published_date": p.get("published_date"),  # When the article/news was published
            }
            formatted.append(lead)

        # Sort by freshness first, then by score
        formatted.sort(
            key=lambda x: (x.get("published_date") or "1900-01-01", x["ai_score"]),
            reverse=True
        )

        return formatted

    @staticmethod
    def _extract_domain(url: str) -> str:
        """Extract domain from URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            return parsed.netloc.replace("www.", "")
        except:
            return url


# Convenience function
async def find_prospects(
    user_business: str,
    org_id: Optional[str] = None,
    geography: Optional[str] = None,
    exclude_domains: Optional[list[str]] = None,
    max_results: int = 10,
    strict_geo_filter: bool = True,
    target_query: Optional[str] = None,
    user_business_context: Optional[str] = None,
    search_type: str = "clients",
    criteria: Optional[str] = None,
    radius: int = 20
) -> dict:
    """
    Find prospects with geographic restrictions.

    Example:
        results = await find_prospects(
            "Rénovation bâtiment",  # Legacy param (for backwards compat)
            org_id="uuid-here",  # Will fetch operating_city from Supabase
            geography="Lyon, France",  # Or manual override
            exclude_domains=["bouygues.com"],
            strict_geo_filter=True,  # Enable LLM geo-validation
            target_query="Hôtels ayant besoin de rénovation",  # What to search for
            user_business_context="Entreprise de rénovation bâtiment",  # Who is searching
            search_type="clients",  # "clients" | "suppliers" | "partners"
            criteria="Budget > 50k€",  # Optional specific criteria
            radius=50  # Radius in km (0 = city only)
        )
    """
    sniper = LeadSniper(
        max_results_per_query=max_results,
        strict_geo_filter=strict_geo_filter
    )
    return await sniper.find_prospects(
        user_business,
        org_id=org_id,
        target_geography=geography,
        exclude_domains=exclude_domains,
        target_query=target_query,
        user_business_context=user_business_context,
        search_type=search_type,
        criteria=criteria,
        radius=radius
    )


# Test function
async def test_lead_sniper():
    """Test the LeadSniper agent with geographic restrictions."""
    print("=" * 60)
    print("Testing LeadSniper Growth Agent with Geo Restrictions")
    print("=" * 60)

    result = await find_prospects(
        user_business="Rénovation bâtiment et travaux immobiliers",
        geography="Lyon, France",  # Test with Lyon
        exclude_domains=["bouygues-construction.com", "vinci.com", "eiffage.com"],
        max_results=5,
        strict_geo_filter=True
    )

    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)

    if result["success"]:
        meta = result['metadata']
        print(f"\nGeographic Zone: {meta.get('geographic_zone', {})}")
        print(f"Queries used: {meta.get('queries_used', [])}")
        print(f"Total raw results: {meta.get('total_raw_results', 0)}")
        print(f"In-zone results: {meta.get('in_zone_results', 0)}")
        print(f"Out-of-zone filtered: {meta.get('out_of_zone_filtered', 0)}")
        print(f"Final prospects: {meta.get('prospects_found', 0)}")

        print("\n--- TOP PROSPECTS ---")
        for i, prospect in enumerate(result["prospects"][:5], 1):
            print(f"\n{i}. {prospect['company_name']}")
            print(f"   URL: {prospect['website']}")
            print(f"   Score: {prospect['ai_score']}")
            print(f"   Detected City: {prospect.get('detected_city', 'N/A')}")
            print(f"   Geo Confidence: {prospect.get('geo_confidence', 'N/A')}")
            print(f"   Sector: {prospect.get('sector', 'N/A')}")
            print(f"   Summary: {prospect.get('ai_summary', 'N/A')[:80]}...")
    else:
        print(f"Error: {result['error']}")

    return result


if __name__ == "__main__":
    asyncio.run(test_lead_sniper())
