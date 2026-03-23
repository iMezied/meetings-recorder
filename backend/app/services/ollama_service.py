"""Ollama LLM integration for meeting analysis."""

from __future__ import annotations

import json
import logging
from typing import Optional

import httpx

from app.config import settings
from app.models import (
    ActionItem,
    SentimentResponse,
    SpeakerSentiment,
    SummaryResponse,
)

logger = logging.getLogger(__name__)

_SUMMARY_PROMPT = """\
You are a meeting analysis assistant. Analyze the following meeting transcript \
and produce a JSON object with these keys:
- "title": a short descriptive title for the meeting
- "overview": 2-3 sentence summary
- "keyPoints": list of key points discussed (strings)
- "actionItems": list of objects with "task", "assignee" (or null), "deadline" (or null)
- "decisions": list of decisions made (strings)
- "openQuestions": list of unresolved questions (strings)

Support both English and Arabic. Respond ONLY with valid JSON, no markdown.

Transcript:
{transcript}
"""

_SENTIMENT_PROMPT = """\
You are a meeting dynamics analyst. Analyze the following meeting transcript \
and produce a JSON object with these keys:
- "speakers": list of objects, each with:
  - "name": speaker identifier
  - "sentiment": overall sentiment (positive/neutral/negative)
  - "engagement": level of engagement (high/medium/low)
  - "toneDescriptors": list of tone words (e.g. "assertive", "collaborative")
  - "style": communication style description
  - "contributions": brief description of their main contributions
- "overallMeetingTone": the overall tone of the meeting
- "dynamicsSummary": 2-3 sentence summary of the meeting dynamics

Support both English and Arabic. Respond ONLY with valid JSON, no markdown.

Transcript:
{transcript}
"""


class OllamaService:
    """Async client for the Ollama REST API."""

    def __init__(self) -> None:
        self._base_url = settings.OLLAMA_URL
        self._timeout = 300.0

    # ------------------------------------------------------------------
    # Status
    # ------------------------------------------------------------------

    async def check_status(self) -> tuple[bool, list[str]]:
        """Check if Ollama is running and list available models."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models = [m["name"] for m in data.get("models", [])]
                    return True, models
        except (httpx.ConnectError, httpx.TimeoutException, Exception):
            pass
        return False, []

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    async def generate_summary(
        self,
        transcript_text: str,
        model: Optional[str] = None,
    ) -> SummaryResponse:
        """Generate a meeting summary from transcript text."""
        model = model or settings.DEFAULT_LLM_MODEL
        prompt = _SUMMARY_PROMPT.format(transcript=transcript_text)
        raw = await self._generate(model, prompt)
        return self._parse_summary(raw)

    # ------------------------------------------------------------------
    # Sentiment
    # ------------------------------------------------------------------

    async def analyze_sentiment(
        self,
        transcript_text: str,
        model: Optional[str] = None,
    ) -> SentimentResponse:
        """Analyze speaker sentiment from transcript text."""
        model = model or settings.DEFAULT_LLM_MODEL
        prompt = _SENTIMENT_PROMPT.format(transcript=transcript_text)
        raw = await self._generate(model, prompt)
        return self._parse_sentiment(raw)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _generate(self, model: str, prompt: str) -> str:
        """Call the Ollama /api/generate endpoint."""
        async with httpx.AsyncClient(timeout=self._timeout) as client:
            resp = await client.post(
                f"{self._base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    @staticmethod
    def _parse_summary(raw: str) -> SummaryResponse:
        """Parse LLM output into SummaryResponse, handling imperfect JSON."""
        try:
            # Strip markdown code fences if present
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            data = json.loads(text)
            action_items = [
                ActionItem(**ai) if isinstance(ai, dict) else ActionItem(task=str(ai))
                for ai in data.get("actionItems", [])
            ]
            return SummaryResponse(
                title=data.get("title", ""),
                overview=data.get("overview", ""),
                keyPoints=data.get("keyPoints", []),
                actionItems=action_items,
                decisions=data.get("decisions", []),
                openQuestions=data.get("openQuestions", []),
            )
        except (json.JSONDecodeError, Exception):
            logger.exception("Failed to parse summary JSON")
            return SummaryResponse(overview=raw[:500])

    @staticmethod
    def _parse_sentiment(raw: str) -> SentimentResponse:
        """Parse LLM output into SentimentResponse."""
        try:
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1] if "\n" in text else text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            data = json.loads(text)
            speakers = [
                SpeakerSentiment(**s) if isinstance(s, dict) else SpeakerSentiment(name=str(s))
                for s in data.get("speakers", [])
            ]
            return SentimentResponse(
                speakers=speakers,
                overallMeetingTone=data.get("overallMeetingTone", ""),
                dynamicsSummary=data.get("dynamicsSummary", ""),
            )
        except (json.JSONDecodeError, Exception):
            logger.exception("Failed to parse sentiment JSON")
            return SentimentResponse(dynamicsSummary=raw[:500])
