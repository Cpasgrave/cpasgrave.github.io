from itertools import combinations_with_replacement as cwr, permutations as perm
from functools import reduce as red
from operator import mul

def panel_count(n,dim=3):
  if n==0: return 0
  b=lambda g,d,n,k=lambda x,n:max(x,key=lambda y,z=lambda r:r*(r<=n)or 0:z(red(mul,y))):k([*cwr([g,g+1],d)],n)
  c=lambda t,d:sum([red(mul,[*map(sum,zip(t,u))])for u in[[0]*i+[-1]+[0]*(d-i-1)for i in range(d)]])
  tot = 2*dim*n
  rest = n
  for d in range(dim,0,-1):
    hp = int((rest-.1)**(1/d))
    box = b(hp,d,rest)
    ct = c(box,d)
    contact = red(mul,sorted(box),1)*(dim-d)
    tot -= (ct+contact)
    rest -= red(mul,box)
    if rest==0: break
  return tot
  