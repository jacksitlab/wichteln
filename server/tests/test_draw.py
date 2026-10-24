from app.draw import derangement

import pytest


def test_derangement_is_fixpoint_free():
    perm = derangement(5)
    assert all(perm[i] != i for i in range(5))
    assert sorted(perm) == list(range(5))


def test_derangement_n2():
    perm = derangement(2)
    assert perm == [1, 0]


def test_derangement_rejects_small_n():
    with pytest.raises(ValueError):
        derangement(1)


def test_derangement_random_distribution():
    # n=3 hat genau 2 Derangements; über viele Läufe müssen beide auftreten
    seen = set()
    for _ in range(200):
        seen.add(tuple(derangement(3)))
    assert seen == {(1, 2, 0), (2, 0, 1)}
