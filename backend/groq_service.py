"""
Groq LLM service for analyzing DOK connections
"""

import asyncio
import json
import logging
import os
import re
from collections import defaultdict
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from groq import AsyncGroq

# Load .env file
load_dotenv(Path(__file__).parent / ".env")

logger = logging.getLogger(__name__)

# Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "qwen/qwen3-32b"
MAX_CONCURRENT_REQUESTS = 5
MAX_CONNECTIONS_PER_NODE = 2  # Limit connections per node


# Prompt for finding which DOK2s a DOK3 draws from (including contradictions)
DOK3_TO_DOK2_PROMPT = """You analyze knowledge documents. Given a DOK3 Insight, identify which DOK2 items have a DIRECT relationship.

DOK3 INSIGHT:
{dok3_content}

DOK2 KNOWLEDGE ITEMS:
{dok2_list}

Instructions:
- Pick AT MOST 1 DOK2 item that DIRECTLY relates to this insight
- A relationship can be:
  - SUPPORTS: The DOK2 provides evidence/foundation for the insight
  - CONTRADICTS: The DOK2 challenges or conflicts with the insight
- Only pick if there's a SPECIFIC, DIRECT connection (not thematic similarity)
- If nothing strongly connects, return empty

Respond ONLY with JSON:
{{"connections": [{{"id": 1, "type": "supports"}}]}} or {{"connections": [{{"id": 2, "type": "contradicts"}}]}} or {{"connections": []}} /no_think"""


# Prompt for finding which DOK3s a DOK4 builds on
DOK4_TO_DOK3_PROMPT = """You analyze knowledge documents. Given a DOK4 Spiky POV, identify which DOK3 Insights have a DIRECT relationship.

DOK4 SPIKY POV:
{dok4_content}

DOK3 INSIGHTS:
{dok3_list}

Instructions:
- Pick AT MOST 1 DOK3 insight that DIRECTLY relates to this SPOV
- A relationship can be:
  - SUPPORTS: The insight provides foundation for this SPOV
  - CONTRADICTS: The insight challenges or conflicts with this SPOV
- Only pick if there's a SPECIFIC, DIRECT connection (not thematic similarity)
- If nothing strongly connects, return empty

Respond ONLY with JSON:
{{"connections": [{{"id": 1, "type": "supports"}}]}} or {{"connections": [{{"id": 2, "type": "contradicts"}}]}} or {{"connections": []}} /no_think"""


