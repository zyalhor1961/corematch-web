"""
Shark Scoring Service - Phase 4

Calculates a shark_score (0-100) and priority for each project based on:
- Project phase and scale
- Date urgency (time to start)
- Recent news activity
- Organization coverage (MOA, MOE, GC)
- People enrichment (Sherlock)
- Time decay (recency malus)

Usage:
    from services.shark_scoring_service import compute_shark_score, SharkScoreOutput

    result = await compute_shark_score(project_id, tenant_id)
    print(f"Score: {result.score}, Priority: {result.priority}")
"""

import os
import logging
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

from pydantic import BaseModel, Field
from supabase import Client

# Configure logging
logger = logging.getLogger(__name__)


# ============================================================
# PYDANTIC MODELS
# ============================================================

class SharkScoreOutput(BaseModel):
    """Output of shark score computation."""
    project_id: UUID
    score: int  # 0-100
    priority: str  # LOW, MEDIUM, HIGH, CRITICAL
    details: Dict[str, Any] = Field(default_factory=dict)  # Partial scores breakdown
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ScoreBreakdown(BaseModel):
    """Detailed breakdown of score components."""
    phase_points: int = 0
    scale_points: int = 0
    date_urgency_points: int = 0
    news_points: int = 0
    org_points: int = 0
    people_points: int = 0
    bonus_points: int = 0
    malus_points: int = 0
    time_decay_penalty: int = 0
    raw_total: int = 0
    final_score: int = 0


# ============================================================
# SCORING CONSTANTS - MODEL V1.0
# ============================================================

# Phase points
PHASE_SCORES = {
    "appel_offres": 30,
    "travaux": 50,
    "livraison": 10,
    # Other phases get 0
    "detection": 0,
    "etude": 0,
    "attribution": 15,  # Between appel_offres and travaux
    "abandonne": -50,  # Negative for abandoned
}

# Scale points
SCALE_SCORES = {
    "Mega": 40,
    "Large": 25,
    "Medium": 10,
    "Small": 5,
}

# Date urgency thresholds (days)
DATE_URGENCY_90_DAYS = 40
DATE_URGENCY_180_DAYS = 20
DATE_URGENCY_DEFAULT = 5

# News points (per news item in last 30 days, capped)
NEWS_POINTS_PER_ITEM = 10
NEWS_POINTS_MAX = 30
NEWS_LOOKBACK_DAYS = 30

# Organization points by role
ORG_ROLE_SCORES = {
    "MOA": 15,
    "MOE": 10,
    "General_Contractor": 10,
    "Subcontractor": 5,
    "Operator": 5,
    "Other": 2,
}

# People points by role
PEOPLE_ROLE_SCORES = {
    "directeur_travaux": 25,
    "directeur_patrimoine": 15,
    "directeur_immobilier": 15,
    "dg": 20,
    "dga": 15,
    "chef_de_projet": 10,
    "responsable_commercial": 10,
}
PEOPLE_HIGH_CONFIDENCE_BONUS = 10
PEOPLE_HIGH_CONFIDENCE_THRESHOLD = 0.75

# Bonus/Malus
MALUS_NO_ORGS = -20
MALUS_LOW_AI_CONFIDENCE = -10
LOW_AI_CONFIDENCE_THRESHOLD = 0.50

# Time decay thresholds (days since last update)
TIME_DECAY_120_DAYS = -30
TIME_DECAY_60_DAYS = -10

# ============================================================
# APPELS D'OFFRES (PUBLIC TENDERS) SCORING
# ============================================================

# Bonus for projects with linked public tenders
BONUS_APPEL_OFFRES = 30

# Deadline urgency bonuses
BONUS_DEADLINE_15_DAYS = 40    # Very urgent: <= 15 days
BONUS_DEADLINE_30_DAYS = 20    # Urgent: <= 30 days
BONUS_DEADLINE_60_DAYS = 10    # Soon: <= 60 days

