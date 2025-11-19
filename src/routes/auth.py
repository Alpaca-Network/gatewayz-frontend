import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException

import src.config.supabase_config as supabase_config
import src.db.users as users_module
import src.enhanced_notification_service as notif_module
from src.db.activity import log_activity
from src.schemas import (
    AuthMethod,
    PrivyAuthRequest,
    PrivyAuthResponse,
    SubscriptionStatus,
    UserRegistrationRequest,
    UserRegistrationResponse,
)

# Initialize logging
logger = logging.getLogger(__name__)

router = APIRouter()


# Background task functions for non-blocking operations
# ISSUE FIX #6: Improved background task error handling with better logging


def _send_welcome_email_background(user_id: str, username: str, email: str, credits: float):
    """Send welcome email in background for existing users"""
    try:
        logger.info(f"Background task: Sending welcome email to user {user_id}")
        if not email or "@" not in email:
            logger.warning(f"Background task: Invalid email '{email}' for user {user_id}, skipping")
            return

        success = notif_module.enhanced_notification_service.send_welcome_email_if_needed(
            user_id=user_id, username=username, email=email, credits=credits
        )
        if success:
            logger.info(f"Background task: Welcome email sent successfully to user {user_id}")
        else:
            logger.warning(
                f"Background task: Welcome email service returned false for user {user_id}"
            )
    except Exception as e:
        logger.error(
            f"Background task: Failed to send welcome email to existing user {user_id}: {e}",
            exc_info=True,
        )


def _send_new_user_welcome_email_background(
    user_id: str, username: str, email: str, credits: float
):
    """Send welcome email in background for new users"""
    try:
        logger.info(f"Background task: Sending welcome email to new user {user_id}")
        if not email or "@" not in email:
            logger.warning(
                f"Background task: Invalid email '{email}' for new user {user_id}, skipping"
            )
            return

        success = notif_module.enhanced_notification_service.send_welcome_email(
            user_id=user_id, username=username, email=email, credits=credits
        )
        if success:
            try:
                from src.db.users import mark_welcome_email_sent

                mark_welcome_email_sent(user_id)
                logger.info(
                    f"Background task: Welcome email sent and marked for new user {user_id}"
                )
            except Exception as mark_error:
                logger.error(
                    f"Background task: Failed to mark welcome email as sent for user {user_id}: "
                    f"{mark_error}"
                )
        else:
            logger.warning(
                f"Background task: Welcome email service returned false for new user {user_id}"
            )
    except Exception as e:
        logger.error(
            f"Background task: Failed to send welcome email for new user {user_id}: {e}",
            exc_info=True,
        )


def _log_auth_activity_background(
    user_id: str, auth_method: AuthMethod, privy_user_id: str, is_new_user: bool
):
    """Log authentication activity in background"""
    try:
        # Convert user_id to int if it's a string
        try:
            user_id_int = int(user_id) if isinstance(user_id, str) else user_id
        except (ValueError, TypeError) as conv_error:
            logger.error(
                f"Background task: Failed to convert user_id '{user_id}' to int: {conv_error}"
            )
            return

        log_activity(
            user_id=user_id_int,
            model="auth",
            provider="Privy",
            tokens=0,
            cost=0.0,
            speed=0.0,
            finish_reason="login",
            app="Auth",
            metadata={
                "action": "login",
                "auth_method": (
                    auth_method.value if hasattr(auth_method, "value") else str(auth_method)
                ),
                "privy_user_id": privy_user_id,
                "is_new_user": is_new_user,
            },
        )
        logger.debug(f"Background task: Auth activity logged for user {user_id}")
    except Exception as e:
        logger.error(
            f"Background task: Failed to log auth activity for user {user_id}: {e}",
            exc_info=True,
        )


