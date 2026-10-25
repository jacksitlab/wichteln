import secrets


def derangement(n: int) -> list[int]:
    """Random fixed-point-free permutation: perm[i] != i for all i.

    Fisher-Yates with a cryptographic RNG; for n >= 2 a fixed-point-free
    permutation is guaranteed to exist, so re-shuffle until one is found
    (expected < 2 attempts).
    """
    if n < 2:
        raise ValueError("n >= 2 required")
    while True:
        perm = list(range(n))
        for i in range(n - 1, 0, -1):
            j = secrets.randbelow(i + 1)
            perm[i], perm[j] = perm[j], perm[i]
        if all(perm[i] != i for i in range(n)):
            return perm
