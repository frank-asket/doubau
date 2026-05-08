from __future__ import annotations

from dataclasses import dataclass

from app.models.application import ApplicationStatus


@dataclass(frozen=True, slots=True)
class InvalidTransition(Exception):
    from_status: ApplicationStatus
    to_status: ApplicationStatus

    def __str__(self) -> str:  # pragma: no cover
        return f"Invalid transition: {self.from_status} → {self.to_status}"


ALLOWED_TRANSITIONS: dict[ApplicationStatus, set[ApplicationStatus]] = {
    ApplicationStatus.DISCOVERED: {ApplicationStatus.PENDING_APPROVAL, ApplicationStatus.FAILED},
    ApplicationStatus.SCORING: {ApplicationStatus.DRAFTED, ApplicationStatus.FAILED},
    ApplicationStatus.DRAFTED: {ApplicationStatus.PENDING_APPROVAL, ApplicationStatus.FAILED},
    ApplicationStatus.PENDING_APPROVAL: {ApplicationStatus.APPROVED, ApplicationStatus.FAILED},
    ApplicationStatus.APPROVED: {ApplicationStatus.SUBMITTED, ApplicationStatus.FAILED},
    ApplicationStatus.SUBMITTED: set(),
    ApplicationStatus.FAILED: {ApplicationStatus.RETRY},
    ApplicationStatus.RETRY: {ApplicationStatus.DISCOVERED},
}


def assert_transition(from_status: ApplicationStatus, to_status: ApplicationStatus) -> None:
    allowed = ALLOWED_TRANSITIONS.get(from_status, set())
    if to_status not in allowed:
        raise InvalidTransition(from_status=from_status, to_status=to_status)