def _log_registration_activity_background(user_id: str, metadata: dict):
    """Log registration activity in background"""
    try:
        # Convert user_id to int if it's a string
        try:
            user_id_int = int(user_id) if isinstance(user_id, str) else user_id
        except (ValueError, TypeError) as conv_error:
            logger.error(
                f"Background task: Failed to convert user_id '{user_id}' to int: {conv_error}"
            )
            return

        log_activity(
            user_id=user_id_int,
            model="auth",
            provider="Privy",
            tokens=0,
            cost=0.0,
            speed=0.0,
            finish_reason="register",
            app="Auth",
            metadata=metadata,
        )
        logger.debug(f"Background task: Registration activity logged for user {user_id}")
    except Exception as e:
        logger.error(
            f"Background task: Failed to log registration activity for user {user_id}: {e}",
            exc_info=True,
        )


@router.post("/auth", response_model=PrivyAuthResponse, tags=["authentication"])
async def privy_auth(request: PrivyAuthRequest, background_tasks: BackgroundTasks):
    """Authenticate user via Privy and return API key"""
    try:
        logger.info(f"Privy auth request for user: {request.user.id}")
        if request.referral_code:
            logger.info(f"Referral code provided in auth request: {request.referral_code}")
        logger.info(f"is_new_user flag: {request.is_new_user}")

        # ISSUE FIX #2: Validate Privy request structure before accessing nested fields
        if not request.user or not request.user.id:
            raise ValueError("Invalid Privy user data: user ID is required")

        if not isinstance(request.user.linked_accounts, list):
            logger.warning(
                f"Invalid linked_accounts structure for user {request.user.id}, "
                "defaulting to empty list"
            )
            request.user.linked_accounts = []

        # Extract user info from Privy linked accounts
        # Priority: 1) Top-level email from request, 2) Email from linked accounts, 3) Fallback
        email = request.email  # Start with top-level email if provided by frontend
        display_name = None
        auth_method = AuthMethod.EMAIL  # Default

        # Try to extract from linked accounts if not provided at top level
        if not email and request.user.linked_accounts:
            for account in request.user.linked_accounts:
                try:
                    if account.type == "email" and account.email:
                        email = account.email
                        auth_method = AuthMethod.EMAIL
                        logger.debug(f"Extracted email from email account: {email}")
                        break
                    elif account.type == "google_oauth" and account.email:
                        email = account.email
                        display_name = account.name
                        auth_method = AuthMethod.GOOGLE
                        logger.debug(
                            f"Extracted email from Google OAuth: {email}, "
                            f"display_name: {display_name}"
                        )
                        break
                    elif account.type == "github" and account.name:
                        display_name = account.name
                        auth_method = AuthMethod.GITHUB
                        logger.debug(f"Extracted GitHub username: {display_name}")
                        # GitHub doesn't provide email in this field, will use fallback
                except Exception as account_error:
                    logger.warning(
                        f"Error processing linked account for user {request.user.id}: "
                        f"{account_error}"
                    )
                    continue

        # ISSUE FIX #3: Improved email extraction with better logging
        if not email and request.token:
            logger.warning(
                f"No email found from linked accounts for user {request.user.id}, "
                "using fallback email format"
            )
            # Use a fallback email format instead of calling external API
            email = f"{request.user.id}@privy.user"
        elif not email:
            logger.error(
                f"Failed to extract any email for user {request.user.id} and no token provided"
            )
            raise ValueError(
                "Unable to extract email from Privy user data and no fallback available"
            )

        logger.info(
            f"Email extraction completed for user {request.user.id}: {email}, "
            f"auth_method: {auth_method}"
        )

        # Generate username from email or privy ID (for fallback check)
        username = email.split("@")[0] if email else f"user_{request.user.id[:8]}"
        logger.debug(f"Generated username for user {request.user.id}: {username}")

        # Check if user already exists by privy_user_id
        existing_user = users_module.get_user_by_privy_id(request.user.id)

        # Fallback: check by username if privy_user_id lookup failed
        if not existing_user:
            existing_user = users_module.get_user_by_username(username)
            if existing_user:
                logger.warning(
                    f"User found by username '{username}' but not by privy_user_id. Updating privy_user_id..."
                )
                # Update the existing user with the privy_user_id
                try:
                    client = supabase_config.get_supabase_client()
                    client.table("users").update({"privy_user_id": request.user.id}).eq(
                        "id", existing_user["id"]
                    ).execute()
                    existing_user["privy_user_id"] = request.user.id
                    logger.info(f"Updated user {existing_user['id']} with privy_user_id")
                except Exception as e:
                    logger.error(f"Failed to update privy_user_id: {e}")

        if existing_user:
            # Existing user - return their info
            logger.info(f"Existing Privy user found: {existing_user['id']}")
            logger.info(
                f"User welcome email status: {existing_user.get('welcome_email_sent', 'Not set')}"
            )
            logger.info(
                f"User credits at login: {existing_user.get('credits', 'NOT_FOUND')} (type: {type(existing_user.get('credits')).__name__})"
            )

            # ISSUE FIX #1: Get API key with a single query and proper sorting
            # Multiple order() calls should be chained - Supabase applies them in sequence
            client = supabase_config.get_supabase_client()

            api_key_to_return = existing_user["api_key"]  # Default fallback

            try:
                # Get all active keys, ordered by: 1) primary first (desc), 2) creation date (asc)
                all_keys_result = (
                    client.table("api_keys_new")
                    .select("api_key, is_primary, created_at")
                    .eq("user_id", existing_user["id"])
                    .eq("is_active", True)
                    .order("is_primary", desc=True)
                    .order("created_at", desc=False)
                    .execute()
                )

                if all_keys_result.data and len(all_keys_result.data) > 0:
                    # Sort in Python to ensure correct ordering
                    # Primary keys first, then by creation date ascending
                    sorted_keys = sorted(
                        all_keys_result.data,
                        key=lambda k: (
                            not k.get(
                                "is_primary", False
                            ),  # False sorts before True (primary first)
                            k.get("created_at", ""),  # Then by creation date
                        ),
                    )
                    api_key_to_return = sorted_keys[0]["api_key"]
                    key_type = "primary" if sorted_keys[0].get("is_primary") else "active"
                    logger.info(
                        f"Returning {key_type} API key for user {existing_user['id']} "
                        f"from {len(sorted_keys)} active keys"
                    )
                else:
                    logger.warning(
                        f"No API keys found in api_keys_new for user {existing_user['id']}, "
                        "using legacy key from users table"
                    )
            except Exception as key_error:
                logger.error(
                    f"Error retrieving API keys for user {existing_user['id']}: {key_error}, "
                    "falling back to legacy key"
                )

            # ISSUE FIX #4: Ensure credits is a float value with error handling
            # Normalize credits BEFORE passing to background tasks to ensure consistency
            user_credits = existing_user.get("credits")
            try:
                if user_credits is None:
                    logger.warning(
                        f"User {existing_user['id']} has None/null credits, defaulting to 0.0"
                    )
                    user_credits = 0.0
                else:
                    # Try to convert to float
                    user_credits = float(user_credits)
                    logger.debug(
                        f"Normalized user {existing_user['id']} credits to float: {user_credits}"
                    )
            except (ValueError, TypeError) as credits_error:
                logger.error(
                    f"Failed to convert credits for user {existing_user['id']} "
                    f"(value: {user_credits}, type: {type(user_credits).__name__}): {credits_error}, "
                    "defaulting to 0.0"
                )
                user_credits = 0.0

            # OPTIMIZATION: Send welcome email in background to avoid blocking the response
            user_email = existing_user.get("email") or email
            logger.info(
                f"Welcome email check - User ID: {existing_user['id']}, Welcome sent: {existing_user.get('welcome_email_sent', 'Not set')}"
            )

            if user_email:
                # Send email in background with normalized credits
                background_tasks.add_task(
                    _send_welcome_email_background,
                    user_id=existing_user["id"],
                    username=existing_user.get("username") or display_name,
                    email=user_email,
                    credits=user_credits,
                )
            else:
                logger.warning(
                    f"No email found for user {existing_user['id']}, skipping welcome email"
                )

            # OPTIMIZATION: Log authentication activity in background to avoid blocking
            background_tasks.add_task(
                _log_auth_activity_background,
                user_id=existing_user["id"],
                auth_method=auth_method,
                privy_user_id=request.user.id,
                is_new_user=False,
            )

            logger.info(f"Returning login response with credits: {user_credits}")

            return PrivyAuthResponse(
                success=True,
                message="Login successful",
                user_id=existing_user["id"],
                api_key=api_key_to_return,
                auth_method=auth_method,
                privy_user_id=request.user.id,
                is_new_user=False,
                display_name=existing_user.get("username") or display_name,
                email=existing_user.get("email") or email,
                credits=user_credits,
                timestamp=datetime.now(timezone.utc),
            )
        else:
            # New user - create account
            logger.info(f"Creating new Privy user: {request.user.id}")

            # Create user with Privy ID (username already generated above)
            try:
                # Convert auth_method enum to string for create_enhanced_user
                auth_method_str = (
                    auth_method.value if hasattr(auth_method, "value") else str(auth_method)
                )
                user_data = users_module.create_enhanced_user(
                    username=username,
                    email=email or f"{request.user.id}@privy.user",
                    auth_method=auth_method_str,
                    privy_user_id=request.user.id,
                    credits=10,  # Users start with $10 trial credits for 3 days
                )
            except Exception as creation_error:
                logger.warning(
                    "create_enhanced_user failed (%s); falling back to manual creation: %s",
                    creation_error,
                    str(creation_error),
                )

                client = supabase_config.get_supabase_client()

                fallback_email = email or f"{request.user.id}@privy.user"
                user_payload = {
                    "username": username,
                    "email": fallback_email,
                    "credits": 10,
                    "privy_user_id": request.user.id,
                    "auth_method": (
                        auth_method.value if hasattr(auth_method, "value") else str(auth_method)
                    ),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "welcome_email_sent": False,
                }

                try:
                    user_insert = client.table("users").insert(user_payload).execute()
                    if not user_insert.data:
                        raise HTTPException(
                            status_code=500, detail="Failed to create user account"
                        ) from creation_error

                    created_user = user_insert.data[0]
                    api_key_value = f"gw_live_{username}_fallback"

                    # ISSUE FIX #5: Ensure environment_tag is valid before using it
                    env_tag = request.environment_tag or "live"
                    if env_tag not in {"live", "test", "development"}:
                        logger.warning(
                            f"Invalid environment_tag '{env_tag}' for user {created_user['id']}, "
                            "defaulting to 'live'"
                        )
                        env_tag = "live"

                    try:
                        client.table("api_keys_new").insert(
                            {
                                "user_id": created_user["id"],
                                "api_key": api_key_value,
                                "key_name": "Primary API Key",
                                "is_primary": True,
                                "is_active": True,
                                "environment_tag": env_tag,
                            }
                        ).execute()
                        logger.info(
                            f"Created API key for fallback user {created_user['id']} "
                            f"with environment_tag: {env_tag}"
                        )
                    except Exception as api_key_error:
                        logger.error(
                            f"Failed to create API key for user {created_user['id']}: "
                            f"{api_key_error}, proceeding without API key in api_keys_new table"
                        )

                    user_data = {
                        "user_id": created_user["id"],
                        "username": created_user.get("username", username),
                        "email": created_user.get("email", fallback_email),
                        "credits": created_user.get("credits", 10),
                        "primary_api_key": api_key_value,
                        "api_key": api_key_value,
                        "scope_permissions": created_user.get("scope_permissions", {}),
                    }
                    logger.info(
                        f"Successfully created fallback user {created_user['id']} "
                        f"with username {username}"
                    )
                except Exception as fallback_error:
                    logger.error(f"Fallback user creation failed: {fallback_error}", exc_info=True)
                    raise HTTPException(
                        status_code=500, detail="Failed to create user account"
                    ) from fallback_error

            # Process referral code if provided
            referral_code_valid = False
            if request.referral_code:
                try:
                    from src.services.referral import (
                        send_referral_signup_notification,
                        track_referral_signup,
                    )

                    client = supabase_config.get_supabase_client()

                    # Track referral signup and store referred_by_code
                    success, error_msg, referrer = track_referral_signup(
                        request.referral_code, user_data["user_id"]
                    )

                    if success and referrer:
                        referral_code_valid = True
                        logger.info(
                            f"Valid referral code provided during signup: {request.referral_code}"
                        )

                        # Store referral code for the new user
                        try:
                            client.table("users").update(
                                {"referred_by_code": request.referral_code}
                            ).eq("id", user_data["user_id"]).execute()
                            logger.info(
                                f"Stored referral code {request.referral_code} for new user {user_data['user_id']}"
                            )

                            # OPTIMIZATION: Send notification to referrer in background
                            if referrer.get("email"):
                                background_tasks.add_task(
                                    send_referral_signup_notification,
                                    referrer_id=referrer["id"],
                                    referrer_email=referrer["email"],
                                    referrer_username=referrer.get("username", "User"),
                                    referee_username=username,
                                )
                        except Exception as e:
                            logger.error(
                                f"Failed to store referral code or send notification for new user: {e}"
                            )
                    else:
                        logger.warning(
                            f"Invalid referral code provided during signup: {request.referral_code} - {error_msg}"
                        )
                except Exception as e:
                    logger.error(f"Error processing referral code: {e}")

            # OPTIMIZATION: Send welcome email in background for new users
            if email:
                background_tasks.add_task(
                    _send_new_user_welcome_email_background,
                    user_id=user_data["user_id"],
                    username=user_data["username"],
                    email=email,
                    credits=user_data["credits"],
                )

            logger.info(f"New Privy user created: {user_data['user_id']}")
            logger.info(
                f"Referral code processing result for new user {user_data['user_id']}: valid={referral_code_valid}"
            )

            # OPTIMIZATION: Log registration activity in background
            activity_metadata = {
                "action": "register",
                "auth_method": (
                    auth_method.value if hasattr(auth_method, "value") else str(auth_method)
                ),
                "privy_user_id": request.user.id,
                "is_new_user": True,
                "initial_credits": user_data["credits"],
                "referral_code": request.referral_code,
                "referral_code_valid": referral_code_valid,
            }
            background_tasks.add_task(
                _log_registration_activity_background,
                user_id=user_data["user_id"],
                metadata=activity_metadata,
            )

            # ISSUE FIX #4: Ensure credits is a float value with error handling for new users
            try:
                new_user_credits = float(user_data["credits"])
                logger.debug(
                    f"Normalized new user {user_data['user_id']} credits to float: {new_user_credits}"
                )
            except (ValueError, TypeError) as credits_error:
                logger.error(
                    f"Failed to convert new user credits (value: {user_data['credits']}, "
                    f"type: {type(user_data['credits']).__name__}): {credits_error}, "
                    "defaulting to 10.0"
                )
                new_user_credits = 10.0
            logger.info(f"Returning registration response with credits: {new_user_credits}")

            return PrivyAuthResponse(
                success=True,
                message="Account created successfully",
                user_id=user_data["user_id"],
                api_key=user_data["primary_api_key"],
                auth_method=auth_method,
                privy_user_id=request.user.id,
                is_new_user=True,
                display_name=display_name or user_data["username"],
                email=email,
                credits=new_user_credits,
                timestamp=datetime.now(timezone.utc),
            )

    except Exception as e:
        logger.error(f"Privy authentication failed: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}") from e


