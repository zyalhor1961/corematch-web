"""
Enrichment Agent - Deep Company Data Extraction (v3.0 - Smart PIVOT Mode)

Uses Firecrawl for intelligent web scraping and OpenAI for structured data extraction.
This agent powers the "Gatherer Mode" in the CRM Lead Form, providing rich company
intelligence from any URL.

v3.0 IMPROVEMENTS - PIVOT MODE FOR NEWS/ARTICLES:
- Detects if URL is a news site (actu.fr, ladepeche, linkedin, facebook, etc.)
- PIVOT Mode: Extracts the REAL company from the article, not the journalist
- Secondary Hunt: Uses Exa to find decision-makers on LinkedIn
- Returns the actual prospect contact, not the media site info

v2.0 IMPROVEMENTS:
- Intelligent crawl: Discovers and scrapes /contact, /mentions-legales, /a-propos pages
- Uses Firecrawl map_url() to find relevant sub-pages
- Multi-page scraping for better contact extraction
- Improved French phone/email pattern recognition

Flow (Standard):
1. User clicks "Analyser" on a corporate URL
2. Firecrawl scrapes Homepage + Contact page
3. OpenAI extracts structured contact data
4. Returns enriched company profile

Flow (PIVOT Mode - News Articles):
1. Detect news/media URL -> Trigger PIVOT
2. Scrape the article content
3. LLM extracts: "Who is the main company executing the project?"
4. LLM determines: "What decision-maker role to target?"
5. Exa searches: site:linkedin.com/in "Company" "Role" "City"
6. Returns the REAL prospect, not the journalist
"""

import os
import json
import re
from typing import Optional
from pydantic import BaseModel, Field
from openai import AsyncOpenAI
from exa_py import Exa
from dotenv import load_dotenv

load_dotenv()

# ============================================================
# NEWS/MEDIA DOMAIN DETECTION
# ============================================================

NEWS_MEDIA_DOMAINS = [
    # French News
    'ladepeche.fr', 'actu.fr', 'lefigaro.fr', 'lemonde.fr', 'liberation.fr',
    'lesechos.fr', 'latribune.fr', 'bfmtv.com', 'francetvinfo.fr', 'leparisien.fr',
    'ouest-france.fr', 'sudouest.fr', 'midilibre.fr', 'lavoixdunord.fr',
    'leprogres.fr', 'ledauphine.com', 'lalsace.fr', 'dna.fr', 'estrepublicain.fr',
    'lanouvellerepublique.fr', 'courrier-picard.fr', 'lunion.fr', 'lardennais.fr',
    '20minutes.fr', 'huffingtonpost.fr', 'francebleu.fr', 'rtl.fr', 'europe1.fr',
    # Regional/Local News
    'actu.fr', 'maville.com', 'info-tours.fr', 'toulouse-infos.fr',
    # Business News
    'usinenouvelle.com', 'journaldunet.com', 'challenges.fr', 'capital.fr',
    'businessinsider.fr', 'maddyness.com', 'frenchweb.fr',
    # International
    'linkedin.com', 'facebook.com', 'twitter.com', 'x.com',
    'reuters.com', 'bloomberg.com', 'forbes.com', 'fortune.com',
    # Press Releases
    'prnewswire.com', 'businesswire.com', 'globenewswire.com',
    # Others
    'wikipedia.org', 'medium.com', 'blogspot.com', 'wordpress.com',
]


def is_news_media_url(url: str) -> bool:
    """
    Check if the URL is from a news/media site that requires PIVOT mode.
    Returns True if we should extract the REAL company from the article.
    """
    url_lower = url.lower()

    # Check against known news domains
    for domain in NEWS_MEDIA_DOMAINS:
        if domain in url_lower:
            return True

    # Check for news-like URL patterns
    news_patterns = [
        '/article/', '/actualite/', '/news/', '/actu/',
        '/posts/', '/pulse/', '/blog/', '/press/',
        '-annonce-', '-inaugur', '-projet-', '-lance-',
    ]
    for pattern in news_patterns:
        if pattern in url_lower:
            return True

    return False

# Initialize clients
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
exa_client = Exa(api_key=os.getenv("EXA_API_KEY")) if os.getenv("EXA_API_KEY") else None


# ============================================================
# PIVOT MODE - Extract Real Company from News Articles
# ============================================================

class PivotResult(BaseModel):
    """Result from PIVOT mode analysis"""
    company_name: str = Field(..., description="The real company executing the project")
    company_city: Optional[str] = Field(None, description="City where the company operates")
    project_description: str = Field(..., description="What the company is doing")
    target_role: str = Field(..., description="Decision-maker role to target")
    target_person: Optional[str] = Field(None, description="Person name if found")
    target_linkedin: Optional[str] = Field(None, description="LinkedIn URL if found")
    target_email_pattern: Optional[str] = Field(None, description="Guessed email pattern")
    article_source: str = Field(..., description="Original article URL")
    pivot_reasoning: str = Field(..., description="Why this company was identified")


