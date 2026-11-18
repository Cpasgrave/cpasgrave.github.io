from itertools import permutations as perm

def regex_contains_all(st): 
    return ".*("+'|'.join('.*'.join(p) for p in perm(st))+").*"
