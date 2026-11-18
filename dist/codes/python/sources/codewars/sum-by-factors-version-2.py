from collections import defaultdict as dd
def pFac(n):
    if n<2: return {}
    fac = dd(int)
    while n%2==0:
        n //= 2
        fac[2] += 1
    p = 3
    while p <= n:
        if n%p==0:
            n //= p
            fac[p] += 1
        else: p += 2
    return fac

def sum_for_list(lst):
  dic = {}
  for n in lst:
  	primes = pFac(abs(n))
  	for p in primes:
  	  dic[p]=dic.get(p,0)+n
  return [[k,v]for k,v in sorted(dic.items())]