async def extract_entity_from_article(
    article_content: str,
    article_url: str,
    user_business: Optional[str] = None
) -> dict:
    """
    Step 1 of PIVOT: Extract the REAL company from a news article.

    The LLM reads the article and identifies:
    - Who is the main company executing the project?
    - What city are they in?
    - What decision-maker role should we target?
    """
    business_context = ""
    if user_business:
        business_context = f"""
The user's business is: "{user_business}"
Identify the company that would NEED this service (the buyer), not the company providing it.
"""

    system_prompt = f"""You are a sales intelligence analyst reading a news article.
Your task is to identify the REAL COMPANY that is the subject of the article.

CRITICAL RULES:
- IGNORE the journalist, the newspaper, the media outlet
- IGNORE any company mentioned as "provider" or "contractor" - we want the CLIENT
- FIND the company that is:
  - Launching a project
  - Expanding/renovating
  - Hiring
  - Making an investment
  - Being acquired/merged

{business_context}

Return ONLY valid JSON, no markdown."""

    user_prompt = f"""Analyze this article from {article_url}:

{article_content[:8000]}

Extract:
{{
  "company_name": "The main company executing the project (NOT the journalist/media)",
  "company_city": "City where the company operates (or null)",
  "project_description": "What they are doing (expansion, renovation, hiring, etc.)",
  "target_role": "The decision-maker role to contact (DG, DAF, Directeur Technique, etc.)",
  "confidence": "high | medium | low",
  "reasoning": "1 sentence explaining why this is the right company to target"
}}

RULES:
- If the article is about "Company X opens new factory in Lyon" -> company_name = "Company X"
- If the article is about "Hotel Y undergoes renovation" -> company_name = "Hotel Y"
- target_role should match who decides on "{user_business or 'this type of service'}"
"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=800
        )

        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)

        return {
            "success": True,
            "company_name": data.get("company_name"),
            "company_city": data.get("company_city"),
            "project_description": data.get("project_description"),
            "target_role": data.get("target_role", "Directeur Général"),
            "confidence": data.get("confidence", "medium"),
            "reasoning": data.get("reasoning")
        }

    except Exception as e:
        print(f"[PIVOT] Entity extraction error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def find_decision_maker_on_linkedin(
    company_name: str,
    target_role: str,
    city: Optional[str] = None
) -> dict:
    """
    Step 2 of PIVOT: Use Exa to find the decision-maker on LinkedIn.

    Searches: site:linkedin.com/in "Company Name" "Role" "City"
    """
    if not exa_client:
        return {
            "success": False,
            "error": "Exa client not configured (missing EXA_API_KEY)"
        }

    # Build LinkedIn search query
    query_parts = [f'site:linkedin.com/in "{company_name}"']

    # Add role keywords
    role_keywords = target_role.replace("Directeur", "Director").replace("Gérant", "Manager")
    query_parts.append(f'"{target_role}" OR "{role_keywords}"')

    if city:
        query_parts.append(f'"{city}"')

    query = " ".join(query_parts)
    print(f"[PIVOT] LinkedIn search: {query}")

    try:
        results = exa_client.search_and_contents(
            query,
            num_results=3,
            text=True
        )

        if not results.results:
            return {
                "success": False,
                "error": "No LinkedIn profiles found"
            }

        # Parse the first result
        first_result = results.results[0]
        linkedin_url = first_result.url
        title = first_result.title or ""
        text = first_result.text or ""

        # Extract person name from title (usually "Name - Role at Company | LinkedIn")
        person_name = None
        if " - " in title:
            person_name = title.split(" - ")[0].strip()
        elif " | " in title:
            person_name = title.split(" | ")[0].strip()

        # Try to extract email pattern from domain
        email_pattern = None
        if company_name:
            # Common French patterns
            domain_guess = company_name.lower().replace(" ", "").replace("-", "")[:20]
            if person_name:
                first_name = person_name.split()[0].lower() if person_name.split() else "prenom"
                last_name = person_name.split()[-1].lower() if len(person_name.split()) > 1 else "nom"
                email_pattern = f"{first_name}.{last_name}@{domain_guess}.fr"

        return {
            "success": True,
            "linkedin_url": linkedin_url,
            "person_name": person_name,
            "person_title": title,
            "email_pattern": email_pattern,
            "snippet": text[:300] if text else None
        }

    except Exception as e:
        print(f"[PIVOT] LinkedIn search error: {e}")
        return {
            "success": False,
            "error": str(e)
        }


async def pivot_enrich_from_article(
    article_url: str,
    article_content: str,
    user_business: Optional[str] = None
) -> PivotResult:
    """
    Main PIVOT function: Extract real company from article and find decision-maker.

    This is the "Sherlock Logic":
    1. Read the article -> Find the REAL company
    2. Determine target role based on user's business
    3. Search LinkedIn for that person
    4. Return the actual prospect, not the journalist
    """
    print(f"[PIVOT] Starting PIVOT mode for: {article_url}")
    print(f"[PIVOT] User business: {user_business}")

    # Step 1: Extract entity from article
    entity_result = await extract_entity_from_article(
        article_content,
        article_url,
        user_business
    )

    if not entity_result.get("success"):
        return PivotResult(
            company_name="Unknown",
            project_description="Could not extract company from article",
            target_role="Directeur Général",
            article_source=article_url,
            pivot_reasoning=f"Extraction failed: {entity_result.get('error')}"
        )

    company_name = entity_result["company_name"]
    company_city = entity_result.get("company_city")
    target_role = entity_result.get("target_role", "Directeur Général")

    print(f"[PIVOT] Found company: {company_name} in {company_city}")
    print(f"[PIVOT] Target role: {target_role}")

    # Step 2: Search LinkedIn for decision-maker
    linkedin_result = await find_decision_maker_on_linkedin(
        company_name,
        target_role,
        company_city
    )

    target_person = None
    target_linkedin = None
    email_pattern = None

    if linkedin_result.get("success"):
        target_person = linkedin_result.get("person_name")
        target_linkedin = linkedin_result.get("linkedin_url")
        email_pattern = linkedin_result.get("email_pattern")
        print(f"[PIVOT] Found contact: {target_person} -> {target_linkedin}")
    else:
        print(f"[PIVOT] LinkedIn search failed: {linkedin_result.get('error')}")

    return PivotResult(
        company_name=company_name,
        company_city=company_city,
        project_description=entity_result.get("project_description", ""),
        target_role=target_role,
        target_person=target_person,
        target_linkedin=target_linkedin,
        target_email_pattern=email_pattern,
        article_source=article_url,
        pivot_reasoning=entity_result.get("reasoning", "Extracted from article")
    )


# ============================================================
# PYDANTIC MODELS
# ============================================================

class SuggestedContact(BaseModel):
    """Contact information extracted from the website"""
    name: Optional[str] = Field(None, description="Name of the key contact (CEO, founder, etc.)")
    role: Optional[str] = Field(None, description="Job title or role")
    email: Optional[str] = Field(None, description="Direct email if found")
    email_pattern: Optional[str] = Field(None, description="Guessed email pattern (e.g., prenom.nom@domain.com)")
    phone: Optional[str] = Field(None, description="Phone number if found")
    linkedin_url: Optional[str] = Field(None, description="LinkedIn profile URL")


class CompanyData(BaseModel):
    """
    Structured company data extracted from website content.
    This is the core output of the enrichment agent.
    """
    # Basic Info
    company_name: str = Field(..., description="Official company name")
    short_description: str = Field(..., description="1-2 sentence summary of what the company does")

    # Contact Info
    ceo_name: Optional[str] = Field(None, description="CEO or founder name")
    contact_email: Optional[str] = Field(None, description="General contact email")
    contact_phone: Optional[str] = Field(None, description="Main phone number")
    linkedin_url: Optional[str] = Field(None, description="Company LinkedIn page")

    # Business Details
    sector: Optional[str] = Field(None, description="Industry sector")
    headquarters: Optional[str] = Field(None, description="City, Country of HQ")
    employee_count: Optional[str] = Field(None, description="Estimated employee range (e.g., '50-200')")
    founded_year: Optional[str] = Field(None, description="Year the company was founded")

    # Products & Services
    products_services: Optional[list[str]] = Field(None, description="Key products or services offered")
    target_market: Optional[str] = Field(None, description="Who they sell to (B2B, B2C, specific industries)")

    # Sales Intelligence
    suggested_contact: Optional[SuggestedContact] = Field(None, description="Best contact for sales outreach")
    buying_signals: Optional[list[str]] = Field(None, description="Indicators they might need our services")
    pain_points: Optional[list[str]] = Field(None, description="Problems they likely face")

    # For Smart Growth Engine
    relationship_type: str = Field("unknown", description="prospect | competitor | partner | unknown")
    relationship_reasoning: Optional[str] = Field(None, description="Why this classification")
    ai_score: int = Field(50, description="0-100 score as potential client")
    ai_summary: Optional[str] = Field(None, description="Strategic summary for sales team")
    ai_next_action: Optional[str] = Field(None, description="Recommended next step")


class EnrichmentResult(BaseModel):
    """Full result returned by the enrichment agent"""
    success: bool
    company_data: Optional[CompanyData] = None
    error: Optional[str] = None
    source_url: str
    scraped_content_preview: Optional[str] = Field(None, description="First 500 chars of scraped content")
    pages_scraped: list[str] = Field(default_factory=list, description="List of pages that were scraped")


# ============================================================
# CONTACT PAGE PATTERNS
# ============================================================

CONTACT_PAGE_PATTERNS = [
    '/contact',
    '/nous-contacter',
    '/contactez-nous',
    '/mentions-legales',
    '/legal',
    '/mentions',
    '/a-propos',
    '/about',
    '/about-us',
    '/qui-sommes-nous',
    '/equipe',
    '/team',
    '/impressum',
    '/imprint',
    '/cgv',
    '/cgu',
]


def find_contact_pages(urls: list[str]) -> list[str]:
    """
    From a list of discovered URLs, find the most relevant contact pages.
    Returns up to 3 most relevant URLs.
    """
    contact_urls = []

    for url in urls:
        url_lower = url.lower()
        for pattern in CONTACT_PAGE_PATTERNS:
            if pattern in url_lower:
                contact_urls.append(url)
                break

    # Prioritize: contact > mentions-legales > a-propos
    priority_order = ['contact', 'mentions', 'legal', 'about', 'propos', 'equipe', 'team']

    def get_priority(url):
        url_lower = url.lower()
        for i, keyword in enumerate(priority_order):
            if keyword in url_lower:
                return i
        return len(priority_order)

    contact_urls.sort(key=get_priority)

    return contact_urls[:3]  # Max 3 pages


# ============================================================
# INTELLIGENT CRAWL (FIRECRAWL MAP)
# ============================================================

async def discover_site_pages(base_url: str) -> dict:
    """
    Use Firecrawl's map_url to discover all pages on a website.
    Returns a list of discovered URLs.
    """
    try:
        from firecrawl import FirecrawlApp

        firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
        if not firecrawl_api_key:
            return {
                "success": False,
                "error": "FIRECRAWL_API_KEY not configured",
                "urls": []
            }

        app = FirecrawlApp(api_key=firecrawl_api_key)

        print(f"[EnrichmentAgent] Mapping site: {base_url}")

        # Use map_url to discover pages
        try:
            map_result = app.map_url(base_url)

            if isinstance(map_result, dict):
                urls = map_result.get('links', []) or map_result.get('urls', [])
            elif isinstance(map_result, list):
                urls = map_result
            else:
                urls = []

            print(f"[EnrichmentAgent] Discovered {len(urls)} pages")
            return {
                "success": True,
                "error": None,
                "urls": urls
            }

        except AttributeError:
            # map_url not available in this version of Firecrawl
            print("[EnrichmentAgent] map_url not available, using fallback")
            return {
                "success": False,
                "error": "map_url not available",
                "urls": []
            }

    except ImportError:
        return {
            "success": False,
            "error": "firecrawl-py not installed",
            "urls": []
        }
    except Exception as e:
        print(f"[EnrichmentAgent] Map error: {e}")
        return {
            "success": False,
            "error": str(e),
            "urls": []
        }


def build_contact_page_urls(base_url: str) -> list[str]:
    """
    Build potential contact page URLs based on common patterns.
    Fallback when map_url is not available.
    """
    # Normalize base URL
    if not base_url.startswith(('http://', 'https://')):
        base_url = f'https://{base_url}'

    # Remove trailing slash
    base_url = base_url.rstrip('/')

    # Common French and English contact page paths
    common_paths = [
        '/contact',
        '/nous-contacter',
        '/contactez-nous',
        '/mentions-legales',
        '/mentions',
        '/a-propos',
        '/qui-sommes-nous',
        '/about',
        '/about-us',
        '/equipe',
        '/team',
    ]

    return [f"{base_url}{path}" for path in common_paths]


# ============================================================
# MULTI-PAGE SCRAPING (FIRECRAWL)
# ============================================================

async def scrape_website(url: str) -> dict:
    """
    Scrape a single URL using Firecrawl.
    Returns markdown content or error.
    """
    try:
        from firecrawl import FirecrawlApp

        firecrawl_api_key = os.getenv("FIRECRAWL_API_KEY")
        if not firecrawl_api_key:
            return {
                "success": False,
                "error": "FIRECRAWL_API_KEY not configured",
                "markdown": None,
                "url": url
            }

        app = FirecrawlApp(api_key=firecrawl_api_key)

        print(f"[EnrichmentAgent] Scraping: {url}")
        result = app.scrape_url(url, params={'formats': ['markdown']})

        markdown_content = result.get('markdown', '')

        if not markdown_content:
            return {
                "success": False,
                "error": "No content extracted from URL",
                "markdown": None,
                "url": url
            }

        print(f"[EnrichmentAgent] Scraped {len(markdown_content)} characters from {url}")
        return {
            "success": True,
            "error": None,
            "markdown": markdown_content,
            "url": url
        }

    except ImportError:
        return {
            "success": False,
            "error": "firecrawl-py not installed. Run: pip install firecrawl-py",
            "markdown": None,
            "url": url
        }
    except Exception as e:
        print(f"[EnrichmentAgent] Scrape error for {url}: {e}")
        return {
            "success": False,
            "error": f"Scraping failed: {str(e)}",
            "markdown": None,
            "url": url
        }


async def scrape_multiple_pages(base_url: str) -> dict:
    """
    Intelligent multi-page scraping:
    1. Try to map the site to find contact pages
    2. Fallback to guessing common contact page URLs
    3. Scrape homepage + best contact pages found

    Returns combined markdown from all pages.
    """
    scraped_pages = []
    all_markdown = []

    # Normalize URL
    if not base_url.startswith(('http://', 'https://')):
        base_url = f'https://{base_url}'

    # Step 1: Scrape homepage first
    homepage_result = await scrape_website(base_url)
    if homepage_result["success"]:
        all_markdown.append(f"=== PAGE: ACCUEIL ({base_url}) ===\n{homepage_result['markdown']}")
        scraped_pages.append(base_url)

    # Step 2: Try to discover contact pages via map_url
    contact_urls_to_try = []

    map_result = await discover_site_pages(base_url)
    if map_result["success"] and map_result["urls"]:
        # Find contact pages from discovered URLs
        contact_urls_to_try = find_contact_pages(map_result["urls"])
        print(f"[EnrichmentAgent] Found contact pages via map: {contact_urls_to_try}")

    # Step 3: Fallback - build contact URLs from common patterns
    if not contact_urls_to_try:
        contact_urls_to_try = build_contact_page_urls(base_url)
        print(f"[EnrichmentAgent] Using fallback contact URLs")

    # Step 4: Try to scrape contact pages (max 3)
    pages_tried = 0
    for contact_url in contact_urls_to_try:
        if pages_tried >= 3:
            break
        if contact_url in scraped_pages:
            continue

        pages_tried += 1
        contact_result = await scrape_website(contact_url)

        if contact_result["success"]:
            # Identify page type for context
            page_type = "CONTACT"
            url_lower = contact_url.lower()
            if 'mention' in url_lower or 'legal' in url_lower:
                page_type = "MENTIONS LÉGALES"
            elif 'about' in url_lower or 'propos' in url_lower:
                page_type = "À PROPOS"
            elif 'equipe' in url_lower or 'team' in url_lower:
                page_type = "ÉQUIPE"

            all_markdown.append(f"\n\n=== PAGE: {page_type} ({contact_url}) ===\n{contact_result['markdown']}")
            scraped_pages.append(contact_url)
            print(f"[EnrichmentAgent] Successfully scraped {page_type} page")

    # Combine all markdown
    combined_markdown = "\n".join(all_markdown)

    return {
        "success": len(all_markdown) > 0,
        "error": None if all_markdown else "No pages could be scraped",
        "markdown": combined_markdown,
        "pages_scraped": scraped_pages
    }


# ============================================================
# EXTRACTION STEP (OPENAI) - ENHANCED FOR FRENCH
# ============================================================

async def extract_company_data(
    markdown_content: str,
    url: str,
    my_business: Optional[str] = None,
    pages_scraped: list[str] = None
) -> CompanyData:
    """
    Use OpenAI to extract structured data from scraped content.
    Enhanced with French phone/email pattern recognition.
    """
    # Build context for competitor detection
    business_context = ""
    if my_business:
        business_context = f"""
