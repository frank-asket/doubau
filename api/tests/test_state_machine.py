from app.models.application import ApplicationStatus
from app.state_machine import InvalidTransition, assert_transition


def test_allows_core_hitl_transitions() -> None:
    assert_transition(ApplicationStatus.DISCOVERED, ApplicationStatus.PENDING_APPROVAL)
    assert_transition(ApplicationStatus.PENDING_APPROVAL, ApplicationStatus.APPROVED)
    assert_transition(ApplicationStatus.APPROVED, ApplicationStatus.SUBMITTED)


def test_rejects_invalid_transitions() -> None:
    try:
        assert_transition(ApplicationStatus.DISCOVERED, ApplicationStatus.SUBMITTED)
        raise AssertionError("Expected InvalidTransition")
    except InvalidTransition as e:
        assert e.from_status == ApplicationStatus.DISCOVERED
        assert e.to_status == ApplicationStatus.SUBMITTED


def test_cannot_change_submitted() -> None:
    for to_status in ApplicationStatus:
        if to_status == ApplicationStatus.SUBMITTED:
            continue
        try:
            assert_transition(ApplicationStatus.SUBMITTED, to_status)
            raise AssertionError("Expected InvalidTransition")
        except InvalidTransition:
            pass