# Phase multiplier for appel_offres phase
PHASE_APPEL_OFFRES_MULTIPLIER = 1.15

# Penalty when deadline has passed
PENALTY_DEADLINE_PASSED = -70

# Priority thresholds
PRIORITY_CRITICAL = 90
PRIORITY_HIGH = 70
PRIORITY_MEDIUM = 40


# ============================================================
# HELPER: Get Supabase client
# ============================================================

def get_supabase() -> Client:
    """Get Supabase client."""
    from services.shark_ingestion_service import get_supabase as _get_supabase
    return _get_supabase()


# ============================================================
# HELPER: Calculate priority from score
# ============================================================

def calculate_priority(score: int) -> str:
    """Calculate priority level from score."""
    if score >= PRIORITY_CRITICAL:
        return "CRITICAL"
    elif score >= PRIORITY_HIGH:
        return "HIGH"
    elif score >= PRIORITY_MEDIUM:
        return "MEDIUM"
    else:
        return "LOW"


# ============================================================
# SCORING FUNCTIONS
# ============================================================

def score_phase(phase: Optional[str]) -> int:
    """Calculate points from project phase."""
    if not phase:
        return 0
    return PHASE_SCORES.get(phase.lower(), 0)


def score_scale(scale: Optional[str]) -> int:
    """Calculate points from project scale."""
    if not scale:
        return 0
    return SCALE_SCORES.get(scale, 0)


def score_date_urgency(start_date_est: Optional[str]) -> Tuple[int, int]:
    """
    Calculate points from date urgency.

    Returns:
        Tuple of (points, days_until_start)
    """
    if not start_date_est:
        return DATE_URGENCY_DEFAULT, -1

    try:
        # Parse date string (YYYY-MM-DD)
        if isinstance(start_date_est, str):
            start_date = datetime.strptime(start_date_est[:10], "%Y-%m-%d").date()
        elif isinstance(start_date_est, datetime):
            start_date = start_date_est.date()
        elif isinstance(start_date_est, date):
            start_date = start_date_est
        else:
            return DATE_URGENCY_DEFAULT, -1

        today = date.today()
        days_until_start = (start_date - today).days

        if days_until_start < 0:
            # Already started - give medium urgency
            return DATE_URGENCY_180_DAYS, days_until_start
        elif days_until_start <= 90:
            return DATE_URGENCY_90_DAYS, days_until_start
        elif days_until_start <= 180:
            return DATE_URGENCY_180_DAYS, days_until_start
        else:
            return DATE_URGENCY_DEFAULT, days_until_start

    except (ValueError, TypeError) as e:
        logger.warning(f"Failed to parse start_date: {start_date_est} - {e}")
        return DATE_URGENCY_DEFAULT, -1


def score_news(news_count: int) -> int:
    """Calculate points from recent news count."""
    points = news_count * NEWS_POINTS_PER_ITEM
    return min(points, NEWS_POINTS_MAX)


def score_organizations(orgs: List[Dict[str, Any]]) -> Tuple[int, Dict[str, int]]:
    """
    Calculate points from organizations.

    Returns:
        Tuple of (total_points, breakdown_by_role)
    """
    total = 0
    breakdown = {}
    seen_roles = set()

    for org in orgs:
        role = org.get("role_in_project") or org.get("org_type") or "Other"

        # Only count each role type once
        if role not in seen_roles:
            points = ORG_ROLE_SCORES.get(role, ORG_ROLE_SCORES["Other"])
            total += points
            breakdown[role] = points
            seen_roles.add(role)

    return total, breakdown


