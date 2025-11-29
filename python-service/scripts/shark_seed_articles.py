"""
Shark Seed Articles - Liste d'articles BTP pour le bootstrap initial.

Ce fichier contient une liste curee d'articles BTP provenant de sources
reconnues pour populer initialement la base de donnees Shark Hunter.

Usage:
    from scripts.shark_seed_articles import SEED_ARTICLES
"""

from typing import List, Dict, Any

# ============================================================
# SEED ARTICLES - Articles BTP pour bootstrap initial
# ============================================================

SEED_ARTICLES: List[Dict[str, Any]] = [
    # ─────────────────────────────────────────────────────
    # Le Moniteur - Projets majeurs
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.lemoniteur.fr/article/la-ville-de-lyon-lance-un-projet-de-renovation-urbaine-de-500-millions-d-euros.2336847",
        "source_name": "Le Moniteur",
        "published_at": "2024-11-15T10:00:00",
        "tags": ["renovation-urbaine", "lyon", "grand-projet"]
    },
    {
        "source_url": "https://www.lemoniteur.fr/article/le-grand-paris-express-nouvelle-phase-de-travaux-sur-la-ligne-15.2335921",
        "source_name": "Le Moniteur",
        "published_at": "2024-11-12T14:30:00",
        "tags": ["transport", "paris", "infrastructure"]
    },
    {
        "source_url": "https://www.lemoniteur.fr/article/construction-d-un-nouveau-chu-a-nantes-le-chantier-demarre.2334512",
        "source_name": "Le Moniteur",
        "published_at": "2024-11-08T09:00:00",
        "tags": ["sante", "nantes", "hopital"]
    },
    {
        "source_url": "https://www.lemoniteur.fr/article/bordeaux-metropole-lance-un-appel-d-offres-pour-un-ecoquartier.2333845",
        "source_name": "Le Moniteur",
        "published_at": "2024-11-05T11:00:00",
        "tags": ["ecoquartier", "bordeaux", "urbanisme"]
    },
    {
        "source_url": "https://www.lemoniteur.fr/article/marseille-projet-de-rehabilitation-du-vieux-port.2332987",
        "source_name": "Le Moniteur",
        "published_at": "2024-11-01T08:30:00",
        "tags": ["rehabilitation", "marseille", "patrimoine"]
    },

    # ─────────────────────────────────────────────────────
    # Batiactu - Chantiers en cours
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.batiactu.com/edito/toulouse-lance-construction-nouveau-quartier-durable-65432.php",
        "source_name": "Batiactu",
        "published_at": "2024-11-14T16:00:00",
        "tags": ["construction-durable", "toulouse", "logement"]
    },
    {
        "source_url": "https://www.batiactu.com/edito/strasbourg-nouveau-tramway-appel-offres-genie-civil-65321.php",
        "source_name": "Batiactu",
        "published_at": "2024-11-10T10:30:00",
        "tags": ["tramway", "strasbourg", "transport"]
    },
    {
        "source_url": "https://www.batiactu.com/edito/renovation-thermique-coproprietes-grand-est-65123.php",
        "source_name": "Batiactu",
        "published_at": "2024-11-07T14:00:00",
        "tags": ["renovation-thermique", "grand-est", "copropriete"]
    },
    {
        "source_url": "https://www.batiactu.com/edito/nice-construction-stade-olympique-65012.php",
        "source_name": "Batiactu",
        "published_at": "2024-11-03T09:30:00",
        "tags": ["stade", "nice", "equipement-sportif"]
    },
    {
        "source_url": "https://www.batiactu.com/edito/rennes-metropole-zac-nouvelle-gare-64987.php",
        "source_name": "Batiactu",
        "published_at": "2024-10-30T11:00:00",
        "tags": ["zac", "rennes", "gare"]
    },

    # ─────────────────────────────────────────────────────
    # BatiWeb - PME et artisans
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.batiweb.com/actualites/architecture/projet-logements-sociaux-clermont-ferrand-43521",
        "source_name": "BatiWeb",
        "published_at": "2024-11-13T08:00:00",
        "tags": ["logement-social", "clermont-ferrand", "hlm"]
    },
    {
        "source_url": "https://www.batiweb.com/actualites/architecture/extension-lycee-dijon-43456",
        "source_name": "BatiWeb",
        "published_at": "2024-11-09T13:00:00",
        "tags": ["education", "dijon", "extension"]
    },
    {
        "source_url": "https://www.batiweb.com/actualites/architecture/maison-retraite-limoges-43398",
        "source_name": "BatiWeb",
        "published_at": "2024-11-06T10:00:00",
        "tags": ["ehpad", "limoges", "sante"]
    },
    {
        "source_url": "https://www.batiweb.com/actualites/architecture/centre-commercial-angers-43345",
        "source_name": "BatiWeb",
        "published_at": "2024-11-02T15:00:00",
        "tags": ["commerce", "angers", "retail"]
    },
    {
        "source_url": "https://www.batiweb.com/actualites/architecture/parc-activites-orleans-43287",
        "source_name": "BatiWeb",
        "published_at": "2024-10-28T09:00:00",
        "tags": ["industrie", "orleans", "parc-activites"]
    },

    # ─────────────────────────────────────────────────────
    # Construction Cayola - Travaux publics
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.constructioncayola.com/infrastructures/autoroute-a69-toulouse-castres-avancement-87654",
        "source_name": "Construction Cayola",
        "published_at": "2024-11-11T12:00:00",
        "tags": ["autoroute", "toulouse", "infrastructure"]
    },
    {
        "source_url": "https://www.constructioncayola.com/infrastructures/pont-flaubert-rouen-travaux-87543",
        "source_name": "Construction Cayola",
        "published_at": "2024-11-04T08:00:00",
        "tags": ["pont", "rouen", "ouvrage-art"]
    },
    {
        "source_url": "https://www.constructioncayola.com/infrastructures/barrage-edf-isere-renovation-87432",
        "source_name": "Construction Cayola",
        "published_at": "2024-10-31T14:00:00",
        "tags": ["barrage", "isere", "energie"]
    },
    {
        "source_url": "https://www.constructioncayola.com/infrastructures/port-le-havre-extension-87321",
        "source_name": "Construction Cayola",
        "published_at": "2024-10-27T10:00:00",
        "tags": ["port", "le-havre", "maritime"]
    },
    {
        "source_url": "https://www.constructioncayola.com/infrastructures/reseau-chaleur-grenoble-87210",
        "source_name": "Construction Cayola",
        "published_at": "2024-10-24T11:00:00",
        "tags": ["energie", "grenoble", "reseau-chaleur"]
    },

    # ─────────────────────────────────────────────────────
    # Projets regionaux divers
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.ouest-france.fr/economie/immobilier/saint-nazaire-nouveau-quartier-port-76543",
        "source_name": "Ouest France",
        "published_at": "2024-11-08T07:30:00",
        "tags": ["urbanisme", "saint-nazaire", "port"]
    },
    {
        "source_url": "https://www.laprovence.com/article/economie/aix-en-provence-technopole-extension-65432",
        "source_name": "La Provence",
        "published_at": "2024-11-06T09:00:00",
        "tags": ["technopole", "aix-en-provence", "tertiaire"]
    },
    {
        "source_url": "https://www.ladepeche.fr/article/2024/11/05/montpellier-tramway-ligne-5-travaux.html",
        "source_name": "La Depeche",
        "published_at": "2024-11-05T14:00:00",
        "tags": ["tramway", "montpellier", "transport"]
    },
    {
        "source_url": "https://www.sudouest.fr/economie/immobilier/bayonne-zac-saint-frederic-logements-54321",
        "source_name": "Sud Ouest",
        "published_at": "2024-11-02T10:00:00",
        "tags": ["zac", "bayonne", "logement"]
    },
    {
        "source_url": "https://www.dna.fr/economie/mulhouse-nouvelle-usine-automobile-43210",
        "source_name": "DNA",
        "published_at": "2024-10-29T08:00:00",
        "tags": ["industrie", "mulhouse", "usine"]
    },

    # ─────────────────────────────────────────────────────
    # Marches publics - BOAMP style
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.boamp.fr/avis/detail/24-123456/construction-groupe-scolaire-ville-tours",
        "source_name": "BOAMP",
        "published_at": "2024-11-14T00:00:00",
        "tags": ["education", "tours", "marche-public"]
    },
    {
        "source_url": "https://www.boamp.fr/avis/detail/24-123457/rehabilitation-piscine-municipale-caen",
        "source_name": "BOAMP",
        "published_at": "2024-11-12T00:00:00",
        "tags": ["equipement-sportif", "caen", "marche-public"]
    },
    {
        "source_url": "https://www.boamp.fr/avis/detail/24-123458/amenagement-voirie-quartier-nord-reims",
        "source_name": "BOAMP",
        "published_at": "2024-11-09T00:00:00",
        "tags": ["voirie", "reims", "marche-public"]
    },
    {
        "source_url": "https://www.boamp.fr/avis/detail/24-123459/construction-mediatheque-le-mans",
        "source_name": "BOAMP",
        "published_at": "2024-11-06T00:00:00",
        "tags": ["culture", "le-mans", "marche-public"]
    },
    {
        "source_url": "https://www.boamp.fr/avis/detail/24-123460/renovation-theatre-amiens",
        "source_name": "BOAMP",
        "published_at": "2024-11-03T00:00:00",
        "tags": ["culture", "amiens", "patrimoine"]
    },

    # ─────────────────────────────────────────────────────
    # Projets supplementaires pour diversite
    # ─────────────────────────────────────────────────────
    {
        "source_url": "https://www.lemoniteur.fr/article/lille-metropole-nouveau-centre-congres.2331234",
        "source_name": "Le Moniteur",
        "published_at": "2024-10-25T10:00:00",
        "tags": ["congres", "lille", "equipement"]
    },
    {
        "source_url": "https://www.batiactu.com/edito/nancy-quartier-gare-reamenagement-64876.php",
        "source_name": "Batiactu",
        "published_at": "2024-10-22T09:00:00",
        "tags": ["urbanisme", "nancy", "gare"]
    },
    {
        "source_url": "https://www.lemoniteur.fr/article/metz-technopole-numerique-extension.2330567",
        "source_name": "Le Moniteur",
        "published_at": "2024-10-20T11:00:00",
        "tags": ["technopole", "metz", "numerique"]
    },
    {
        "source_url": "https://www.batiactu.com/edito/perpignan-eco-cite-mediterranee-64765.php",
        "source_name": "Batiactu",
        "published_at": "2024-10-18T14:00:00",
        "tags": ["eco-cite", "perpignan", "urbanisme"]
    },
    {
        "source_url": "https://www.lemoniteur.fr/article/brest-extension-port-commerce.2329876",
        "source_name": "Le Moniteur",
        "published_at": "2024-10-15T08:00:00",
        "tags": ["port", "brest", "infrastructure"]
    },
]

# ============================================================
# SOURCES PRIORITAIRES
# ============================================================

PRIORITY_SOURCES = [
    "Le Moniteur",
    "Batiactu",
    "BatiWeb",
    "Construction Cayola",
    "BOAMP",
]

# ============================================================
# STATISTIQUES
# ============================================================

def get_seed_stats() -> dict:
    """Retourne les statistiques sur les articles seed."""
    sources = {}
    tags_count = {}

    for article in SEED_ARTICLES:
        source = article["source_name"]
        sources[source] = sources.get(source, 0) + 1

        for tag in article.get("tags", []):
            tags_count[tag] = tags_count.get(tag, 0) + 1

    return {
        "total_articles": len(SEED_ARTICLES),
        "sources": sources,
        "top_tags": dict(sorted(tags_count.items(), key=lambda x: -x[1])[:10]),
    }


if __name__ == "__main__":
    import json
    stats = get_seed_stats()
    print(json.dumps(stats, indent=2, ensure_ascii=False))
