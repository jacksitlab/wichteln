import pytest

from app.draw import DrawUnsolvable, constrained_permutation


def test_unconstrained_case_is_fixpoint_free():
    perm = constrained_permutation(5, [{i} for i in range(5)])
    assert all(perm[i] != i for i in range(5))
    assert sorted(perm) == list(range(5))


def test_n2_mutual_pair():
    perm = constrained_permutation(2, [{0}, {1}])
    assert perm == [1, 0]


def test_rejects_small_n():
    with pytest.raises(ValueError):
        constrained_permutation(1, [{0}])


def test_exclusion_is_respected():
    # giver 0 must not draw receiver 1 -> with n=2 the only derangement is
    # [1, 0], which violates the exclusion -> unsolvable
    with pytest.raises(DrawUnsolvable):
        constrained_permutation(2, [{0, 1}, {1}])
    # n=3: 0 must not draw 1 -> every valid result must keep perm[0] != 1
    for _ in range(50):
        perm = constrained_permutation(3, [{0, 1}, {1}, {2}])
        assert perm[0] != 1
        assert sorted(perm) == list(range(3))
        assert all(perm[i] != i for i in range(3))


def test_unsolvable_raises():
    # n=3, each giver excluded from the same receiver 2 -> only receivers
    # 0 and 1 remain for three givers -> no valid permutation
    with pytest.raises(DrawUnsolvable):
        constrained_permutation(3, [{0, 2}, {1, 2}, {2}])


def test_random_distribution_unconstrained():
    # n=3 has exactly 2 derangements; both must occur over many runs
    seen = set()
    for _ in range(200):
        seen.add(tuple(constrained_permutation(3, [{0}, {1}, {2}])))
    assert seen == {(1, 2, 0), (2, 0, 1)}


def test_random_distribution_constrained():
    # n=4, 0 -> 1 excluded. Valid derangements with perm[0] != 1:
    # (2, 0, 3, 1), (2, 3, 0, 1), (3, 0, 1, 2) -> check boundary + all valid
    valid = set()
    for _ in range(400):
        perm = tuple(constrained_permutation(4, [{0, 1}, {1}, {2}, {3}]))
        assert perm[0] != 1
        valid.add(perm)
    assert len(valid) >= 2  # random, not constant


def test_one_directional_symmetry():
    # (A->B) excluded does not exclude (B->A): with n=4 and only (0->1)
    # excluded, the assignment 1 -> 0 must still occur over many runs
    seen_1_to_0 = False
    for _ in range(300):
        perm = constrained_permutation(4, [{0, 1}, {1}, {2}, {3}])
        assert perm[0] != 1
        seen_1_to_0 = seen_1_to_0 or perm[1] == 0
    assert seen_1_to_0