def score_people(people: List[Dict[str, Any]]) -> Tuple[int, Dict[str, Any]]:
    """
    Calculate points from Sherlock-enriched people.

    Returns:
        Tuple of (total_points, details)
    """
    total = 0
    high_confidence_count = 0
    role_points = {}

    for person in people:
        role = person.get("role_in_org", "").lower()
        confidence = person.get("ai_confidence") or person.get("source_confidence") or 0

        # Role-based points (only count best person per role)
        role_key = role if role else "other"
        if role_key not in role_points:
            points = 0

            # Check for high-value roles
            for role_pattern, role_score in PEOPLE_ROLE_SCORES.items():
                if role_pattern in role:
                    points = max(points, role_score)

            if points > 0:
                role_points[role_key] = points
                total += points

        # High confidence bonus
        if confidence >= PEOPLE_HIGH_CONFIDENCE_THRESHOLD:
            high_confidence_count += 1

    # Add bonus for high-confidence people (max 1 bonus)
    if high_confidence_count > 0:
        total += PEOPLE_HIGH_CONFIDENCE_BONUS

    details = {
        "role_points": role_points,
        "high_confidence_count": high_confidence_count,
        "high_confidence_bonus": PEOPLE_HIGH_CONFIDENCE_BONUS if high_confidence_count > 0 else 0
    }

    return total, details


def calculate_time_decay(
    project_updated_at: Optional[datetime],
    latest_news_date: Optional[datetime],
    latest_person_date: Optional[datetime]
) -> Tuple[int, Dict[str, Any]]:
    """
    Calculate time decay penalty based on recency of updates.

    Returns:
        Tuple of (penalty, details)
    """
    # Find the most recent update
    dates = []

    if project_updated_at:
        if isinstance(project_updated_at, str):
            try:
                project_updated_at = datetime.fromisoformat(project_updated_at.replace('Z', '+00:00'))
            except ValueError:
                project_updated_at = None
        if project_updated_at:
            dates.append(project_updated_at)

    if latest_news_date:
        if isinstance(latest_news_date, str):
            try:
                latest_news_date = datetime.fromisoformat(latest_news_date.replace('Z', '+00:00'))
            except ValueError:
                latest_news_date = None
        if latest_news_date:
            dates.append(latest_news_date)

    if latest_person_date:
        if isinstance(latest_person_date, str):
            try:
                latest_person_date = datetime.fromisoformat(latest_person_date.replace('Z', '+00:00'))
            except ValueError:
                latest_person_date = None
        if latest_person_date:
            dates.append(latest_person_date)

    if not dates:
        # No dates available, assume recent
        return 0, {"days_since_last_update": 0, "penalty": 0}

    last_update = max(dates)

    # Make datetime timezone-naive for comparison
    if last_update.tzinfo is not None:
        last_update = last_update.replace(tzinfo=None)

    now = datetime.utcnow()
    days_since_update = (now - last_update).days

    # Calculate penalty
    penalty = 0
    if days_since_update > 120:
        penalty = TIME_DECAY_120_DAYS
    elif days_since_update > 60:
        penalty = TIME_DECAY_60_DAYS

    return penalty, {
        "days_since_last_update": days_since_update,
        "penalty": penalty
    }


def calculate_bonus_malus(
    orgs: List[Dict[str, Any]],
    avg_ai_confidence: float
) -> Tuple[int, int, Dict[str, Any]]:
    """
    Calculate bonus and malus adjustments.

    Returns:
        Tuple of (bonus_points, malus_points, details)
    """
    bonus = 0
    malus = 0
    details = {}

    # Malus: No organizations
    if len(orgs) == 0:
        malus += MALUS_NO_ORGS
        details["no_orgs_malus"] = MALUS_NO_ORGS

    # Malus: Low AI confidence
    if avg_ai_confidence > 0 and avg_ai_confidence < LOW_AI_CONFIDENCE_THRESHOLD:
        malus += MALUS_LOW_AI_CONFIDENCE
        details["low_confidence_malus"] = MALUS_LOW_AI_CONFIDENCE
        details["avg_ai_confidence"] = avg_ai_confidence

    return bonus, malus, details


