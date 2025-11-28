"""
Smart Chunker - Polymorphic Document Chunking Service

Selects the optimal chunking strategy based on document type:
- INVOICE/QUOTATION: Preserve tables as single chunks
- CONTRACT: Semantic chunking respecting clause boundaries
- CV/RESUME: Header-based splitting for sections

Usage:
    from services.smart_chunker import SmartChunker

    chunker = SmartChunker()
    chunks = chunker.route_and_chunk(
        doc_type="INVOICE",
        text=document_text,
        azure_data=azure_extraction_result,
        metadata={"vendor": "Acme Corp", "date": "2024-01-15"}
    )
"""

import os
import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

# LangChain imports
from langchain_text_splitters import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
)

logger = logging.getLogger(__name__)


# =============================================================================
# DATA CLASSES
# =============================================================================

@dataclass
class EnrichedChunk:
    """A chunk with metadata context prepended."""
    content: str           # The enriched text (with context header)
    raw_content: str       # Original chunk text without header
    chunk_type: str        # 'table', 'text', 'section', 'clause'
    page_number: int       # Source page
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __str__(self):
        return self.content


# =============================================================================
# SMART CHUNKER CLASS
# =============================================================================

class SmartChunker:
    """
    Polymorphic document chunker that selects strategy based on document type.

    Strategies:
    - Financial (Invoice/PO): Preserve tables, split headers/footers
    - Legal (Contract/NDA): Semantic chunking by topic shift
    - HR (CV/Resume): Header-based section splitting
    - Generic: Recursive character splitting
    """

    # Chunk size configurations per strategy
    CHUNK_SIZES = {
        'financial': {'chunk_size': 500, 'chunk_overlap': 50},
        'legal': {'chunk_size': 1000, 'chunk_overlap': 100},
        'hr': {'chunk_size': 800, 'chunk_overlap': 80},
        'generic': {'chunk_size': 600, 'chunk_overlap': 60},
    }

    def __init__(self, openai_api_key: Optional[str] = None):
        """
        Initialize SmartChunker with optional OpenAI embeddings for semantic chunking.

        Args:
            openai_api_key: OpenAI API key. If not provided, uses env var.
        """
        self.openai_api_key = openai_api_key or os.getenv("OPENAI_API_KEY")
        self._embeddings = None
        self._semantic_chunker = None

        # Initialize recursive splitter (always available)
        self._recursive_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.CHUNK_SIZES['generic']['chunk_size'],
            chunk_overlap=self.CHUNK_SIZES['generic']['chunk_overlap'],
            separators=["\n\n", "\n", ". ", " ", ""],
            length_function=len,
        )

        # Markdown header splitter for structured documents
        self._markdown_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=[
                ("#", "section_h1"),
                ("##", "section_h2"),
                ("###", "section_h3"),
            ],
            strip_headers=False,  # Keep headers in content for context
        )

        logger.info("SmartChunker initialized")

    @property
    def embeddings(self):
        """Lazy-load OpenAI embeddings."""
        if self._embeddings is None and self.openai_api_key:
            try:
                from langchain_openai import OpenAIEmbeddings
                self._embeddings = OpenAIEmbeddings(
                    model="text-embedding-3-small",
                    openai_api_key=self.openai_api_key
                )
                logger.info("OpenAI embeddings initialized")
            except ImportError:
                logger.warning("langchain-openai not installed, semantic chunking unavailable")
            except Exception as e:
                logger.warning(f"Failed to initialize embeddings: {e}")
        return self._embeddings

    @property
    def semantic_chunker(self):
        """Lazy-load semantic chunker."""
        if self._semantic_chunker is None and self.embeddings:
            try:
                from langchain_experimental.text_splitter import SemanticChunker
                self._semantic_chunker = SemanticChunker(
                    self.embeddings,
                    breakpoint_threshold_type="percentile",
                    breakpoint_threshold_amount=85,  # Split at 85th percentile of similarity drop
                )
                logger.info("Semantic chunker initialized")
            except ImportError:
                logger.warning("langchain-experimental not installed, using fallback")
            except Exception as e:
                logger.warning(f"Failed to initialize semantic chunker: {e}")
        return self._semantic_chunker

    # =========================================================================
    # METADATA INJECTOR
    # =========================================================================

    def _enrich_chunk(
        self,
        chunk_text: str,
        metadata: Dict[str, Any],
        chunk_type: str = "text",
        page_number: int = 1
    ) -> EnrichedChunk:
        """
        Prepend context header to chunk for better vector search relevance.

        Format: [Doc: {type} | Vendor: {vendor} | Date: {date}]

        Args:
            chunk_text: Raw chunk content
            metadata: Document metadata (doc_type, vendor, date, etc.)
            chunk_type: Type of chunk ('table', 'text', 'section', 'clause')
            page_number: Source page number

        Returns:
            EnrichedChunk with context header prepended
        """
        # Build context parts
        context_parts = []

        if metadata.get('doc_type'):
            context_parts.append(f"Doc: {metadata['doc_type']}")

        if metadata.get('vendor') or metadata.get('vendor_name'):
            vendor = metadata.get('vendor') or metadata.get('vendor_name')
            context_parts.append(f"Vendor: {vendor}")

        if metadata.get('date') or metadata.get('invoice_date'):
            date = metadata.get('date') or metadata.get('invoice_date')
            context_parts.append(f"Date: {date}")

        if metadata.get('invoice_number'):
            context_parts.append(f"Ref: {metadata['invoice_number']}")

        if metadata.get('total_amount'):
            context_parts.append(f"Total: {metadata['total_amount']}")

        # Build header
        if context_parts:
            context_header = f"[{' | '.join(context_parts)}]"
            enriched_content = f"{context_header}\n{chunk_text}"
        else:
            enriched_content = chunk_text

        return EnrichedChunk(
            content=enriched_content,
            raw_content=chunk_text,
            chunk_type=chunk_type,
            page_number=page_number,
            metadata={**metadata, 'chunk_type': chunk_type}
        )

    # =========================================================================
    # STRATEGY A: FINANCIAL (Invoices, Purchase Orders, Quotations)
    # =========================================================================

    def _chunk_financial(
        self,
        text: str,
        azure_tables: Optional[List[Dict]] = None,
        metadata: Dict[str, Any] = None
    ) -> List[EnrichedChunk]:
        """
        Chunk financial documents preserving table integrity.

        Strategy:
        1. Convert Azure tables to Markdown (keep as single chunks)
        2. Split remaining text (headers/footers) with RecursiveCharacterTextSplitter

        Args:
            text: Full document text
            azure_tables: List of tables from Azure extraction
            metadata: Document metadata for enrichment

        Returns:
            List of EnrichedChunks
        """
        metadata = metadata or {}
        chunks = []
        table_texts = set()  # Track table content to exclude from text splitting

        # Step 1: Process Azure tables as single chunks
        if azure_tables:
            for table_idx, table in enumerate(azure_tables):
                markdown_table = self._table_to_markdown(table)
                if markdown_table:
                    table_texts.add(markdown_table)
                    page_num = table.get('page_number', 1)

                    # Add table as single chunk
                    chunks.append(self._enrich_chunk(
                        markdown_table,
                        {**metadata, 'table_index': table_idx},
                        chunk_type='table',
                        page_number=page_num
                    ))
                    logger.debug(f"Added table chunk {table_idx} from page {page_num}")

        # Step 2: Split remaining text (exclude table content)
        remaining_text = text
        for table_text in table_texts:
            # Remove table content from main text (approximate match)
            remaining_text = remaining_text.replace(table_text, '')

        # Clean up excessive whitespace
        remaining_text = re.sub(r'\n{3,}', '\n\n', remaining_text).strip()

        if remaining_text:
            # Use smaller chunks for financial headers/footers
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.CHUNK_SIZES['financial']['chunk_size'],
                chunk_overlap=self.CHUNK_SIZES['financial']['chunk_overlap'],
                separators=["\n\n", "\n", ". ", " "],
            )
            text_chunks = splitter.split_text(remaining_text)

            for chunk in text_chunks:
                if chunk.strip():
                    chunks.append(self._enrich_chunk(
                        chunk.strip(),
                        metadata,
                        chunk_type='text',
                        page_number=1
                    ))

        logger.info(f"Financial chunking: {len(chunks)} chunks ({len(azure_tables or [])} tables)")
        return chunks

    def _table_to_markdown(self, table: Dict) -> Optional[str]:
        """
        Convert Azure table extraction to Markdown format.

        Args:
            table: Azure table dict with 'cells' or 'rows' structure

        Returns:
            Markdown table string or None
        """
        # Handle different Azure table formats
        cells = table.get('cells', [])
        rows = table.get('rows', [])

        if cells:
            return self._cells_to_markdown(cells, table.get('row_count', 0), table.get('column_count', 0))
        elif rows:
            return self._rows_to_markdown(rows)
        elif table.get('content'):
            # Raw content fallback
            return f"```\n{table['content']}\n```"

        return None

    def _cells_to_markdown(self, cells: List[Dict], row_count: int, col_count: int) -> str:
        """Convert cell-based table to Markdown."""
        if not cells or row_count == 0 or col_count == 0:
            return ""

        # Build grid
        grid = [["" for _ in range(col_count)] for _ in range(row_count)]

        for cell in cells:
            row_idx = cell.get('row_index', 0)
            col_idx = cell.get('column_index', 0)
            content = cell.get('content', cell.get('value', ''))

            if 0 <= row_idx < row_count and 0 <= col_idx < col_count:
                grid[row_idx][col_idx] = str(content).strip()

        # Build Markdown
        lines = []
        for row_idx, row in enumerate(grid):
            line = "| " + " | ".join(row) + " |"
            lines.append(line)

            # Add header separator after first row
            if row_idx == 0:
                separator = "|" + "|".join(["---" for _ in row]) + "|"
                lines.append(separator)

        return "\n".join(lines)

    def _rows_to_markdown(self, rows: List[Dict]) -> str:
        """Convert row-based table to Markdown."""
        if not rows:
            return ""

        lines = []
        for row_idx, row in enumerate(rows):
            cells = row.get('cells', row.get('content', []))
            if isinstance(cells, str):
                cells = [cells]
            elif isinstance(cells, list):
                cells = [str(c.get('content', c) if isinstance(c, dict) else c) for c in cells]

            line = "| " + " | ".join(cells) + " |"
            lines.append(line)

            if row_idx == 0:
                separator = "|" + "|".join(["---" for _ in cells]) + "|"
                lines.append(separator)

        return "\n".join(lines)

    # =========================================================================
    # STRATEGY B: LEGAL (Contracts, NDAs, Terms)
    # =========================================================================

    def _chunk_legal(
        self,
        text: str,
        metadata: Dict[str, Any] = None
    ) -> List[EnrichedChunk]:
        """
        Chunk legal documents using semantic similarity.

        Strategy:
        - Use SemanticChunker to split at topic boundaries
        - Falls back to clause-based splitting if semantic unavailable

        Goal: Keep "Definitions" separate from "Liability" sections

        Args:
            text: Full document text
            metadata: Document metadata for enrichment

        Returns:
            List of EnrichedChunks
        """
        metadata = metadata or {}
        chunks = []

        # Try semantic chunking first
        if self.semantic_chunker:
            try:
                semantic_chunks = self.semantic_chunker.split_text(text)

                for idx, chunk in enumerate(semantic_chunks):
                    if chunk.strip():
                        chunks.append(self._enrich_chunk(
                            chunk.strip(),
                            {**metadata, 'clause_index': idx},
                            chunk_type='clause',
                            page_number=1
                        ))

                logger.info(f"Legal semantic chunking: {len(chunks)} clauses")
                return chunks

            except Exception as e:
                logger.warning(f"Semantic chunking failed: {e}, using fallback")

        # Fallback: Article/Section-based splitting
        return self._chunk_legal_fallback(text, metadata)

    def _chunk_legal_fallback(
        self,
        text: str,
        metadata: Dict[str, Any]
    ) -> List[EnrichedChunk]:
        """
        Fallback legal chunking using regex patterns for articles/sections.
        """
        chunks = []

        # Common legal document patterns
        # Matches: "Article 1", "ARTICLE I", "Section 2.1", "CLAUSE 3", etc.
        section_pattern = r'(?:^|\n)(?:Article|ARTICLE|Section|SECTION|Clause|CLAUSE|CHAPITRE|Chapitre)\s*[\dIVXivx]+[\.\:]?'

        # Split by section headers
        sections = re.split(section_pattern, text)
        headers = re.findall(section_pattern, text)

        if len(sections) > 1:
            # Process each section
            for idx, section in enumerate(sections):
                if not section.strip():
                    continue

                # Prepend header if available
                section_text = section.strip()
                if idx > 0 and idx - 1 < len(headers):
                    section_text = headers[idx - 1].strip() + "\n" + section_text

                # Further split if section is too large
                if len(section_text) > self.CHUNK_SIZES['legal']['chunk_size'] * 2:
                    splitter = RecursiveCharacterTextSplitter(
                        chunk_size=self.CHUNK_SIZES['legal']['chunk_size'],
                        chunk_overlap=self.CHUNK_SIZES['legal']['chunk_overlap'],
                    )
                    sub_chunks = splitter.split_text(section_text)
                    for sub_idx, sub_chunk in enumerate(sub_chunks):
                        chunks.append(self._enrich_chunk(
                            sub_chunk.strip(),
                            {**metadata, 'section_index': idx, 'sub_index': sub_idx},
                            chunk_type='clause',
                            page_number=1
                        ))
                else:
                    chunks.append(self._enrich_chunk(
                        section_text,
                        {**metadata, 'section_index': idx},
                        chunk_type='clause',
                        page_number=1
                    ))
        else:
            # No clear sections, use recursive splitting
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.CHUNK_SIZES['legal']['chunk_size'],
                chunk_overlap=self.CHUNK_SIZES['legal']['chunk_overlap'],
            )
            text_chunks = splitter.split_text(text)
            for idx, chunk in enumerate(text_chunks):
                chunks.append(self._enrich_chunk(
                    chunk.strip(),
                    {**metadata, 'chunk_index': idx},
                    chunk_type='text',
                    page_number=1
                ))

        logger.info(f"Legal fallback chunking: {len(chunks)} chunks")
        return chunks

    # =========================================================================
    # STRATEGY C: HR (CVs, Resumes)
    # =========================================================================

    def _chunk_hr(
        self,
        text: str,
        metadata: Dict[str, Any] = None
    ) -> List[EnrichedChunk]:
        """
        Chunk HR documents (CVs/Resumes) preserving section integrity.

        Strategy:
        - Detect headers (Experience, Education, Skills)
        - Use MarkdownHeaderTextSplitter if markdown-like
        - Fallback to section-based regex splitting

        Goal: Keep "Experience" and "Education" blocks intact

        Args:
            text: Full document text
            metadata: Document metadata for enrichment

        Returns:
            List of EnrichedChunks
        """
        metadata = metadata or {}
        chunks = []

        # Common CV section headers (French + English)
        cv_sections = [
            # French
            r'(?:^|\n)(?:EXPÉRIENCE|EXPERIENCE|Expérience|Experience)s?\s*(?:PROFESSIONNELLE|Professionnelle)?s?\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:FORMATION|Formation|ÉDUCATION|Éducation|Education)s?\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:COMPÉTENCES|Compétences|SKILLS|Skills|COMPETENCES)s?\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:LANGUES|Langues|LANGUAGES|Languages)\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:CENTRES D\'INTÉRÊT|Centres d\'intérêt|INTERESTS|Interests|HOBBIES|Hobbies)\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:PROFIL|Profil|PROFILE|Profile|RÉSUMÉ|Résumé|SUMMARY|Summary)\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:CERTIFICATIONS?|Certifications?)\s*[\:\-]?\s*\n',
            r'(?:^|\n)(?:PROJETS?|Projets?|PROJECTS?|Projects?)\s*[\:\-]?\s*\n',
        ]

        # Combined pattern
        combined_pattern = '|'.join(cv_sections)

        # Find all section starts
        matches = list(re.finditer(combined_pattern, text, re.IGNORECASE))

        if matches:
            # Extract sections based on header positions
            for idx, match in enumerate(matches):
                start = match.start()
                end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)

                section_text = text[start:end].strip()

                if section_text:
                    # Extract section name from header
                    header_match = re.match(r'[\n]*([\w\s\'\-]+)', section_text)
                    section_name = header_match.group(1).strip() if header_match else f"Section {idx}"

                    chunks.append(self._enrich_chunk(
                        section_text,
                        {**metadata, 'section_name': section_name, 'section_index': idx},
                        chunk_type='section',
                        page_number=1
                    ))

            # Handle text before first section (usually personal info)
            if matches and matches[0].start() > 50:
                preamble = text[:matches[0].start()].strip()
                if preamble:
                    chunks.insert(0, self._enrich_chunk(
                        preamble,
                        {**metadata, 'section_name': 'Personal Info'},
                        chunk_type='section',
                        page_number=1
                    ))
        else:
            # No clear sections detected, use recursive splitting
            splitter = RecursiveCharacterTextSplitter(
                chunk_size=self.CHUNK_SIZES['hr']['chunk_size'],
                chunk_overlap=self.CHUNK_SIZES['hr']['chunk_overlap'],
            )
            text_chunks = splitter.split_text(text)

            for idx, chunk in enumerate(text_chunks):
                chunks.append(self._enrich_chunk(
                    chunk.strip(),
                    {**metadata, 'chunk_index': idx},
                    chunk_type='text',
                    page_number=1
                ))

        logger.info(f"HR chunking: {len(chunks)} sections")
        return chunks

    # =========================================================================
    # STRATEGY D: GENERIC (Default fallback)
    # =========================================================================

    def _chunk_generic(
        self,
        text: str,
        metadata: Dict[str, Any] = None
    ) -> List[EnrichedChunk]:
        """
        Generic chunking for unclassified documents.

        Uses RecursiveCharacterTextSplitter with sensible defaults.
        """
        metadata = metadata or {}
        chunks = []

        text_chunks = self._recursive_splitter.split_text(text)

        for idx, chunk in enumerate(text_chunks):
            if chunk.strip():
                chunks.append(self._enrich_chunk(
                    chunk.strip(),
                    {**metadata, 'chunk_index': idx},
                    chunk_type='text',
                    page_number=1
                ))

        logger.info(f"Generic chunking: {len(chunks)} chunks")
        return chunks

    # =========================================================================
    # ROUTER (Main Entry Point)
    # =========================================================================

    def route_and_chunk(
        self,
        doc_type: str,
        text: str,
        azure_data: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> List[EnrichedChunk]:
        """
        Route document to appropriate chunking strategy based on type.

        Args:
            doc_type: Document type (INVOICE, QUOTATION, CONTRACT, CV, etc.)
            text: Full document text
            azure_data: Optional Azure extraction data (contains tables, fields)
            metadata: Document metadata for chunk enrichment

        Returns:
            List of EnrichedChunks ready for embedding

        Example:
            >>> chunker = SmartChunker()
            >>> chunks = chunker.route_and_chunk(
            ...     doc_type="INVOICE",
            ...     text=doc_text,
            ...     azure_data=extraction_result,
            ...     metadata={"vendor": "Acme Corp", "date": "2024-01-15"}
            ... )
        """
        if not text or not text.strip():
            logger.warning("Empty text provided to chunker")
            return []

        # Normalize doc_type
        doc_type_upper = (doc_type or "").upper().strip()

        # Build metadata with doc_type
        full_metadata = {
            'doc_type': doc_type_upper,
            **(metadata or {})
        }

        # Extract tables from Azure data if available
        azure_tables = None
        if azure_data:
            # Try different Azure table formats
            azure_tables = (
                azure_data.get('tables') or
                azure_data.get('_metadata', {}).get('tables') or
                azure_data.get('Items', {}).get('value')  # Line items as pseudo-table
            )

            # Extract metadata fields from Azure if not provided
            if not full_metadata.get('vendor'):
                vendor_field = azure_data.get('VendorName') or azure_data.get('vendor_name')
                if isinstance(vendor_field, dict):
                    full_metadata['vendor'] = vendor_field.get('value')
                elif vendor_field:
                    full_metadata['vendor'] = vendor_field

            if not full_metadata.get('date'):
                date_field = azure_data.get('InvoiceDate') or azure_data.get('invoice_date')
                if isinstance(date_field, dict):
                    full_metadata['date'] = date_field.get('value')
                elif date_field:
                    full_metadata['date'] = date_field

        # Route to appropriate strategy
        logger.info(f"Routing document type '{doc_type_upper}' to chunker")

        if doc_type_upper in ('INVOICE', 'QUOTATION', 'QUOTE', 'DEVIS', 'FACTURE', 'PURCHASE_ORDER', 'PO'):
            return self._chunk_financial(text, azure_tables, full_metadata)

        elif doc_type_upper in ('CONTRACT', 'CONTRAT', 'NDA', 'AGREEMENT', 'TERMS', 'CGV', 'CGU'):
            return self._chunk_legal(text, full_metadata)

        elif doc_type_upper in ('CV', 'RESUME', 'CURRICULUM', 'CANDIDATURE'):
            return self._chunk_hr(text, full_metadata)

        elif doc_type_upper in ('BANK_STATEMENT', 'RELEVE', 'RELEVE_BANCAIRE'):
            # Bank statements are similar to financial - preserve tables
            return self._chunk_financial(text, azure_tables, full_metadata)

        else:
            # Default to generic chunking
            logger.info(f"Unknown doc_type '{doc_type_upper}', using generic chunker")
            return self._chunk_generic(text, full_metadata)

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def chunks_to_texts(self, chunks: List[EnrichedChunk]) -> List[str]:
        """Convert EnrichedChunks to plain text list for embedding."""
        return [chunk.content for chunk in chunks]

    def chunks_to_documents(self, chunks: List[EnrichedChunk]) -> List[Dict]:
        """
        Convert EnrichedChunks to LangChain Document-like dicts.

        Returns:
            List of dicts with 'page_content' and 'metadata'
        """
        return [
            {
                'page_content': chunk.content,
                'metadata': {
                    **chunk.metadata,
                    'chunk_type': chunk.chunk_type,
                    'page_number': chunk.page_number,
                    'raw_content': chunk.raw_content,
                }
            }
            for chunk in chunks
        ]


# =============================================================================
# CONVENIENCE FUNCTION
# =============================================================================

def smart_chunk_document(
    doc_type: str,
    text: str,
    azure_data: Optional[Dict] = None,
    metadata: Optional[Dict] = None,
    openai_api_key: Optional[str] = None
) -> List[Dict]:
    """
    Convenience function for one-shot document chunking.

    Returns list of LangChain Document-like dicts ready for vector store.

    Example:
        >>> docs = smart_chunk_document(
        ...     doc_type="CONTRACT",
        ...     text=contract_text,
        ...     metadata={"title": "Service Agreement"}
        ... )
        >>> # docs can be passed directly to vector store
        >>> vector_store.add_documents(docs)
    """
    chunker = SmartChunker(openai_api_key=openai_api_key)
    chunks = chunker.route_and_chunk(doc_type, text, azure_data, metadata)
    return chunker.chunks_to_documents(chunks)


# =============================================================================
# TESTING
# =============================================================================

if __name__ == "__main__":
    # Quick test
    logging.basicConfig(level=logging.INFO)

    chunker = SmartChunker()

    # Test invoice with table
    invoice_text = """
    FACTURE N° F-2024-001
    Date: 15/01/2024

    Client: Acme Corporation

    | Qty | Description | Unit Price | Total |
    |-----|-------------|------------|-------|
    | 10  | Widget A    | 50.00      | 500.00|
    | 5   | Widget B    | 100.00     | 500.00|

    Sous-total HT: 1000.00 EUR
    TVA (20%): 200.00 EUR
    Total TTC: 1200.00 EUR
    """

    chunks = chunker.route_and_chunk(
        doc_type="INVOICE",
        text=invoice_text,
        metadata={"vendor": "Widget Corp", "invoice_number": "F-2024-001"}
    )

    print(f"\n=== Invoice Chunks ({len(chunks)}) ===")
    for i, chunk in enumerate(chunks):
        print(f"\n--- Chunk {i} ({chunk.chunk_type}) ---")
        print(chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content)

    # Test contract
    contract_text = """
    CONTRAT DE PRESTATION DE SERVICES

    Entre les soussignés:
    - La société ABC, ci-après "le Prestataire"
    - La société XYZ, ci-après "le Client"

    Article 1: Objet du contrat
    Le présent contrat a pour objet de définir les conditions...

    Article 2: Durée
    Le contrat est conclu pour une durée de 12 mois...

    Article 3: Prix et paiement
    Le prix des prestations est fixé à 10 000 EUR...

    Article 4: Responsabilité
    Le Prestataire s'engage à exécuter les prestations...
    """

    chunks = chunker.route_and_chunk(
        doc_type="CONTRACT",
        text=contract_text,
        metadata={"title": "Contrat de prestation"}
    )

    print(f"\n=== Contract Chunks ({len(chunks)}) ===")
    for i, chunk in enumerate(chunks):
        print(f"\n--- Chunk {i} ({chunk.chunk_type}) ---")
        print(chunk.content[:200] + "..." if len(chunk.content) > 200 else chunk.content)