IMPORTANT CONTEXT - USER IS THE SELLER:
The user runs a business that does: "{my_business}"
Determine if this company is a POTENTIAL CLIENT or a COMPETITOR.

GOLDEN RULE:
- If this company does the SAME thing as user -> COMPETITOR
- If this company could BUY user's services -> PROSPECT
- If complementary (could refer clients) -> PARTNER

Example: If user sells "building renovation":
- Another renovation company = COMPETITOR (score: 0)
- A hotel, real estate firm, property manager = PROSPECT (high score)
- An architect, engineering firm = PARTNER (medium score)
"""

    # Truncate content if too long (keep first 20k chars for multi-page content)
    content_for_llm = markdown_content[:20000] if len(markdown_content) > 20000 else markdown_content

    pages_info = ""
    if pages_scraped and len(pages_scraped) > 1:
        pages_info = f"\n(Scraped {len(pages_scraped)} pages: {', '.join(pages_scraped)})"

    system_prompt = f"""You are a senior sales researcher with 15 years of B2B experience.
Your job is to extract structured company intelligence from website content.
Be precise, factual, and strategic. Focus on information useful for sales outreach.
{business_context}

IMPORTANT - FRENCH CONTACT EXTRACTION:
- French phone formats: 01 XX XX XX XX, 06 XX XX XX XX, +33 X XX XX XX XX, 0X.XX.XX.XX.XX
- Look for "Tél", "Téléphone", "Tel", "Phone", "Appelez-nous"
- French email patterns: contact@, info@, prenom.nom@, p.nom@
- Look in "Mentions légales" section for: SIRET, SIREN, gérant, directeur
- Look for "Contact", "Nous contacter", "Contactez-nous" sections

