from itertools import permutations as perm
permutations=lambda s:sorted({''.join(p)for p in perm(s)})