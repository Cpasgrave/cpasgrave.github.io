def sum_pairs(ints,s):
    cache = set()
    for a in ints:
        if (s-a) in cache:
            return([s-a,a])
        cache.add(a)