class GroqService:
    """Service for analyzing DOK connections using Groq LLM"""

    def __init__(self):
        if not GROQ_API_KEY:
            raise ValueError("GROQ_API_KEY environment variable is required")
        self.client = AsyncGroq(api_key=GROQ_API_KEY)
        self.semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async def _call_llm(self, prompt: str) -> dict[str, Any] | None:
        """Make a single LLM call with rate limiting"""
        async with self.semaphore:
            try:
                response = await self.client.chat.completions.create(
                    model=GROQ_MODEL,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1,
                    max_tokens=150,
                )

                content = response.choices[0].message.content
                if not content:
                    logger.warning("LLM returned empty content")
                    return None

                content = content.strip()

                # Remove <think>...</think> blocks if present
                content = re.sub(
                    r"<think>.*?</think>", "", content, flags=re.DOTALL
                ).strip()

                # Clean up markdown code blocks
                if content.startswith("```"):
                    parts = content.split("```")
                    if len(parts) >= 2:
                        content = parts[1]
                        if content.startswith("json"):
                            content = content[4:]
                        content = content.strip()

                # Try to find JSON in the response
                if not content.startswith("{"):
                    match = re.search(r"\{.*\}", content, re.DOTALL)
                    if match:
                        content = match.group(0)

                if not content:
                    logger.warning("No content after cleaning")
                    return None

                result = json.loads(content)
                return result

            except json.JSONDecodeError as e:
                logger.warning(
                    f"Failed to parse LLM response: {e}, content: {content[:100] if content else 'empty'}"
                )
                return None
            except Exception as e:
                logger.error(f"LLM call failed: {e}")
                return None

    def _build_item_content(self, item: dict[str, Any]) -> str:
        """Build content string for a DOK item"""
        content = item.get("content", "")
        children = item.get("children", [])
        if children:
            content += "\n  Sub-items: "
            # Just mention count, don't include full content to save tokens
            content += f"({len(children)} items)"
        return content.strip()

    def _build_numbered_list(self, items: list[dict[str, Any]]) -> str:
        """Build a numbered list of items for the prompt"""
        lines = []
        for item in items:
            idx = item.get("index", 0)
            content = self._build_item_content(item)
            if len(content) > 200:
                content = content[:200] + "..."
            lines.append(f"{idx}. {content}")
        return "\n\n".join(lines)

    async def find_dok2_connections_for_dok3(
        self,
        dok3_item: dict[str, Any],
        dok2_items: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Find which DOK2 items a DOK3 insight relates to"""
        if not dok2_items:
            return []

        prompt = DOK3_TO_DOK2_PROMPT.format(
            dok3_content=self._build_item_content(dok3_item),
            dok2_list=self._build_numbered_list(dok2_items),
        )

        result = await self._call_llm(prompt)

        if result and "connections" in result:
            connections = result["connections"]
            if isinstance(connections, list):
                valid_indices = {item["index"] for item in dok2_items}
                valid_connections = []
                for conn in connections:
                    if isinstance(conn, dict) and conn.get("id") in valid_indices:
                        valid_connections.append(
                            {"id": conn["id"], "type": conn.get("type", "supports")}
                        )
                return valid_connections[:1]  # Enforce max 1

        return []

    async def find_dok3_connections_for_dok4(
        self,
        dok4_item: dict[str, Any],
        dok3_items: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Find which DOK3 insights a DOK4 SPOV relates to"""
        if not dok3_items:
            return []

        prompt = DOK4_TO_DOK3_PROMPT.format(
            dok4_content=self._build_item_content(dok4_item),
            dok3_list=self._build_numbered_list(dok3_items),
        )

        result = await self._call_llm(prompt)

        if result and "connections" in result:
            connections = result["connections"]
            if isinstance(connections, list):
                valid_indices = {item["index"] for item in dok3_items}
                valid_connections = []
                for conn in connections:
                    if isinstance(conn, dict) and conn.get("id") in valid_indices:
                        valid_connections.append(
                            {"id": conn["id"], "type": conn.get("type", "supports")}
                        )
                return valid_connections[:1]  # Enforce max 1

        return []

    def _limit_connections_per_node(
        self,
        connections: list[dict[str, Any]],
        key: str,
    ) -> list[dict[str, Any]]:
        """Limit connections so no node has more than MAX_CONNECTIONS_PER_NODE"""
        # Count connections per node
        node_counts = defaultdict(int)
        limited = []

        for conn in connections:
            node_id = conn[key]
            if node_counts[node_id] < MAX_CONNECTIONS_PER_NODE:
                limited.append(conn)
                node_counts[node_id] += 1

        return limited

    async def analyze_all_connections(
        self,
        dok2_items: list[dict[str, Any]],
        dok3_items: list[dict[str, Any]],
        dok4_items: list[dict[str, Any]],
    ) -> dict[str, list[dict[str, Any]]]:
        """
        Analyze all connections between DOK levels.
        """
        dok2_to_dok3 = []
        dok3_to_dok4 = []

        # For each DOK3, find which DOK2s it connects to
        if dok3_items and dok2_items:
            logger.info(f"Finding DOK2 connections for {len(dok3_items)} DOK3 items...")

            results = await asyncio.gather(
                *[
                    self.find_dok2_connections_for_dok3(dok3, dok2_items)
                    for dok3 in dok3_items
                ]
            )

            for dok3, connections in zip(dok3_items, results):
                for conn in connections:
                    dok2_to_dok3.append(
                        {
                            "source_index": conn["id"],
                            "target_index": dok3["index"],
                            "type": conn["type"],
                            "score": 95,
                            "reasoning": f"Direct {'support' if conn['type'] == 'supports' else 'contradiction'} identified",
                        }
                    )

        # For each DOK4, find which DOK3s it connects to
        if dok4_items and dok3_items:
            logger.info(f"Finding DOK3 connections for {len(dok4_items)} DOK4 items...")

            results = await asyncio.gather(
                *[
                    self.find_dok3_connections_for_dok4(dok4, dok3_items)
                    for dok4 in dok4_items
                ]
            )

            for dok4, connections in zip(dok4_items, results):
                for conn in connections:
                    dok3_to_dok4.append(
                        {
                            "source_index": conn["id"],
                            "target_index": dok4["index"],
                            "type": conn["type"],
                            "score": 95,
                            "reasoning": f"Direct {'support' if conn['type'] == 'supports' else 'contradiction'} identified",
                        }
                    )

        # Limit connections per node (from both directions)
        dok2_to_dok3 = self._limit_connections_per_node(dok2_to_dok3, "source_index")
        dok2_to_dok3 = self._limit_connections_per_node(dok2_to_dok3, "target_index")
        dok3_to_dok4 = self._limit_connections_per_node(dok3_to_dok4, "source_index")
        dok3_to_dok4 = self._limit_connections_per_node(dok3_to_dok4, "target_index")

        logger.info(
            f"Found {len(dok2_to_dok3)} DOK2->DOK3 and {len(dok3_to_dok4)} DOK3->DOK4 connections"
        )

        return {
            "dok2_to_dok3": dok2_to_dok3,
            "dok3_to_dok4": dok3_to_dok4,
        }
