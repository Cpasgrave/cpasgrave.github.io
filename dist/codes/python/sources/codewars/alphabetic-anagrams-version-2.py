fac = lambda n:n if n <2 else n*fac(n-1)
def listPosition(word):
    res = 0
    for i,c in enumerate(word):
        end = word[i+1:]
        jump = len([l for l in end if l<c])
        if jump:
            jump *= fac(len(end))
            for d in set(end):
                jump //= fac(word[i:].count(d))
        res += jump
    return res+1