Return ONLY valid JSON, no markdown formatting or comments."""

    user_prompt = f"""Analyze this website content from {url}{pages_info} and extract:

{{
  "company_name": "Official company name",
  "short_description": "1-2 sentence summary",

  "ceo_name": "CEO/Founder/Gérant/Directeur name or null",
  "contact_email": "Best email found (contact@, info@, or personal) or null",
  "contact_phone": "Phone in format +33 X XX XX XX XX or 0X XX XX XX XX, or null",
  "linkedin_url": "LinkedIn URL or null",

  "sector": "Industry sector",
  "headquarters": "City, Country or null",
  "employee_count": "Range like '50-200' or null",
  "founded_year": "Year or null",

  "products_services": ["Product 1", "Service 2"],
  "target_market": "Who they sell to",

  "suggested_contact": {{
    "name": "Best person to contact (from mentions légales or team page) or null",
    "role": "Their title (CEO, Gérant, DAF, DG, Fondateur...)",
    "email": "Direct email if found or null",
    "email_pattern": "Guessed pattern like prenom.nom@domain.com",
    "phone": "Direct phone (mobile 06/07 preferred) or null",
    "linkedin_url": "Their LinkedIn or null"
  }},

  "buying_signals": ["Signal 1", "Signal 2"],
  "pain_points": ["Problem 1", "Problem 2"],

  "relationship_type": "prospect | competitor | partner | unknown",
  "relationship_reasoning": "1 sentence explanation",
  "ai_score": 0-100,
  "ai_summary": "Strategic summary for sales team",
  "ai_next_action": "Recommended next step"
}}

