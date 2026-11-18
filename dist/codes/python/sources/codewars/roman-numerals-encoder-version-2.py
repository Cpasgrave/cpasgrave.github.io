def solution(n):
    r = ['I','V','X','L','C','D','M','v','x','l','c','d','m']
    pat = ['','0','00','000','01','1','10','100','1000','02']
    res = ''
    for s in range(len(str(n))):
        res = ''.join([r[int(i) + 2*s] for i in pat[int(str(n)[::-1][s])]]) + res
    return res
