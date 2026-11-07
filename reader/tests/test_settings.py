"""The startup warning for settings the reader can't work without (#86)."""

import logging

import pytest
from fastapi.testclient import TestClient

from app import main

SECRET_LOOKING = "value-that-must-never-be-logged"


@pytest.fixture
def settings(monkeypatch):
    for name in (
        "SUPABASE_URL",
        "SUPABASE_ANON_KEY",
        "VITE_SUPABASE_URL",
        "VITE_SUPABASE_ANON_KEY",
    ):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def start_reader(caplog) -> str:
    with caplog.at_level(logging.WARNING, logger="bonescan.reader"):
        with TestClient(main.app):
            pass
    return caplog.text


def test_names_each_missing_setting_at_startup(settings, caplog):
    log = start_reader(caplog)
    assert "SUPABASE_URL isn't set" in log
    assert "SUPABASE_ANON_KEY isn't set" in log


def test_says_nothing_when_both_are_set(settings, caplog):
    settings.setenv("SUPABASE_URL", SECRET_LOOKING)
    settings.setenv("SUPABASE_ANON_KEY", SECRET_LOOKING)
    assert start_reader(caplog) == ""


def test_names_only_the_one_that_is_missing(settings, caplog):
    settings.setenv("SUPABASE_URL", SECRET_LOOKING)
    log = start_reader(caplog)
    assert "SUPABASE_ANON_KEY isn't set" in log
    assert "SUPABASE_URL isn't set" not in log


def test_an_empty_setting_counts_as_missing(settings, caplog):
    settings.setenv("SUPABASE_URL", "")
    settings.setenv("SUPABASE_ANON_KEY", SECRET_LOOKING)
    assert "SUPABASE_URL isn't set" in start_reader(caplog)


def test_points_out_a_vite_name_used_by_mistake(settings, caplog):
    settings.setenv("VITE_SUPABASE_URL", SECRET_LOOKING)
    settings.setenv("VITE_SUPABASE_ANON_KEY", SECRET_LOOKING)
    log = start_reader(caplog)
    assert "VITE_SUPABASE_URL is set, but the reader doesn't use that name" in log
    assert "VITE_SUPABASE_ANON_KEY is set, but the reader doesn't use that name" in log


def test_never_prints_a_value(settings, caplog):
    settings.setenv("VITE_SUPABASE_URL", SECRET_LOOKING)
    settings.setenv("SUPABASE_ANON_KEY", SECRET_LOOKING)
    assert SECRET_LOOKING not in start_reader(caplog)
