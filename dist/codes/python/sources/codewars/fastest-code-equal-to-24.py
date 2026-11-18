from itertools import combinations as comb
from operator import add, sub, mul, truediv as div

def equal_to_24(a,b,c,d):

    ints,exp = [a,b,c,d],[]
    ops = [mul,add,sub,div]

    def rec(ints,exp,it=0):
        if it==3 and ints == [24]: return exp
        for i,j in comb(range(4-it),2):
            m,n = ints[i],ints[j]
            rest = [ints[k]for k in range(4-it)if k not in (i,j)]
            for op in ops:
                for p,q in [((m,n),),((m,n),(n,m))][op in (sub,div)]:
                    if op==div and q==0: continue
                    res = op(p,q)
                    r = rec(rest+[res],exp+[op,p,q,res],it+1)
                    if r: return r         
        return None

    def write(ints,exp):
        symb = {add:'+', sub:'-', mul:'*',div:'/'}
        I = {i:iter([i]*ints.count(i)) for i in ints}
        for i in range(3):
            op,a,b,res = exp[i*4:i*4+4]
            I[res] = iter([f"({next(I[a])}{symb[op]}{next(I[b])})"]+[*I.get(res,iter([]))])
        return next(I[res])

    sol = rec(ints,[])
    if sol: return write([a,b,c,d],sol)
    else: return "It's not possible!"
