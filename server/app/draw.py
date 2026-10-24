import secrets


def derangement(n: int) -> list[int]:
    """Zufällige fixpunktfreie Permutation: perm[i] != i für alle i.

    Fisher-Yates mit kryptografischem RNG; bei n >= 2 existiert garantiert
    eine fixpunktfreie Permutation, erneutes Mischen bis Treffer
    (erwartet < 2 Versuche).
    """
    if n < 2:
        raise ValueError("n >= 2 erforderlich")
    while True:
        perm = list(range(n))
        for i in range(n - 1, 0, -1):
            j = secrets.randbelow(i + 1)
            perm[i], perm[j] = perm[j], perm[i]
        if all(perm[i] != i for i in range(n)):
            return perm