@router.post("/auth/register", response_model=UserRegistrationResponse, tags=["authentication"])
async def register_user(request: UserRegistrationRequest):
    """Register a new user with username and email"""
    try:
        logger.info(f"Registration request for user: {request.username}")

        client = supabase_config.get_supabase_client()

        # Check if email already exists
        existing_email = client.table("users").select("id").eq("email", request.email).execute()
        if existing_email.data:
            raise HTTPException(status_code=400, detail="User with this email already exists")

        # Check if username already exists
        existing_username = (
            client.table("users").select("id").eq("username", request.username).execute()
        )
        if existing_username.data:
            raise HTTPException(status_code=400, detail="Username already taken")

        # Create user first
        try:
            # Convert auth_method enum to string for create_enhanced_user
            auth_method_str = (
                request.auth_method.value
                if hasattr(request.auth_method, "value")
                else str(request.auth_method)
            )
            user_data = users_module.create_enhanced_user(
                username=request.username,
                email=request.email,
                auth_method=auth_method_str,
                privy_user_id=None,  # No Privy for direct registration
                credits=10,
            )
        except Exception as creation_error:
            logger.warning(
                "create_enhanced_user failed during registration (%s); using manual fallback: %s",
                creation_error,
                str(creation_error),
            )

            fallback_payload = {
                "username": request.username,
                "email": request.email,
                "credits": 10,
                "privy_user_id": None,
                "auth_method": (
                    request.auth_method.value
                    if hasattr(request.auth_method, "value")
                    else str(request.auth_method)
                ),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "welcome_email_sent": False,
            }

            try:
                user_insert = client.table("users").insert(fallback_payload).execute()
                if not user_insert.data:
                    raise HTTPException(
                        status_code=500, detail="Failed to create user account"
                    ) from creation_error

                created_user = user_insert.data[0]
                api_key_value = f"gw_live_{request.username}_fallback"

                # Apply same fixes as privy_auth: validate environment_tag
                env_tag = request.environment_tag or "live"
                if env_tag not in {"live", "test", "development"}:
                    logger.warning(
                        f"Invalid environment_tag '{env_tag}' for registration, defaulting to 'live'"
                    )
                    env_tag = "live"

                try:
                    client.table("api_keys_new").insert(
                        {
                            "user_id": created_user["id"],
                            "api_key": api_key_value,
                            "key_name": request.key_name,
                            "is_primary": True,
                            "is_active": True,
                            "environment_tag": env_tag,
                        }
                    ).execute()
                    logger.info(
                        f"Created API key for fallback registration user {created_user['id']} "
                        f"with environment_tag: {env_tag}"
                    )
                except Exception as api_key_error:
                    logger.error(
                        f"Failed to create API key for registration user {created_user['id']}: "
                        f"{api_key_error}, proceeding without API key in api_keys_new table"
                    )

                user_data = {
                    "user_id": created_user["id"],
                    "username": created_user.get("username", request.username),
                    "email": created_user.get("email", request.email),
                    "credits": created_user.get("credits", 10),
                    "primary_api_key": api_key_value,
                    "api_key": api_key_value,
                    "scope_permissions": created_user.get("scope_permissions", {}),
                }
                logger.info(
                    f"Successfully created fallback registration user {created_user['id']} "
                    f"with username {request.username}"
                )
            except Exception as fallback_error:
                logger.error(
                    f"Fallback registration user creation failed: {fallback_error}", exc_info=True
                )
                raise HTTPException(
                    status_code=500, detail="Failed to create user account"
                ) from fallback_error

        # Validate and track referral code if provided
        if request.referral_code:
            try:
                from src.services.referral import (
                    send_referral_signup_notification,
                    track_referral_signup,
                )

                # Track referral signup and store referred_by_code
                success, error_msg, referrer = track_referral_signup(
                    request.referral_code, user_data["user_id"]
                )

                if success and referrer:
                    logger.info(f"Valid referral code provided: {request.referral_code}")

                    # Store referral code for the new user
                    try:
                        client.table("users").update(
                            {"referred_by_code": request.referral_code}
                        ).eq("id", user_data["user_id"]).execute()
                        logger.info(
                            f"Stored referral code {request.referral_code} for user {user_data['user_id']}"
                        )

                        # Send notification to referrer
                        if referrer.get("email"):
                            send_referral_signup_notification(
                                referrer_id=referrer["id"],
                                referrer_email=referrer["email"],
                                referrer_username=referrer.get("username", "User"),
                                referee_username=request.username,
                            )
                    except Exception as e:
                        logger.error(f"Failed to store referral code or send notification: {e}")
                else:
                    logger.warning(
                        f"Invalid referral code provided: {request.referral_code} - {error_msg}"
                    )
            except Exception as e:
                logger.error(f"Error processing referral code: {e}")

        # Send welcome email
        try:
            success = notif_module.enhanced_notification_service.send_welcome_email(
                user_id=user_data["user_id"],
                username=user_data["username"],
                email=request.email,
                credits=user_data["credits"],
            )

            if success:
                from src.db.users import mark_welcome_email_sent

                mark_welcome_email_sent(user_data["user_id"])
                logger.info(f"Welcome email sent for user {user_data['user_id']}")
        except Exception as e:
            logger.warning(f"Failed to send welcome email: {e}")

        logger.info(f"User registered successfully: {user_data['user_id']}")

        return UserRegistrationResponse(
            user_id=user_data["user_id"],
            username=user_data["username"],
            email=request.email,
            api_key=user_data["primary_api_key"],
            credits=user_data["credits"],
            environment_tag=request.environment_tag,
            scope_permissions=user_data.get("scope_permissions", {}),
            auth_method=request.auth_method,
            subscription_status=SubscriptionStatus.TRIAL,
            message="Account created successfully",
            timestamp=datetime.now(timezone.utc),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration failed: {e}")
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}") from e


