from itertools import permutations as perm, product as prod
def solve_puzzle(clues,size=6):
  rows,rg = {*perm(range(1,size+1))},range(size)
  cu,cr,cd,cl = [clues[i*size:(i+1)*size][::1-2*(i>1)]for i in range(4)]
  left,right = {r:set() for r in range(1,size+1)},{r:set()for r in range(1,size+1)}
  left[0] = right[0] = rows
  for row in rows:
    for side,i in (left,1),(right,-1):
      s = maxi = 0
      for x in row[::i]:
        if x>maxi:
          maxi = x
          s += 1
          if x==size: break
      side[s] |= {row}
  hor,ver = [[]]*size,[[]]*size
  for i in rg:
    hor[i] = left[cl[i]]&right[cr[i]]
    ver[i] = left[cu[i]]&right[cd[i]]
  check = 0
  while True:
    for i,j in prod(rg,rg):
      common = {hi[j]for hi in hor[i]}&{vj[i]for vj in ver[j]}
      hor[i] = {h for h in hor[i]if h[j]in common}
      ver[j] = {v for v in ver[j]if v[i]in common}
    mem,check = check,sum(len(x)for x in hor+ver)
    if check==2*size or mem==check: break
  for p in prod(*map(list,hor)):
    if all({p[j][i]for j in rg}=={*range(1,size+1)} for i in rg): return p