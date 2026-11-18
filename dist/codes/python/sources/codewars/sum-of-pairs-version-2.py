def sum_pairs(ints,s):
    cache = set()
    for i in range(len(ints)):
        a = ints[i]
        if (s-a) in cache:
            return([s-a,a])
        cache.add(a)