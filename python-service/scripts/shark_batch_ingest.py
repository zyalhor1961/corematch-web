#!/usr/bin/env python3
"""
Shark Batch Ingestion Script

This script processes articles from sourced_leads and ingests them as BTP projects
into the shark_* tables.

Usage:
    # Process all enriched leads for a tenant
    python scripts/shark_batch_ingest.py --tenant-id <uuid>

    # Process a specific number of leads
    python scripts/shark_batch_ingest.py --tenant-id <uuid> --limit 10

    # Process leads from a specific search
    python scripts/shark_batch_ingest.py --tenant-id <uuid> --search-id <uuid>

    # Dry run (extract only, don't save)
    python scripts/shark_batch_ingest.py --tenant-id <uuid> --dry-run
"""

import os
import sys
import asyncio
import argparse
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from supabase import create_client, Client
from services.shark_ingestion import SharkIngestionService, batch_ingest_articles
from agents.project_extractor import extract_project_from_article


def get_supabase_client() -> Client:
    """Initialize Supabase client."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        print("Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        sys.exit(1)

    return create_client(url, key)


def fetch_sourced_leads(
    supabase: Client,
    tenant_id: str,
    search_id: str = None,
    limit: int = None,
    only_enriched: bool = True
) -> list:
    """
    Fetch sourced leads from the database.

    Args:
        supabase: Supabase client
        tenant_id: Tenant UUID (org_id in sourced_leads)
        search_id: Optional search ID to filter by
        limit: Maximum number of leads to fetch
        only_enriched: Only fetch leads that have been enriched

    Returns:
        List of sourced lead records
    """
    query = supabase.table("sourced_leads").select(
        "id, company_name, url, exa_summary, enrichment_data, is_enriched"
    ).eq("org_id", tenant_id)

    if search_id:
        query = query.eq("search_id", search_id)

    if only_enriched:
        query = query.eq("is_enriched", True)

    if limit:
        query = query.limit(limit)

    result = query.execute()
    return result.data or []


async def process_leads_dry_run(leads: list) -> None:
    """
    Process leads in dry-run mode (extract only, don't save).
    """
    print(f"\n{'='*60}")
    print(f"DRY RUN - Processing {len(leads)} leads")
    print(f"{'='*60}\n")

    for i, lead in enumerate(leads):
        print(f"\n[{i+1}/{len(leads)}] Processing: {lead.get('company_name', 'Unknown')}")
        print(f"  URL: {lead.get('url', 'N/A')}")

        # Get article text from enrichment_data
        enrichment = lead.get("enrichment_data", {}) or {}
        article_text = enrichment.get("markdown", "") or enrichment.get("text", "") or lead.get("exa_summary", "")

        if not article_text:
            print(f"  ⚠ No article text available, skipping")
            continue

        # Extract project data
        try:
            result = await extract_project_from_article(
                article_text=article_text,
                source_url=lead.get("url", ""),
                source_name=enrichment.get("source_name")
            )

            if result.project:
                print(f"  ✓ Project: {result.project.name}")
                print(f"    Type: {result.project.type}")
                print(f"    Location: {result.project.location_city}, {result.project.location_region}")
                print(f"    Budget: {result.project.budget_amount} {result.project.budget_currency}")
                print(f"    Phase: {result.project.phase}")
                print(f"    Organizations: {len(result.organizations)}")
                for org in result.organizations:
                    print(f"      - {org.name} ({org.org_type}) as {org.role_in_project}")
            else:
                print(f"  ○ No BTP project found in article")

        except Exception as e:
            print(f"  ✗ Error: {e}")


async def process_leads_full(leads: list, tenant_id: str) -> dict:
    """
    Process leads and ingest into shark_* tables.

    Returns:
        Summary statistics
    """
    print(f"\n{'='*60}")
    print(f"INGESTING {len(leads)} leads into shark_* tables")
    print(f"{'='*60}\n")

    service = SharkIngestionService(tenant_id=tenant_id)
    results = {
        "total": len(leads),
        "success": 0,
        "no_project": 0,
        "errors": 0,
        "details": []
    }

    for i, lead in enumerate(leads):
        company_name = lead.get("company_name", "Unknown")
        url = lead.get("url", "")

        print(f"\n[{i+1}/{len(leads)}] {company_name}")

        # Get article text from enrichment_data
        enrichment = lead.get("enrichment_data", {}) or {}
        article_text = enrichment.get("markdown", "") or enrichment.get("text", "") or lead.get("exa_summary", "")

        if not article_text:
            print(f"  ⚠ No article text, skipping")
            results["errors"] += 1
            results["details"].append({
                "lead_id": lead.get("id"),
                "url": url,
                "status": "skipped",
                "reason": "No article text"
            })
            continue

        try:
            result = await service.ingest_article(
                article_text=article_text,
                source_url=url,
                source_name=enrichment.get("source_name"),
                article_title=enrichment.get("title") or company_name
            )

            if result.success and result.project_id:
                print(f"  ✓ Created project: {result.project_id}")
                results["success"] += 1
                results["details"].append({
                    "lead_id": lead.get("id"),
                    "url": url,
                    "status": "created",
                    "project_id": result.project_id
                })
            elif result.success:
                print(f"  ○ No BTP project found")
                results["no_project"] += 1
                results["details"].append({
                    "lead_id": lead.get("id"),
                    "url": url,
                    "status": "no_project"
                })
            else:
                print(f"  ✗ Error: {result.error_message}")
                results["errors"] += 1
                results["details"].append({
                    "lead_id": lead.get("id"),
                    "url": url,
                    "status": "error",
                    "error": result.error_message
                })

        except Exception as e:
            print(f"  ✗ Exception: {e}")
            results["errors"] += 1
            results["details"].append({
                "lead_id": lead.get("id"),
                "url": url,
                "status": "exception",
                "error": str(e)
            })

    return results


def print_summary(results: dict) -> None:
    """Print final summary."""
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"Total processed: {results['total']}")
    print(f"Projects created: {results['success']}")
    print(f"No project found: {results['no_project']}")
    print(f"Errors: {results['errors']}")
    print(f"{'='*60}\n")


async def main():
    parser = argparse.ArgumentParser(description="Batch ingest articles as BTP projects")
    parser.add_argument("--tenant-id", required=True, help="Tenant UUID (org_id)")
    parser.add_argument("--search-id", help="Filter by search ID")
    parser.add_argument("--limit", type=int, help="Maximum number of leads to process")
    parser.add_argument("--dry-run", action="store_true", help="Extract only, don't save to database")
    parser.add_argument("--include-unenriched", action="store_true", help="Include leads that haven't been enriched")

    args = parser.parse_args()

    print(f"\n🦈 Shark Batch Ingestion")
    print(f"Tenant ID: {args.tenant_id}")
    print(f"Dry run: {args.dry_run}")

    # Initialize Supabase
    supabase = get_supabase_client()

    # Fetch leads
    print(f"\nFetching leads...")
    leads = fetch_sourced_leads(
        supabase=supabase,
        tenant_id=args.tenant_id,
        search_id=args.search_id,
        limit=args.limit,
        only_enriched=not args.include_unenriched
    )

    print(f"Found {len(leads)} leads")

    if not leads:
        print("No leads to process. Exiting.")
        return

    if args.dry_run:
        await process_leads_dry_run(leads)
    else:
        results = await process_leads_full(leads, args.tenant_id)
        print_summary(results)


if __name__ == "__main__":
    asyncio.run(main())