@router.post("/auth/password-reset", tags=["authentication"])
async def request_password_reset(email: str):
    """Request password reset email"""
    try:
        # Find the user by email
        client = supabase_config.get_supabase_client()
        user_result = (
            client.table("users").select("id", "username", "email").eq("email", email).execute()
        )

        if not user_result.data:
            # Don't reveal if email exists or not for security
            return {
                "message": "If an account with that email exists, a password reset link has been sent."
            }

        user = user_result.data[0]

        # Send password reset email
        reset_token = notif_module.enhanced_notification_service.send_password_reset_email(
            user_id=user["id"], username=user["username"], email=user["email"]
        )

        if reset_token:
            return {"message": "Password reset email sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send password reset email")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error requesting password reset: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e


@router.post("/auth/reset-password", tags=["authentication"])
async def reset_password(token: str):
    """Reset password using token"""
    try:
        client = supabase_config.get_supabase_client()

        # Verify token
        token_result = (
            client.table("password_reset_tokens")
            .select("*")
            .eq("token", token)
            .eq("used", False)
            .execute()
        )

        if not token_result.data:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        token_data = token_result.data[0]
        expires_at = datetime.fromisoformat(token_data["expires_at"].replace("Z", "+00:00"))

        if datetime.now(timezone.utc).replace(tzinfo=expires_at.tzinfo) > expires_at:
            raise HTTPException(status_code=400, detail="Reset token has expired")

        # Update password (in a real app, you'd hash this)
        # For now, we'll just mark the token as used
        client.table("password_reset_tokens").update({"used": True}).eq(
            "id", token_data["id"]
        ).execute()

        return {"message": "Password reset successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error") from e
