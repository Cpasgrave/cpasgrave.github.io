def codewar_result(c,o):

    i,j,score=-1,0,0
    C,O=sorted(c),sorted(o)

    while i<len(C)-1:
        i+=1
        if C[i]<=O[j]: continue
        while j<len(C)-1 and C[i]>O[j+1]: j += 1
        C.pop(i), O.pop(j)
        score += 2
        j,i = max(0,j-2),i-1

    for e in set(C)-{0}: score += min(C.count(e),O.count(e))

    return ('Defeat','Stalemate','Victory')[(score>=len(c))+(score>len(c))]