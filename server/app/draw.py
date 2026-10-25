import random
import secrets


class DrawUnsolvable(Exception):
    """No valid assignment exists under the given exclusions."""


def constrained_permutation(n: int, forbidden: list[set[int]]) -> list[int]:
    """Random permutation with perm[i] not in forbidden[i] for all i.

    forbidden[i] is the set of receivers giver i may not draw (always includes
    i itself — nobody draws themselves). Backtracking with a most-constrained-
    first heuristic and cryptographic RNG; falls back to re-shuffling from a
    random derangement for the unconstrained case (expected < 2 attempts).

    Raises DrawUnsolvable if no valid permutation exists.
    """
    if n < 2:
        raise ValueError("n >= 2 required")

    # Trivial fast path: no exclusions beyond self -> plain derangement loop
    if all(len(f) <= 1 for f in forbidden):
        while True:
            perm = list(range(n))
            for i in range(n - 1, 0, -1):
                j = secrets.randbelow(i + 1)
                perm[i], perm[j] = perm[j], perm[i]
            if all(perm[i] != i for i in range(n)):
                return perm

    # Backtracking over givers ordered fewest-options-first, random tie-break
    perm = [-1] * n
    used = [False] * n

    def options(i: int) -> list[int]:
        return [r for r in range(n)
                if not used[r] and r not in forbidden[i]]

    def solve(remaining: list[int]) -> bool:
        if not remaining:
            return True
        # pick the giver with the fewest options (constraint propagation)
        best_i, best_opts = None, None
        for idx in random.sample(range(len(remaining)), len(remaining)):
            i = remaining[idx]
            opts = options(i)
            if not opts:
                return False
            if best_opts is None or len(opts) < len(best_opts):
                best_i, best_opts = idx, opts
                if len(opts) == 1:
                    break
        i = remaining.pop(best_i)
        for r in random.sample(best_opts, len(best_opts)):
            used[r] = True
            perm[i] = r
            if solve(remaining):
                return True
            used[r] = False
            perm[i] = -1
        remaining.insert(best_i, i)
        return False

    if not solve(list(range(n))):
        raise DrawUnsolvable(
            "no valid permutation under the given exclusions")
    return perm