EXTRACTION RULES:
- If it's a COMPETITOR, ai_score must be 0
- PRIORITIZE: Direct mobile (06/07) > Fixe > Generic email > Guessed pattern
- Look for contact info in ALL sections: header, footer, contact page, mentions légales
- Extract SIRET/SIREN if present (can help identify company)
- If multiple phones found, prefer mobile (06/07) for suggested_contact
- If no email found but domain known, suggest pattern: prenom.nom@domain.com
- Be factual - if info not found, return null

WEBSITE CONTENT:
{content_for_llm}"""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=2000
        )

        content = response.choices[0].message.content.strip()

        # Clean JSON response
        content = content.replace("```json", "").replace("```", "").strip()

        # Parse JSON
        data = json.loads(content)

        # Build CompanyData model
        suggested_contact = None
        if data.get("suggested_contact"):
            suggested_contact = SuggestedContact(**data["suggested_contact"])

        return CompanyData(
            company_name=data.get("company_name", "Unknown"),
            short_description=data.get("short_description", ""),
            ceo_name=data.get("ceo_name"),
            contact_email=data.get("contact_email"),
            contact_phone=data.get("contact_phone"),
            linkedin_url=data.get("linkedin_url"),
            sector=data.get("sector"),
            headquarters=data.get("headquarters"),
            employee_count=data.get("employee_count"),
            founded_year=data.get("founded_year"),
            products_services=data.get("products_services"),
            target_market=data.get("target_market"),
            suggested_contact=suggested_contact,
            buying_signals=data.get("buying_signals"),
            pain_points=data.get("pain_points"),
            relationship_type=data.get("relationship_type", "unknown"),
            relationship_reasoning=data.get("relationship_reasoning"),
            ai_score=data.get("ai_score", 50),
            ai_summary=data.get("ai_summary"),
            ai_next_action=data.get("ai_next_action")
        )

    except json.JSONDecodeError as e:
        print(f"[EnrichmentAgent] JSON parse error: {e}")
        # Return minimal data
        return CompanyData(
            company_name=extract_domain_name(url),
            short_description="Could not extract details",
            relationship_type="unknown",
            ai_score=30
        )
    except Exception as e:
        print(f"[EnrichmentAgent] Extraction error: {e}")
        return CompanyData(
            company_name=extract_domain_name(url),
            short_description=f"Extraction failed: {str(e)}",
            relationship_type="unknown",
            ai_score=30
        )


def extract_domain_name(url: str) -> str:
    """Extract a readable company name from URL"""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url if url.startswith('http') else f'https://{url}')
        domain = parsed.netloc.replace('www.', '')
        name = domain.split('.')[0]
        return name.capitalize()
    except:
        return "Unknown Company"


# ============================================================
# MAIN ENRICHMENT FUNCTION
# ============================================================

async def enrich_company_data(
    url: str,
    my_business: Optional[str] = None
) -> EnrichmentResult:
    """
    Main entry point: Scrape URL and extract structured company data.

    v3.0: Smart routing with PIVOT mode for news articles.

    Args:
        url: Website URL to analyze
        my_business: What the user's business does (for competitor detection)

    Returns:
        EnrichmentResult with company data or error
    """
    print(f"[EnrichmentAgent] Starting enrichment for: {url}")

    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = f'https://{url}'

    # ============================================================
    # SMART ROUTING: Check if this is a news/media URL
    # ============================================================
    if is_news_media_url(url):
        print(f"[EnrichmentAgent] 🔄 PIVOT MODE ACTIVATED - News/Media URL detected")
        return await _enrich_with_pivot_mode(url, my_business)

    # ============================================================
    # STANDARD MODE: Corporate website
    # ============================================================
    print(f"[EnrichmentAgent] 📊 STANDARD MODE - Corporate URL")

    # Step A: Multi-page scrape (homepage + contact pages)
    scrape_result = await scrape_multiple_pages(url)

    if not scrape_result["success"]:
        # Fallback: Try OpenAI with just the URL (knowledge-based)
        print(f"[EnrichmentAgent] Scrape failed, using knowledge fallback")
        company_data = await extract_from_knowledge(url, my_business)

        return EnrichmentResult(
            success=True,
            company_data=company_data,
            error=f"Scraping unavailable: {scrape_result['error']}. Using AI knowledge.",
            source_url=url,
            scraped_content_preview=None,
            pages_scraped=[]
        )

    # Step B: Extract with enhanced French patterns
    markdown = scrape_result["markdown"]
    pages_scraped = scrape_result.get("pages_scraped", [])

    company_data = await extract_company_data(
        markdown,
        url,
        my_business,
        pages_scraped=pages_scraped
    )

    return EnrichmentResult(
        success=True,
        company_data=company_data,
        error=None,
        source_url=url,
        scraped_content_preview=markdown[:500] if markdown else None,
        pages_scraped=pages_scraped
    )


async def _enrich_with_pivot_mode(
    article_url: str,
    my_business: Optional[str] = None
) -> EnrichmentResult:
    """
    PIVOT MODE: Handle news/media URLs by extracting the REAL company.

    Instead of returning "La Dépêche" as the company, we:
    1. Scrape the article
    2. Extract the real company being discussed
    3. Find the decision-maker on LinkedIn
    4. Return the ACTUAL prospect data
    """
    print(f"[PIVOT] Scraping article: {article_url}")

    # Step 1: Scrape the article
    scrape_result = await scrape_website(article_url)

    if not scrape_result["success"]:
        return EnrichmentResult(
            success=False,
            error=f"Could not scrape article: {scrape_result['error']}",
            source_url=article_url,
            pages_scraped=[]
        )

    article_content = scrape_result["markdown"]

    # Step 2: Run PIVOT analysis
    pivot_result = await pivot_enrich_from_article(
        article_url,
        article_content,
        my_business
    )

    # Step 3: Convert PivotResult to CompanyData format
    suggested_contact = None
    if pivot_result.target_person or pivot_result.target_linkedin:
        suggested_contact = SuggestedContact(
            name=pivot_result.target_person,
            role=pivot_result.target_role,
            email_pattern=pivot_result.target_email_pattern,
            linkedin_url=pivot_result.target_linkedin
        )

    company_data = CompanyData(
        company_name=pivot_result.company_name,
        short_description=pivot_result.project_description,
        headquarters=pivot_result.company_city,
        suggested_contact=suggested_contact,
        linkedin_url=pivot_result.target_linkedin,
        relationship_type="prospect",
        relationship_reasoning=pivot_result.pivot_reasoning,
        ai_score=75,  # News mentions = active company = good score
        ai_summary=f"🔄 PIVOT: Extrait de l'article {article_url}. {pivot_result.project_description}",
        ai_next_action=f"Contacter {pivot_result.target_person or pivot_result.target_role} chez {pivot_result.company_name}",
        buying_signals=[pivot_result.project_description] if pivot_result.project_description else None
    )

    return EnrichmentResult(
        success=True,
        company_data=company_data,
        error=None,
        source_url=article_url,
        scraped_content_preview=f"[PIVOT MODE] Article source: {article_url}\nReal company: {pivot_result.company_name}",
        pages_scraped=[article_url]
    )


async def extract_from_knowledge(url: str, my_business: Optional[str] = None) -> CompanyData:
    """
    Fallback: Use OpenAI's knowledge to analyze a domain when scraping fails.
    """
    domain = url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]

    business_context = ""
    if my_business:
        business_context = f"The user's business does: '{my_business}'. Determine if this is a prospect, competitor, or partner."

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""You are a sales researcher. Analyze the company at domain "{domain}"
based on your knowledge. {business_context}
Return ONLY valid JSON with company information."""
                },
                {
                    "role": "user",
                    "content": f"""What do you know about {domain}? Return JSON:
{{
  "company_name": "name",
  "short_description": "what they do",
  "sector": "industry",
  "headquarters": "location or null",
  "relationship_type": "prospect | competitor | partner | unknown",
  "ai_score": 0-100,
  "ai_summary": "strategic notes",
  "ai_next_action": "recommended action"
}}"""
                }
            ],
            temperature=0.3,
            max_tokens=800
        )

        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        data = json.loads(content)

        return CompanyData(
            company_name=data.get("company_name", extract_domain_name(url)),
            short_description=data.get("short_description", ""),
            sector=data.get("sector"),
            headquarters=data.get("headquarters"),
            relationship_type=data.get("relationship_type", "unknown"),
            ai_score=data.get("ai_score", 50),
            ai_summary=data.get("ai_summary"),
            ai_next_action=data.get("ai_next_action")
        )

    except Exception as e:
        print(f"[EnrichmentAgent] Knowledge fallback error: {e}")
        return CompanyData(
            company_name=extract_domain_name(url),
            short_description="Could not extract information",
            relationship_type="unknown",
            ai_score=30
        )


