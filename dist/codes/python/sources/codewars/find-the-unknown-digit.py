import re

def solve_runes(runes):
    print(runes)
    digits = "0123456789"
    left,right = runes.split('=')
    skip0 = re.search(r"\D\?[\d\?]",runes)
    for d in digits[bool(skip0):]:
        if d in runes: continue
        l = left.replace('?',d)
        r = right.replace('?',d)
        if eval(l)==eval(r): return int(d)
    return -1