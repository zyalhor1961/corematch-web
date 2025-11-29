"""
CoreMatch Python Models
========================

Pydantic models for the CoreMatch backend.

Modules:
    - shark_graph: Shark Hunter Project Graph entities
"""

from .shark_graph import (
    # Main entities
    SharkProject,
    SharkProjectCreate,
    SharkOrganization,
    SharkOrganizationCreate,
    SharkPerson,
    SharkPersonCreate,
    SharkNewsItem,
    SharkNewsItemCreate,
    # Junction entities
    SharkProjectOrganization,
    SharkOrganizationPerson,
    SharkProjectNews,
    # Enriched views
    SharkProjectFull,
    SharkOrganizationFull,
    SharkPersonFull,
    # Graph structures
    GraphNode,
    GraphEdge,
    ProjectGraph,
    # Types
    ProjectType,
    ProjectPhase,
    OrgType,
    RoleInProject,
    RoleInOrg,
)

__all__ = [
    # Main entities
    "SharkProject",
    "SharkProjectCreate",
    "SharkOrganization",
    "SharkOrganizationCreate",
    "SharkPerson",
    "SharkPersonCreate",
    "SharkNewsItem",
    "SharkNewsItemCreate",
    # Junction entities
    "SharkProjectOrganization",
    "SharkOrganizationPerson",
    "SharkProjectNews",
    # Enriched views
    "SharkProjectFull",
    "SharkOrganizationFull",
    "SharkPersonFull",
    # Graph structures
    "GraphNode",
    "GraphEdge",
    "ProjectGraph",
    # Types
    "ProjectType",
    "ProjectPhase",
    "OrgType",
    "RoleInProject",
    "RoleInOrg",
]