# ============================================================
# DEEP ENRICHMENT FOR HUNTER MODE
# ============================================================

class DeepEnrichmentResult(BaseModel):
    """Result specifically for Hunter mode deep enrichment"""
    success: bool
    error: Optional[str] = None

    # Contact Info
    ceo_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    linkedin_url: Optional[str] = None

    # Score & Intelligence
    probability_score: int = 50  # 0-100 win probability
    ai_summary: str = ""  # 2-sentence strategic summary
    ai_next_action: Optional[str] = None

    # Additional context
    sector: Optional[str] = None
    headquarters: Optional[str] = None
    employee_count: Optional[str] = None
    buying_signals: Optional[list[str]] = None

    # v2.0: Pages crawled
    pages_scraped: list[str] = Field(default_factory=list)


async def deep_enrich_for_hunter(
    url: str,
    user_business_context: str,
    candidate_city: Optional[str] = None,
    candidate_sector: Optional[str] = None
) -> DeepEnrichmentResult:
    """
    Deep enrichment specifically for Hunter mode.
    Now with multi-page crawling for better contact extraction.

    When a user selects a lead from Hunter results, this function:
    1. Maps the website to find contact pages
    2. Scrapes homepage + contact/mentions-legales pages
    3. Extracts CEO name, contact email, LinkedIn with French patterns
    4. Calculates a probability score based on business match
    5. Generates a strategic summary

    Args:
        url: Website URL to analyze
        user_business_context: What the user sells (e.g., "Renovation batiment Lyon")
        candidate_city: City from Hunter results (for score boost)
        candidate_sector: Sector from Hunter results

    Returns:
        DeepEnrichmentResult with contact info and probability score
    """
    print(f"[DeepEnrich] Starting deep enrichment for: {url}")
    print(f"[DeepEnrich] Business context: {user_business_context}")

    # Normalize URL
    if not url.startswith(('http://', 'https://')):
        url = f'https://{url}'

    domain = url.replace('https://', '').replace('http://', '').replace('www.', '').split('/')[0]

    # Step A: Multi-page scraping (homepage + contact pages)
    scrape_result = await scrape_multiple_pages(url)

    markdown_content = None
    pages_scraped = []

    if scrape_result["success"]:
        markdown_content = scrape_result["markdown"]
        pages_scraped = scrape_result.get("pages_scraped", [])
        print(f"[DeepEnrich] Scraped {len(pages_scraped)} pages, {len(markdown_content)} total characters")
    else:
        print(f"[DeepEnrich] Scraping failed: {scrape_result['error']}, using knowledge fallback")

    # Step B: OpenAI Analysis with probability scoring
    try:
        content_for_analysis = markdown_content[:18000] if markdown_content else f"Website domain: {domain}"

        pages_info = ""
        if pages_scraped:
            pages_info = f"\n(Scraped pages: {', '.join(pages_scraped)})"

        system_prompt = f"""You are a senior sales intelligence analyst.
Your task is to:
1. Extract contact information (CEO name, email, phone, LinkedIn)
2. Calculate a WIN PROBABILITY SCORE (0-100) for this lead
3. Write a 2-sentence strategic summary

THE USER SELLS: "{user_business_context}"
{"CANDIDATE CITY: " + candidate_city if candidate_city else ""}
{"CANDIDATE SECTOR: " + candidate_sector if candidate_sector else ""}

SCORING RULES (probability_score):
- 90-100: Perfect match - Same city, needs our exact services, has budget signals
- 70-89: Strong match - Related sector, likely needs our services
- 50-69: Moderate match - Could need our services, needs qualification
- 30-49: Weak match - Unclear fit, requires research
- 0-29: Poor match - Different market, competitor, or no fit

FRENCH CONTACT EXTRACTION - CRITICAL:
- Phone formats: 06 XX XX XX XX, 07 XX XX XX XX, 01 XX XX XX XX, +33 6 XX XX XX XX
- Look for: "Tél", "Téléphone", "Tel", "Mobile", "Appelez-nous", "Nous appeler"
- Look in "Mentions légales" for: gérant, directeur, président, SIRET owner
- Email priority: Direct email > contact@ > info@ > webmaster@
- If contact@ or info@ found, that's better than nothing!

Return ONLY valid JSON."""

        user_prompt = f"""Analyze this company and return:

{{
  "ceo_name": "CEO/Gérant/Directeur/Fondateur name (null if not found)",
  "contact_email": "Best email for outreach (contact@, info@, or direct)",
  "contact_phone": "Phone number in +33 or 0X format (prefer mobile 06/07)",
  "linkedin_url": "Company or CEO LinkedIn URL or null",

  "probability_score": 0-100,
  "score_reasoning": "1 sentence explaining the score",

  "ai_summary": "2-sentence strategic summary for the sales team",
  "ai_next_action": "Specific next step (e.g., 'Appeler le 06... pour RDV')",

  "sector": "Industry sector",
  "headquarters": "City, Country",
  "employee_count": "Range like '10-50'",
  "buying_signals": ["Signal 1", "Signal 2"]
}}

RULES:
- If you find contact@ or info@, USE IT - it's valid
- If you find a phone number, FORMAT IT properly (+33 or 0X XX XX XX XX)
- PRIORITIZE mobile numbers (06/07) over landlines (01-05)
- Look for contact info in header, footer, AND any "contact" or "mentions" sections

{"WEBSITE CONTENT (multiple pages):" if markdown_content else "DOMAIN INFO:"}{pages_info}
{content_for_analysis}"""

        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=1500
        )

        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()

        data = json.loads(content)

        # Ensure probability_score is an integer between 0-100
        probability = int(data.get("probability_score", 50))
        probability = max(0, min(100, probability))

        # Build summary
        summary = data.get("ai_summary", "")
        if data.get("score_reasoning") and data.get("score_reasoning") not in summary:
            summary = f"{summary} Score: {data.get('score_reasoning')}"

        return DeepEnrichmentResult(
            success=True,
            ceo_name=data.get("ceo_name"),
            contact_email=data.get("contact_email"),
            contact_phone=data.get("contact_phone"),
            linkedin_url=data.get("linkedin_url"),
            probability_score=probability,
            ai_summary=summary[:500] if summary else f"Lead from {domain}",
            ai_next_action=data.get("ai_next_action"),
            sector=data.get("sector") or candidate_sector,
            headquarters=data.get("headquarters") or candidate_city,
            employee_count=data.get("employee_count"),
            buying_signals=data.get("buying_signals", []),
            pages_scraped=pages_scraped
        )

    except json.JSONDecodeError as e:
        print(f"[DeepEnrich] JSON parse error: {e}")
        return DeepEnrichmentResult(
            success=True,  # Partial success
            error="Could not parse AI response",
            probability_score=50,
            ai_summary=f"Lead from {domain} - requires manual research",
            sector=candidate_sector,
            headquarters=candidate_city,
            pages_scraped=pages_scraped
        )
    except Exception as e:
        print(f"[DeepEnrich] Error: {e}")
        return DeepEnrichmentResult(
            success=False,
            error=str(e),
            probability_score=30,
            ai_summary=f"Enrichment failed for {domain}",
            pages_scraped=pages_scraped
        )


