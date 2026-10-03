"""Strict Pydantic v2 schemas for Amazon Bedrock Converse structured output extraction."""
from enum import Enum
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class DepartmentEnum(str, Enum):
    """The 6 authoritative enterprise triage departments."""
    BILLING = "BILLING"
    SECURITY = "SECURITY"
    TECH_SUPPORT = "TECH_SUPPORT"
    ACCOUNTS = "ACCOUNTS"
    SALES = "SALES"
    GENERAL = "GENERAL"


class ResponseStrategyEnum(str, Enum):
    """The 4 dynamic response strategies prescribed for agent guidance."""
    DIRECT_RESOLUTION = "DIRECT_RESOLUTION"
    CLARIFICATION_REQUEST = "CLARIFICATION_REQUEST"
    ESCALATION = "ESCALATION"
    EMPATHETIC_DEFUSING = "EMPATHETIC_DEFUSING"


SuggestedStrategyEnum = ResponseStrategyEnum


class BedrockTriageOutput(BaseModel):
    """Strictly typed extraction schema enforced upon Amazon Bedrock Converse model invocations."""

    department: DepartmentEnum = Field(
        ...,
        description="Assigned department based on taxonomy and precedence rules",
    )
    urgency_rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Customer-perceived time sensitivity from 1 (Low) to 5 (Immediate)",
    )
    impact_rating: int = Field(
        ...,
        ge=1,
        le=3,
        description="Business and operational impact from 1 (Minor) to 3 (Critical/Blocker)",
    )
    sentiment_score: float = Field(
        ...,
        ge=-1.0,
        le=1.0,
        description="Quantified emotional sentiment from -1.0 (Extremely Frustrated) to +1.0 (Delighted)",
    )
    churn_risk: bool = Field(
        ...,
        description="True if inquiry exhibits severe dissatisfaction, threats to leave, or active dispute",
    )
    key_entities: Dict[str, Any] = Field(
        default_factory=dict,
        description="Extracted named entities (e.g., order_id, error_code, invoice_number, amount)",
    )
    suggested_strategy: ResponseStrategyEnum = Field(
        ...,
        description="Actionable strategic framework recommended for the support agent",
    )
    suggested_response: str = Field(
        ...,
        description="Draft customer response ground strictly on company_profile.json policies",
    )
    agent_copilot_notes: str = Field(
        ...,
        description="Internal guidance notes explaining why this priority/department was selected",
    )
    confidence_score: float = Field(
        default=0.95,
        ge=0.0,
        le=1.0,
        description="Model confidence level in classification accuracy",
    )
    latency_ms: int = Field(
        default=0,
        ge=0,
        description="Inference execution latency in milliseconds",
    )
    model_id: str = Field(
        default="eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        description="Authoritative AWS Bedrock model identifier",
    )
    input_tokens: int = Field(
        default=0,
        ge=0,
        description="Bedrock Converse input token count",
    )
    output_tokens: int = Field(
        default=0,
        ge=0,
        description="Bedrock Converse output token count",
    )
    cost_eur: float = Field(
        default=0.0,
        ge=0.0,
        description="Calculated FinOps ingestion cost in EUR",
    )

