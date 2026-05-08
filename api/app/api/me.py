from fastapi import APIRouter

from app.api.deps import CurrentUserDep, DbDep
from app.api.schemas import ProfileOut, ProfileUpsert
from app.models.profile import Profile

router = APIRouter(prefix="/me", tags=["me"])


@router.get("/profile", response_model=ProfileOut)
def get_profile(current_user: CurrentUserDep) -> ProfileOut:
    profile = current_user.profile
    return ProfileOut(
        email=current_user.email,
        current_role=profile.current_role if profile else None,
        years_experience=profile.years_experience if profile else None,
        persona=profile.persona if profile else None,
        location=profile.location if profile else None,
        contact_preferences=profile.contact_preferences if profile else None,
        goals=profile.goals if profile else None,
        plan_tier=profile.plan_tier if profile else None,
    )


@router.put("/profile", response_model=ProfileOut)
def put_profile(
    payload: ProfileUpsert,
    db: DbDep,
    current_user: CurrentUserDep,
) -> ProfileOut:
    profile = current_user.profile
    if profile is None:
        profile = Profile(user_id=current_user.id, goals={})
        db.add(profile)

    if payload.current_role is not None:
        profile.current_role = payload.current_role
    if payload.years_experience is not None:
        profile.years_experience = payload.years_experience
    if payload.persona is not None:
        profile.persona = payload.persona
    if payload.location is not None:
        profile.location = payload.location
    if payload.contact_preferences is not None:
        profile.contact_preferences = payload.contact_preferences
    if payload.goals is not None:
        profile.goals = payload.goals
    if payload.plan_tier is not None:
        profile.plan_tier = payload.plan_tier

    db.commit()
    db.refresh(profile)

    return ProfileOut(
        email=current_user.email,
        current_role=profile.current_role,
        years_experience=profile.years_experience,
        persona=profile.persona,
        location=profile.location,
        contact_preferences=profile.contact_preferences,
        goals=profile.goals,
        plan_tier=profile.plan_tier,
    )

