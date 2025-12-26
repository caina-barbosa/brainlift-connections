"""
BrainLift Connections - Simple API for extracting DOK sections from WorkFlowy
"""

import html
import json
import logging
import re
import uuid
from enum import Enum
from typing import Any

import aiohttp
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import storage

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


app = FastAPI(title="BrainLift Connections API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== Pydantic Models ==============

class DOKItem(BaseModel):
    """A single DOK item (SPOV, Insight, or Knowledge Tree node)"""
    index: int
    content: str
    children: list[str] = []


class DOKSection(BaseModel):
    """A DOK section with all its items"""
    raw: str
    items: list[DOKItem]


class BrainLiftSections(BaseModel):
    """All extracted sections from a BrainLift"""
    owners: str = ""
    purpose: str = ""
    experts: str = ""
    dok2_knowledge_tree: DOKSection | None = None
    dok3_insights: DOKSection | None = None
    dok4_spov: DOKSection | None = None


class ExtractRequest(BaseModel):
    url: str


class ExtractResponse(BaseModel):
    success: bool
    brainlift_id: str | None = None
    brainlift_name: str | None = None
    sections: BrainLiftSections | None = None
    error: str | None = None
    raw_markdown: str = ""


# ============== Connection Models ==============

class ConnectionType(str, Enum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"


class Connection(BaseModel):
    source_index: int
    target_index: int
    type: ConnectionType
    score: int = 0
    reasoning: str


class ConnectionAnalysis(BaseModel):
    dok2_to_dok3: list[Connection] = []
    dok3_to_dok4: list[Connection] = []


class BrainLiftSummary(BaseModel):
    id: str
    name: str
    created_at: str


class SavedBrainLift(BaseModel):
    id: str
    name: str
    url: str
    created_at: str
    sections: BrainLiftSections
    connections: ConnectionAnalysis | None = None


# ============== WorkFlowy Scraper ==============

class WorkflowyScraper:
    """Simple WorkFlowy scraper - extracts data from shared WorkFlowy links"""

    WORKFLOWY_URL = "https://workflowy.com"

    def __init__(self):
        self._session: aiohttp.ClientSession | None = None

    async def get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=30)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session

    async def close(self):
        if self._session:
            await self._session.close()
            self._session = None

    async def extract_share_id(self, url: str) -> tuple[str, str]:
        """Extract session ID and share ID from WorkFlowy URL"""
        session = await self.get_session()
        async with session.get(url) as response:
            response.raise_for_status()
            html_text = await response.text()

            cookie = response.cookies.get("sessionid")
            if not cookie:
                raise Exception("No session cookie found")

            match = re.search(r"PROJECT_TREE_DATA_URL_PARAMS = (\{.*?\});", html_text)
            if match:
                data = json.loads(match.group(1))
                return str(cookie.value), data.get("share_id")
            raise Exception("Could not find share ID in page")

    async def get_initial_data(self, session_id: str, share_id: str) -> list[str]:
        """Get initialization data to find root nodes"""
        url = f"{self.WORKFLOWY_URL}/get_initialization_data?share_id={share_id}&client_version=21&client_version_v2=28&no_root_children=1&include_main_tree=1"
        session = await self.get_session()
        async with session.get(url, headers={"Cookie": f"sessionid={session_id}"}) as response:
            response.raise_for_status()
            data = await response.json()

            # Extract root project IDs
            root_ids = []
            if "projectTreeData" in data:
                main_project_tree = data["projectTreeData"].get("mainProjectTreeInfo", {})
                root_id = main_project_tree.get("rootProjectChildren", [])
                if root_id:
                    root_ids = root_id
            return root_ids

    async def get_tree_data(self, session_id: str, share_id: str) -> list[dict[str, Any]]:
        """Get the full tree data"""
        url = f"{self.WORKFLOWY_URL}/get_tree_data/?share_id={share_id}"
        session = await self.get_session()
        async with session.get(url, headers={"Cookie": f"sessionid={session_id}"}) as response:
            response.raise_for_status()
            data = await response.json()
            items = data.get("items", [])

            # Filter out comment nodes
            filtered = [
                node for node in items
                if "cmnt" not in (node.get("metadata", {}).get("layoutMode") or "")
            ]
            return filtered

    def remove_html_tags(self, content: str) -> str:
        """Remove HTML tags and convert links to markdown"""
        # Remove mention tags
        content = re.sub(r"<mention[^>]*>[^<]*</mention>", "", content)

        # Convert links to markdown
        def replace_link(match):
            href = re.search(r'href=["\'](.*?)["\']', match.group(0))
            text = re.sub(r"<[^>]+>", "", match.group(0))
            if href:
                return f"[{text.strip()}]({href.group(1)})"
            return text.strip()

        content = re.sub(r"<a[^>]+>.*?</a>", replace_link, content)
        content = re.sub(r"<[^>]+>", "", content)
        # Decode HTML entities like &amp; -> &, &lt; -> <, etc.
        content = html.unescape(content)
        return content.strip()

    def build_tree(self, items: list[dict]) -> dict[str, dict]:
        """Build a tree structure from flat items list"""
        items_by_id = {item["id"]: {**item, "children": []} for item in items}
        tree = {}

        for item in items:
            parent_id = item.get("prnt")
            if parent_id and parent_id in items_by_id:
                items_by_id[parent_id]["children"].append(items_by_id[item["id"]])
            elif not parent_id:
                tree[item["id"]] = items_by_id[item["id"]]

        return tree

    def node_to_markdown(self, node: dict, level: int = 0) -> str:
        """Convert a node and its children to markdown"""
        indent = "  " * level
        name = self.remove_html_tags(node.get("nm", ""))
        note = self.remove_html_tags(node.get("no", ""))

        markdown = f"{indent}- {name}\n"
        if note:
            markdown += f"{indent}  {note}\n"

        for child in sorted(node.get("children", []), key=lambda x: x.get("pr", 0)):
            markdown += self.node_to_markdown(child, level + 1)

        return markdown

    async def scrape(self, url: str) -> tuple[list[dict], str]:
        """Scrape WorkFlowy URL and return items and markdown"""
        # Validate URL
        if "workflowy.com/s/" not in url:
            raise ValueError("Invalid WorkFlowy URL. Must be a shared link (workflowy.com/s/...)")

        session_id, share_id = await self.extract_share_id(url)
        items = await self.get_tree_data(session_id, share_id)

        # Clean up item names
        for item in items:
            if "nm" in item:
                item["nm"] = self.remove_html_tags(item["nm"])
            if "no" in item:
                item["no"] = self.remove_html_tags(item["no"])

        # Build tree and generate markdown
        tree = self.build_tree(items)
        markdown = ""
        for root_id, root_node in tree.items():
            markdown += self.node_to_markdown(root_node)

        return items, markdown


# ============== DOK Section Parser ==============

# Section name variants
SECTION_VARIANTS = {
    "owners": ["Owner", "Owners", "owner", "owners"],
    "purpose": ["Purpose", "purpose", "Mission", "mission"],
    "experts": ["Experts", "experts", "Expert", "expert"],
    "dok2": [
        "DOK2 - Knowledge Tree", "DOK2 - knowledge tree", "DOK2-Knowledge Tree",
        "DOK2", "Knowledge Tree", "knowledge tree", "DOK1 and DOK2", "DOK1/DOK2"
    ],
    "dok3": [
        "DOK3 - Insights", "DOK3-Insights", "DOK3 - insights",
        "DOK3", "Insights", "insights"
    ],
    "dok4": [
        "DOK4 - SPOV", "DOK4-SPOV", "DOK4 - SPOVs", "DOK4-SPOVs",
        "DOK4", "SPOV", "SPOVs", "SpikyPOVs", "Spiky POVs", "SpikyPOV"
    ],
}


def find_section_node(items: list[dict], section_variants: list[str]) -> dict | None:
    """Find a top-level node matching one of the section name variants"""
    # Find root node first
    root_id = None
    for item in items:
        if "prnt" not in item or item.get("prnt") is None:
            root_id = item["id"]
            break

    if not root_id:
        return None

    # Find direct children of root that match section names
    for item in items:
        if item.get("prnt") == root_id:
            name = item.get("nm", "").strip()
            for variant in section_variants:
                if variant.lower() in name.lower():
                    return item

    return None


def get_node_children(items: list[dict], parent_id: str) -> list[dict]:
    """Get all direct children of a node"""
    return [item for item in items if item.get("prnt") == parent_id]


def get_node_content_recursive(items: list[dict], node: dict, level: int = 0) -> str:
    """Get full content of a node and all its children as markdown"""
    indent = "  " * level
    name = node.get("nm", "").strip()
    note = node.get("no", "").strip() if node.get("no") else ""

    content = f"{indent}- {name}\n"
    if note:
        content += f"{indent}  {note}\n"

    children = get_node_children(items, node["id"])
    for child in sorted(children, key=lambda x: x.get("pr", 0)):
        content += get_node_content_recursive(items, child, level + 1)

    return content


def parse_dok_section(items: list[dict], section_node: dict) -> DOKSection:
    """Parse a DOK section into structured items"""
    # Get raw content
    raw = get_node_content_recursive(items, section_node)

    # Get direct children as DOK items
    children = get_node_children(items, section_node["id"])
    dok_items = []

    for idx, child in enumerate(sorted(children, key=lambda x: x.get("pr", 0))):
        name = child.get("nm", "").strip()
        note = child.get("no", "").strip() if child.get("no") else ""

        # Get sub-children content
        sub_children = get_node_children(items, child["id"])
        child_contents = []
        for sub in sorted(sub_children, key=lambda x: x.get("pr", 0)):
            sub_content = get_node_content_recursive(items, sub)
            child_contents.append(sub_content.strip())

        content = name
        if note:
            content += f"\n{note}"

        dok_items.append(DOKItem(
            index=idx + 1,
            content=content,
            children=child_contents
        ))

    return DOKSection(raw=raw, items=dok_items)


def extract_root_name(items: list[dict]) -> str:
    """Extract the name of the root node (BrainLift title)"""
    for item in items:
        if "prnt" not in item or item.get("prnt") is None:
            return item.get("nm", "Untitled BrainLift").strip()
    return "Untitled BrainLift"


def extract_sections(items: list[dict]) -> BrainLiftSections:
    """Extract all BrainLift sections from WorkFlowy items"""
    sections = BrainLiftSections()

    # Find and extract each section
    owners_node = find_section_node(items, SECTION_VARIANTS["owners"])
    if owners_node:
        sections.owners = get_node_content_recursive(items, owners_node)

    purpose_node = find_section_node(items, SECTION_VARIANTS["purpose"])
    if purpose_node:
        sections.purpose = get_node_content_recursive(items, purpose_node)

    experts_node = find_section_node(items, SECTION_VARIANTS["experts"])
    if experts_node:
        sections.experts = get_node_content_recursive(items, experts_node)

    dok2_node = find_section_node(items, SECTION_VARIANTS["dok2"])
    if dok2_node:
        sections.dok2_knowledge_tree = parse_dok_section(items, dok2_node)

    dok3_node = find_section_node(items, SECTION_VARIANTS["dok3"])
    if dok3_node:
        sections.dok3_insights = parse_dok_section(items, dok3_node)

    dok4_node = find_section_node(items, SECTION_VARIANTS["dok4"])
    if dok4_node:
        sections.dok4_spov = parse_dok_section(items, dok4_node)

    return sections


# ============== API Endpoints ==============

@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractResponse)
async def extract_brainlift(request: ExtractRequest):
    """Extract DOK sections from a WorkFlowy BrainLift URL and save to storage"""
    scraper = WorkflowyScraper()

    try:
        items, markdown = await scraper.scrape(request.url)
        sections = extract_sections(items)
        brainlift_name = extract_root_name(items)

        # Generate ID and save to storage
        brainlift_id = str(uuid.uuid4())[:8]
        storage.save_brainlift(
            brainlift_id=brainlift_id,
            name=brainlift_name,
            url=request.url,
            sections=sections.model_dump(),
        )

        logger.info(f"Saved brainlift '{brainlift_name}' with ID {brainlift_id}")

        return ExtractResponse(
            success=True,
            brainlift_id=brainlift_id,
            brainlift_name=brainlift_name,
            sections=sections,
            raw_markdown=markdown
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error extracting brainlift: {e}")
        return ExtractResponse(
            success=False,
            error=str(e)
        )
    finally:
        await scraper.close()


@app.get("/brainlifts", response_model=list[BrainLiftSummary])
async def list_brainlifts():
    """List all saved brainlifts"""
    return storage.list_brainlifts()


@app.get("/brainlifts/{brainlift_id}", response_model=SavedBrainLift)
async def get_brainlift(brainlift_id: str):
    """Get a saved brainlift by ID"""
    brainlift = storage.get_brainlift(brainlift_id)
    if not brainlift:
        raise HTTPException(status_code=404, detail="BrainLift not found")

    # Parse connections if they exist
    connections = None
    if brainlift.get("connections"):
        connections = ConnectionAnalysis(**brainlift["connections"])

    return SavedBrainLift(
        id=brainlift["id"],
        name=brainlift["name"],
        url=brainlift["url"],
        created_at=brainlift["created_at"],
        sections=BrainLiftSections(**brainlift["sections"]),
        connections=connections,
    )


@app.delete("/brainlifts/{brainlift_id}")
async def delete_brainlift(brainlift_id: str):
    """Delete a saved brainlift"""
    if not storage.delete_brainlift(brainlift_id):
        raise HTTPException(status_code=404, detail="BrainLift not found")
    return {"success": True}


@app.post("/brainlifts/{brainlift_id}/analyze", response_model=ConnectionAnalysis)
async def analyze_connections(brainlift_id: str, force: bool = False):
    """Analyze connections between DOK levels for a brainlift"""
    brainlift = storage.get_brainlift(brainlift_id)
    if not brainlift:
        raise HTTPException(status_code=404, detail="BrainLift not found")

    # Check if already analyzed (unless force=True)
    if brainlift.get("connections") and not force:
        logger.info(f"Returning cached connections for {brainlift_id}")
        return ConnectionAnalysis(**brainlift["connections"])

    # Import groq service here to avoid import error if GROQ_API_KEY not set
    try:
        from groq_service import GroqService
        groq = GroqService()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    sections = brainlift["sections"]

    # Get DOK items
    dok2_items = sections.get("dok2_knowledge_tree", {}).get("items", []) if sections.get("dok2_knowledge_tree") else []
    dok3_items = sections.get("dok3_insights", {}).get("items", []) if sections.get("dok3_insights") else []
    dok4_items = sections.get("dok4_spov", {}).get("items", []) if sections.get("dok4_spov") else []

    if not dok2_items and not dok3_items and not dok4_items:
        raise HTTPException(status_code=400, detail="No DOK sections found to analyze")

    logger.info(f"Analyzing connections for {brainlift_id}: DOK2={len(dok2_items)}, DOK3={len(dok3_items)}, DOK4={len(dok4_items)}")

    # Run analysis
    connections = await groq.analyze_all_connections(dok2_items, dok3_items, dok4_items)

    # Save results
    storage.save_connections(brainlift_id, connections)

    return ConnectionAnalysis(**connections)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
