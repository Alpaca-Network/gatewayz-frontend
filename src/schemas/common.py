from enum import Enum

class AuthMethod(str, Enum):
    EMAIL = "email"
    WALLET = "wallet"
    GOOGLE = "google"
    GITHUB = "github"

class PaymentMethod(str, Enum):
    MASTERCARD = "mastercard"
    PACA_TOKEN = "paca_token"

class SubscriptionStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    TRIAL = "trial"

class PlanType(str, Enum):
    """Plan type enumeration"""
    FREE = "free"
    DEV = "dev"
    TEAM = "team"
    CUSTOMIZE = "customize"