def score_public_tenders(
    tenders: List[Dict[str, Any]],
    project_phase: Optional[str]
) -> Tuple[int, Dict[str, Any]]:
    """
    Calculate bonus points from linked public tenders (appels d'offres).

    Bonuses:
    - BONUS_APPEL_OFFRES: Base bonus for having any linked tender
    - Deadline urgency:
        - <= 15 days: +40
        - <= 30 days: +20
        - <= 60 days: +10
    - Deadline passed: -70 penalty

    Returns:
        Tuple of (total_points, details)
    """
    if not tenders:
        return 0, {"has_tender": False}

    total = BONUS_APPEL_OFFRES
    details = {
        "has_tender": True,
        "tender_count": len(tenders),
        "base_bonus": BONUS_APPEL_OFFRES,
    }

    # Find the most urgent deadline among all tenders
    min_days_until_deadline = None
    closest_deadline = None

    for tender in tenders:
        deadline_str = tender.get("deadline_at")
        if not deadline_str:
            continue

        try:
            if isinstance(deadline_str, str):
                deadline = datetime.fromisoformat(deadline_str.replace('Z', '+00:00'))
            elif isinstance(deadline_str, datetime):
                deadline = deadline_str
            else:
                continue

            # Make timezone-naive for comparison
            if deadline.tzinfo is not None:
                deadline = deadline.replace(tzinfo=None)

            days_until = (deadline - datetime.utcnow()).days

            if min_days_until_deadline is None or days_until < min_days_until_deadline:
                min_days_until_deadline = days_until
                closest_deadline = deadline.isoformat()

        except (ValueError, TypeError):
            continue

    # Apply deadline-based bonus/malus
    if min_days_until_deadline is not None:
        details["closest_deadline"] = closest_deadline
        details["days_until_deadline"] = min_days_until_deadline

        if min_days_until_deadline < 0:
            # Deadline passed - heavy penalty
            total += PENALTY_DEADLINE_PASSED
            details["deadline_penalty"] = PENALTY_DEADLINE_PASSED
            details["deadline_status"] = "passed"
        elif min_days_until_deadline <= 15:
            total += BONUS_DEADLINE_15_DAYS
            details["urgency_bonus"] = BONUS_DEADLINE_15_DAYS
            details["deadline_status"] = "very_urgent"
        elif min_days_until_deadline <= 30:
            total += BONUS_DEADLINE_30_DAYS
            details["urgency_bonus"] = BONUS_DEADLINE_30_DAYS
            details["deadline_status"] = "urgent"
        elif min_days_until_deadline <= 60:
            total += BONUS_DEADLINE_60_DAYS
            details["urgency_bonus"] = BONUS_DEADLINE_60_DAYS
            details["deadline_status"] = "soon"
        else:
            details["deadline_status"] = "distant"

    return total, details


async def load_project_tenders(
    project_id: UUID,
    db: Client
) -> List[Dict[str, Any]]:
    """
    Load public tenders linked to a project.

    Returns:
        List of tender records with deadline info
    """
    try:
        # Get tender links
        links = db.table("shark_project_tenders").select(
            "tender_id"
        ).eq("project_id", str(project_id)).execute()

        if not links.data:
            return []

        tenders = []
        for link in links.data:
            tender_id = link["tender_id"]

            # Get tender details
            tender = db.table("shark_public_tenders").select(
                "id, external_id, title, deadline_at, status, cpv_codes"
            ).eq("id", tender_id).execute()

            if tender.data:
                tenders.append(tender.data[0])

        return tenders

    except Exception as e:
        logger.warning(f"Failed to load tenders for project {project_id}: {e}")
        return []


# ============================================================
# DATA LOADING FUNCTIONS
# ============================================================

async def load_project_data(
    project_id: UUID,
    tenant_id: UUID,
    db: Client
) -> Optional[Dict[str, Any]]:
    """Load project data from database."""
    result = db.table("shark_projects").select("*").eq(
        "id", str(project_id)
    ).eq("tenant_id", str(tenant_id)).execute()

    if not result.data:
        return None

    return result.data[0]


