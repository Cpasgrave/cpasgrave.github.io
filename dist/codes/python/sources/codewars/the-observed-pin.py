from itertools import product
adj = "08.124.1235.236.1457.24568.3569.478.57890.689".split('.')
get_pins = lambda o:[''.join(p)for p in product(*[adj[int(d)]for d in o])]