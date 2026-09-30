"""Unit tests for Bedrock JSON extraction schema and Pydantic validation rules."""
import json

import pytest
from pydantic import ValidationError
from app.schemas.bedrock import BedrockTriageOutput, SuggestedStrategyEnum
from app.schemas.inquiry import DepartmentEnum


def test_valid_bedrock_triage_output():
    """Verify successful validation of fully populated Bedrock triage response."""
    data = {
        "department": "TECH_SUPPORT",
        "urgency_rating": 4,
        "impact_rating": 3,
        "confidence_score": 0.95,
        "sentiment_score": -0.8,
        "churn_risk": True,
        "key_entities": {"cluster_id": "k8s-prod-eu1", "error": "CrashLoopBackOff"},
        "suggested_strategy": "ESCALATION",
        "suggested_response": "We are escalating your ticket to our L3 SRE team.",
        "agent_copilot_notes": "Immediate attention required.",
        "reasoning_summary": "Core production infrastructure outage.",
    }
    model = BedrockTriageOutput.model_validate(data)
    assert model.department == DepartmentEnum.TECH_SUPPORT
    assert model.urgency_rating == 4
    assert model.impact_rating == 3
    assert model.confidence_score == 0.95
    assert model.churn_risk is True
    assert model.suggested_strategy == SuggestedStrategyEnum.ESCALATION


def test_bedrock_urgency_rating_bounds():
    """Verify urgency rating must adhere to 1-5 boundary."""
    base_data = {
        "department": "GENERAL",
        "impact_rating": 2,
        "confidence_score": 0.9,
        "sentiment_score": 0.0,
        "churn_risk": False,
        "suggested_strategy": "DIRECT_RESOLUTION",
        "suggested_response": "Standard acknowledgment.",
        "agent_copilot_notes": "Notes",
        "reasoning_summary": "Summary",
    }

    # Test lower bound violation (< 1)
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "urgency_rating": 0})

    # Test upper bound violation (> 5)
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "urgency_rating": 6})

    # Test valid bounds (1 and 5)
    valid_low = BedrockTriageOutput.model_validate({**base_data, "urgency_rating": 1})
    valid_high = BedrockTriageOutput.model_validate({**base_data, "urgency_rating": 5})
    assert valid_low.urgency_rating == 1
    assert valid_high.urgency_rating == 5


def test_bedrock_impact_rating_bounds():
    """Verify impact rating must adhere to 1-3 boundary."""
    base_data = {
        "department": "BILLING",
        "urgency_rating": 3,
        "confidence_score": 0.9,
        "sentiment_score": 0.0,
        "churn_risk": False,
        "suggested_strategy": "DIRECT_RESOLUTION",
        "suggested_response": "Response",
        "agent_copilot_notes": "Notes",
        "reasoning_summary": "Summary",
    }

    # Test lower bound violation (< 1)
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "impact_rating": 0})

    # Test upper bound violation (> 3)
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "impact_rating": 4})

    # Test valid bounds (1 and 3)
    valid_low = BedrockTriageOutput.model_validate({**base_data, "impact_rating": 1})
    valid_high = BedrockTriageOutput.model_validate({**base_data, "impact_rating": 3})
    assert valid_low.impact_rating == 1
    assert valid_high.impact_rating == 3


def test_bedrock_confidence_and_sentiment_ranges():
    """Verify confidence score is [0.0, 1.0] and sentiment score is [-1.0, 1.0]."""
    base_data = {
        "department": "SALES",
        "urgency_rating": 2,
        "impact_rating": 1,
        "churn_risk": False,
        "suggested_strategy": "DIRECT_RESOLUTION",
        "suggested_response": "Response",
        "agent_copilot_notes": "Notes",
        "reasoning_summary": "Summary",
    }

    # Confidence score violations
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "confidence_score": -0.1, "sentiment_score": 0.0})

    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "confidence_score": 1.1, "sentiment_score": 0.0})

    # Sentiment score violations
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "confidence_score": 0.8, "sentiment_score": -1.1})

    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate({**base_data, "confidence_score": 0.8, "sentiment_score": 1.1})


def test_invalid_department_enum():
    """Verify validation error when Bedrock produces an unrecognized department."""
    data = {
        "department": "NON_EXISTENT_DEPARTMENT",
        "urgency_rating": 2,
        "impact_rating": 2,
        "confidence_score": 0.9,
        "sentiment_score": 0.0,
        "churn_risk": False,
        "suggested_strategy": "DIRECT_RESOLUTION",
        "suggested_response": "Response",
        "agent_copilot_notes": "Notes",
        "reasoning_summary": "Summary",
    }
    with pytest.raises(ValidationError):
        BedrockTriageOutput.model_validate(data)


def test_grounding_context_is_bom_tolerant(tmp_path, monkeypatch):
    """Verify a UTF-8 BOM on the profile file never leaks into the system prompt.

    deploy-infra.ps1 previously wrote company_profile.json with a BOM. Read as
    plain utf-8 the mark became a literal U+FEFF at the head of the grounding
    context, so the first byte of every Bedrock system prompt was that mark.
    """
    from app.services.bedrock_service import BedrockService

    profile = tmp_path / "company_profile.json"
    payload = '{"company_name": "ExampleCorp Technologies", "departments": ["BILLING"]}'
    profile.write_text(payload, encoding="utf-8-sig")

    service = BedrockService.__new__(BedrockService)
    monkeypatch.setattr("app.services.bedrock_service.settings.GROUNDING_CONTEXT_PATH", str(profile))

    loaded = service._load_grounding_context()

    assert "\ufeff" not in loaded
    assert loaded.startswith("{")
    assert json.loads(loaded)["company_name"] == "ExampleCorp Technologies"


def test_grounding_context_without_bom_is_unchanged(tmp_path, monkeypatch):
    """Verify BOM-free profiles keep loading identically, so the fix is not lossy."""
    from app.services.bedrock_service import BedrockService

    profile = tmp_path / "company_profile.json"
    payload = '{"company_name": "ExampleCorp Technologies", "departments": ["BILLING"]}'
    profile.write_text(payload, encoding="utf-8")

    service = BedrockService.__new__(BedrockService)
    monkeypatch.setattr("app.services.bedrock_service.settings.GROUNDING_CONTEXT_PATH", str(profile))

    assert service._load_grounding_context() == payload