async def load_project_organizations(
    project_id: UUID,
    db: Client
) -> List[Dict[str, Any]]:
    """Load organizations linked to a project."""
    # Join through shark_project_organizations
    links = db.table("shark_project_organizations").select(
        "organization_id, role_in_project, ai_confidence"
    ).eq("project_id", str(project_id)).execute()

    if not links.data:
        return []

    orgs = []
    for link in links.data:
        org_id = link.get("organization_id")
        if org_id:
            org_result = db.table("shark_organizations").select(
                "id, name, org_type"
            ).eq("id", org_id).execute()

            if org_result.data:
                org = org_result.data[0]
                org["role_in_project"] = link.get("role_in_project")
                org["ai_confidence"] = link.get("ai_confidence")
                orgs.append(org)

    return orgs


async def load_recent_news(
    project_id: UUID,
    db: Client,
    days: int = NEWS_LOOKBACK_DAYS
) -> Tuple[int, Optional[datetime]]:
    """
    Load recent news count and latest news date.

    Returns:
        Tuple of (count, latest_published_at)
    """
    cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

    # Get news linked to project
    links = db.table("shark_project_news").select(
        "news_id"
    ).eq("project_id", str(project_id)).execute()

    if not links.data:
        return 0, None

    news_ids = [link["news_id"] for link in links.data]

    # Count recent news and get latest date
    count = 0
    latest_date = None

    for news_id in news_ids:
        news = db.table("shark_news_items").select(
            "published_at"
        ).eq("id", news_id).execute()

        if news.data:
            pub_date_str = news.data[0].get("published_at")
            if pub_date_str:
                try:
                    pub_date = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))

                    # Update latest
                    if latest_date is None or pub_date > latest_date:
                        latest_date = pub_date

                    # Count if recent
                    cutoff_date = datetime.fromisoformat(cutoff)
                    if pub_date.tzinfo is None:
                        cutoff_date = cutoff_date.replace(tzinfo=None)
                    else:
                        if cutoff_date.tzinfo is None:
                            cutoff_date = cutoff_date.replace(tzinfo=pub_date.tzinfo)

                    if pub_date >= cutoff_date:
                        count += 1
                except ValueError:
                    pass

    return count, latest_date


async def load_project_people(
    project_id: UUID,
    db: Client
) -> Tuple[List[Dict[str, Any]], Optional[datetime]]:
    """
    Load people linked to project's organizations.

    Returns:
        Tuple of (people_list, latest_created_at)
    """
    # Get organizations linked to project
    org_links = db.table("shark_project_organizations").select(
        "organization_id"
    ).eq("project_id", str(project_id)).execute()

    if not org_links.data:
        return [], None

    org_ids = [link["organization_id"] for link in org_links.data]

    people = []
    latest_date = None

    for org_id in org_ids:
        # Get people linked to organization
        people_links = db.table("shark_organization_people").select(
            "person_id, role_in_org, ai_confidence, is_current, created_at"
        ).eq("organization_id", org_id).execute()

        if people_links.data:
            for link in people_links.data:
                # Only include current roles
                if link.get("is_current", True):
                    people.append({
                        "person_id": link.get("person_id"),
                        "role_in_org": link.get("role_in_org"),
                        "ai_confidence": link.get("ai_confidence"),
                    })

                    # Track latest date
                    created_at = link.get("created_at")
                    if created_at:
                        try:
                            dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                            if latest_date is None or dt > latest_date:
                                latest_date = dt
                        except ValueError:
                            pass

    return people, latest_date


# ============================================================
# MAIN SCORING FUNCTION
# ============================================================