# ============================================================
# TEST FUNCTION
# ============================================================

async def test_enrichment_agent():
    """Test the enrichment agent with multi-page crawl"""
    print("=" * 60)
    print("Testing Enrichment Agent v2.0 (Multi-Page Crawl)")
    print("=" * 60)

    # Test with a French company
    result = await enrich_company_data(
        url="bouygues-construction.com",
        my_business="Renovation batiment"
    )

    print(f"\nSuccess: {result.success}")
    print(f"Error: {result.error}")
    print(f"Pages scraped: {result.pages_scraped}")

    if result.company_data:
        print(f"\nCompany: {result.company_data.company_name}")
        print(f"Description: {result.company_data.short_description}")
        print(f"Sector: {result.company_data.sector}")
        print(f"Email: {result.company_data.contact_email}")
        print(f"Phone: {result.company_data.contact_phone}")
        print(f"CEO: {result.company_data.ceo_name}")
        print(f"Relationship: {result.company_data.relationship_type}")
        print(f"Score: {result.company_data.ai_score}")
        print(f"Next Action: {result.company_data.ai_next_action}")

        if result.company_data.suggested_contact:
            print(f"\nSuggested Contact:")
            print(f"  Name: {result.company_data.suggested_contact.name}")
            print(f"  Role: {result.company_data.suggested_contact.role}")
            print(f"  Email: {result.company_data.suggested_contact.email}")
            print(f"  Phone: {result.company_data.suggested_contact.phone}")
            print(f"  Email Pattern: {result.company_data.suggested_contact.email_pattern}")

    return result


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_enrichment_agent())
