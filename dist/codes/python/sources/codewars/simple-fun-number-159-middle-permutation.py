def middle_permutation(s):
    s = ''.join(sorted(s))
    ls = len(s)
    if ls<4:
        return s[:-1][::-1]+s[-1]
    m = ls//2
    if ls%2==0: 
        return s[m-1]+s[-1]+(s[:m-1]+s[m:-1])[::-1]
    else: 
        return s[m:m-2:-1]+(s[:m-1]+s[m+1:])[::-1]