async def compute_shark_score(
    project_id: UUID,
    tenant_id: UUID,
    db: Optional[Client] = None
) -> SharkScoreOutput:
    """
    Compute shark score for a project.

    Loads all signals, calculates score components, applies bonus/malus,
    updates the database, and returns the result.

    Args:
        project_id: Project UUID
        tenant_id: Tenant UUID
        db: Optional Supabase client (will create if not provided)

    Returns:
        SharkScoreOutput with score, priority, and details
    """
    if db is None:
        db = get_supabase()

    # Load project data
    project = await load_project_data(project_id, tenant_id, db)
    if not project:
        logger.warning(f"Project not found: {project_id}")
        return SharkScoreOutput(
            project_id=project_id,
            score=0,
            priority="LOW",
            details={"error": "Project not found"}
        )

    # Load related data
    orgs = await load_project_organizations(project_id, db)
    news_count, latest_news_date = await load_recent_news(project_id, db)
    people, latest_person_date = await load_project_people(project_id, db)
    tenders = await load_project_tenders(project_id, db)

    # Calculate score components
    project_phase = project.get("phase")
    phase_points = score_phase(project_phase)
    scale_points = score_scale(project.get("estimated_scale"))
    date_points, days_until_start = score_date_urgency(project.get("start_date_est"))
    news_points = score_news(news_count)
    org_points, org_breakdown = score_organizations(orgs)
    people_points, people_details = score_people(people)

    # Calculate public tenders score (appels d'offres)
    tender_points, tender_details = score_public_tenders(tenders, project_phase)

    # Calculate average AI confidence from orgs
    ai_confidences = [o.get("ai_confidence") or 0 for o in orgs if o.get("ai_confidence")]
    avg_ai_confidence = sum(ai_confidences) / len(ai_confidences) if ai_confidences else 0

    # Calculate bonus/malus
    bonus_points, malus_points, bonus_malus_details = calculate_bonus_malus(orgs, avg_ai_confidence)

    # Calculate time decay
    project_updated_at = project.get("updated_at")
    time_decay_penalty, time_decay_details = calculate_time_decay(
        project_updated_at, latest_news_date, latest_person_date
    )

    # Calculate raw total
    raw_total = (
        phase_points +
        scale_points +
        date_points +
        news_points +
        org_points +
        people_points +
        tender_points +  # Include tender bonus
        bonus_points +
        malus_points +
        time_decay_penalty
    )

    # Apply phase multiplier for appel_offres phase
    if project_phase and project_phase.lower() == "appel_offres" and tender_details.get("has_tender"):
        raw_total = int(raw_total * PHASE_APPEL_OFFRES_MULTIPLIER)

    # Clamp to 0-100
    final_score = max(0, min(100, raw_total))

    # Determine priority
    priority = calculate_priority(final_score)

    # Build details
    details = {
        "breakdown": {
            "phase": {"points": phase_points, "value": project_phase},
            "scale": {"points": scale_points, "value": project.get("estimated_scale")},
            "date_urgency": {"points": date_points, "days_until_start": days_until_start},
            "news": {"points": news_points, "count": news_count, "lookback_days": NEWS_LOOKBACK_DAYS},
            "organizations": {"points": org_points, "count": len(orgs), "breakdown": org_breakdown},
            "people": {"points": people_points, **people_details},
            "tenders": {"points": tender_points, **tender_details},
            "bonus": {"points": bonus_points},
            "malus": {"points": malus_points, **bonus_malus_details},
        },
        "time_decay": time_decay_details,
        "raw_total": raw_total,
        "final_score": final_score,
        "phase_multiplier_applied": project_phase and project_phase.lower() == "appel_offres" and tender_details.get("has_tender"),
    }

    # Update database
    try:
        db.table("shark_projects").update({
            "shark_score": final_score,
            "shark_priority": priority,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", str(project_id)).execute()

        logger.info(f"Updated shark_score for project {project_id}: {final_score} ({priority})")
    except Exception as e:
        logger.error(f"Failed to update shark_score for {project_id}: {e}")
        details["db_update_error"] = str(e)

    return SharkScoreOutput(
        project_id=project_id,
        score=final_score,
        priority=priority,
        details=details,
        updated_at=datetime.utcnow()
    )


# ============================================================
# BATCH SCORING FUNCTION
# ============================================================

async def compute_shark_scores_for_tenant(
    tenant_id: UUID,
    limit: Optional[int] = None,
    db: Optional[Client] = None
) -> List[SharkScoreOutput]:
    """
    Compute shark scores for all projects of a tenant.

    Args:
        tenant_id: Tenant UUID
        limit: Optional limit on number of projects to process
        db: Optional Supabase client

    Returns:
        List of SharkScoreOutput for each project
    """
    if db is None:
        db = get_supabase()

    # Load all projects for tenant
    query = db.table("shark_projects").select("id").eq(
        "tenant_id", str(tenant_id)
    )

    if limit:
        query = query.limit(limit)

    result = query.execute()

    if not result.data:
        logger.info(f"No projects found for tenant {tenant_id}")
        return []

    logger.info(f"Computing scores for {len(result.data)} projects (tenant: {tenant_id})")

    outputs = []
    for project_row in result.data:
        project_id = UUID(project_row["id"])
        try:
            output = await compute_shark_score(project_id, tenant_id, db)
            outputs.append(output)
        except Exception as e:
            logger.error(f"Failed to compute score for project {project_id}: {e}")
            outputs.append(SharkScoreOutput(
                project_id=project_id,
                score=0,
                priority="LOW",
                details={"error": str(e)}
            ))

    # Summary log
    scores = [o.score for o in outputs]
    priorities = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
    for o in outputs:
        priorities[o.priority] = priorities.get(o.priority, 0) + 1

    logger.info(
        f"Batch scoring complete: {len(outputs)} projects, "
        f"avg score: {sum(scores)/len(scores):.1f}, "
        f"priorities: {priorities}"
    )

    return outputs


# ============================================================
# UTILITY FUNCTIONS
# ============================================================

async def get_top_projects(
    tenant_id: UUID,
    limit: int = 10,
    min_priority: str = "MEDIUM",
    db: Optional[Client] = None
) -> List[Dict[str, Any]]:
    """
    Get top-scoring projects for a tenant.

    Args:
        tenant_id: Tenant UUID
        limit: Maximum number of projects to return
        min_priority: Minimum priority level (LOW, MEDIUM, HIGH, CRITICAL)
        db: Optional Supabase client

    Returns:
        List of project records with scores
    """
    if db is None:
        db = get_supabase()

    # Map priority to minimum score
    priority_min_scores = {
        "LOW": 0,
        "MEDIUM": PRIORITY_MEDIUM,
        "HIGH": PRIORITY_HIGH,
        "CRITICAL": PRIORITY_CRITICAL
    }

    min_score = priority_min_scores.get(min_priority, 0)

    result = db.table("shark_projects").select(
        "id, name, phase, estimated_scale, shark_score, shark_priority, location_city"
    ).eq("tenant_id", str(tenant_id)).gte(
        "shark_score", min_score
    ).order("shark_score", desc=True).limit(limit).execute()

    return result.data if result.data else []


async def recalculate_stale_scores(
    tenant_id: UUID,
    stale_days: int = 7,
    limit: int = 100,
    db: Optional[Client] = None
) -> List[SharkScoreOutput]:
    """
    Recalculate scores for projects not updated recently.

    Args:
        tenant_id: Tenant UUID
        stale_days: Days since last score update
        limit: Maximum projects to recalculate
        db: Optional Supabase client

    Returns:
        List of SharkScoreOutput for recalculated projects
    """
    if db is None:
        db = get_supabase()

    cutoff = (datetime.utcnow() - timedelta(days=stale_days)).isoformat()

    # Get projects with old scores
    result = db.table("shark_projects").select("id").eq(
        "tenant_id", str(tenant_id)
    ).lt("updated_at", cutoff).limit(limit).execute()

    if not result.data:
        logger.info(f"No stale projects found for tenant {tenant_id}")
        return []

    logger.info(f"Recalculating {len(result.data)} stale projects")

    outputs = []
    for row in result.data:
        project_id = UUID(row["id"])
        output = await compute_shark_score(project_id, tenant_id, db)
        outputs.append(output)

    return outputs
