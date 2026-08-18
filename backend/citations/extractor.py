"""
Source citation extractor.

Parses document references from AI-generated answers.
In V1 this is simple string matching; V2 can use structured output from Gemini.
"""

from __future__ import annotations


def extract_sources(answer: str, available_filenames: list[str]) -> list[str]:
    """
    Return a list of filenames mentioned in the answer text.

    Strategy:
    1. Look for explicit "Sources:" section (added by system prompt).
    2. Scan the full answer for filename occurrences.
    3. Fall back to all available filenames if nothing is found.
    """
    # Strategy 1: parse "Sources:" section
    sources_from_section = _parse_sources_section(answer, available_filenames)
    if sources_from_section:
        return sources_from_section

    # Strategy 2: scan full answer
    answer_lower = answer.lower()
    mentioned = [
        f for f in available_filenames
        if f.lower() in answer_lower
        or f.lower().replace(".pdf", "") in answer_lower
        or f.lower().replace("_", " ").replace(".pdf", "") in answer_lower
        or f.lower().replace("-", " ").replace(".pdf", "") in answer_lower
    ]
    if mentioned:
        return _deduplicate(mentioned)

    # Strategy 3: fallback — all files were used as context
    return available_filenames


def _parse_sources_section(answer: str, available_filenames: list[str]) -> list[str]:
    """Look for a '**Sources:**' or 'Sources:' section and extract listed items."""
    lower = answer.lower()
    markers = ["**sources:**", "sources:", "source:", "**source:**"]

    for marker in markers:
        idx = lower.rfind(marker)
        if idx == -1:
            continue
        # Extract text after the marker
        after = answer[idx + len(marker):]
        found = []
        for line in after.splitlines():
            line = line.strip().lstrip("-•*").strip()
            for f in available_filenames:
                if f.lower() in line.lower() or f.lower().replace(".pdf", "") in line.lower():
                    found.append(f)
        if found:
            return _deduplicate(found)

    return []


def _deduplicate(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result = []
    for item in items:
        if item not in seen:
            seen.add(item)
            result.append(item)
    return result
