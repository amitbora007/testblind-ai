from typing import Any, Dict, List
from pydantic import BaseModel


class MetricCard(BaseModel):
    title: str
    value: str
    delta: str
    delta_type: str = "positive"
    description: str


class ExecutionTrendPoint(BaseModel):
    week: str
    passed: int
    failed: int
    skipped: int


class RequirementCoverageSlice(BaseModel):
    name: str
    value: int
    color: str


class DashboardMetrics(BaseModel):
    total_test_cases: MetricCard
    requirement_coverage: MetricCard
    test_scenarios_executed: MetricCard
    ai_insights: MetricCard
    execution_trends: List[ExecutionTrendPoint]
    requirement_coverage_slices: List[RequirementCoverageSlice]
