"""Simple test to verify claude-on-failure workflow."""


def test_basic_assertion():
    """This test intentionally fails to trigger claude-on-failure workflow."""
    assert 1 + 1 == 3, "Math is broken - intentional test failure"
