from functools import lru_cache as lru

class Box:

  def __init__(s,x,y):
    s.x,s.y = x,y
    s.status = None
  def __repr__(s):
    return f"{s.status}"

@lru(maxsize=1024)
def split_sum(n,clues,c_num,mask,limit):
  # this function returns all 
  # the possible ways to distribute 
  # the whites/blacks in a line, 
  # considering the given clues
  # and a mask (already settled positions).
  sols = {(n,)}

  for i,clue in enumerate(clues):
    new = set()
    for s in sols:

      *s,last = s
      for k in range(last+1):
        sk = tuple(s)+(0,)*(k+(i>0))+(1,)*clue+(last-k,)
        if any(mask[j]!=None and mask[j]!=sk[j] for j in range(len(sk)-1))\
          or (i==c_num-1 and any(mask[i]==1 for i in range(-sk[-1],0))):
          continue
        else:
          new |= {sk}
    sols = set(new)
    if len(sols)>limit: return 'too many'
  sols = {s[:-1]+s[-1]*(0,) for s in sols}
  return sols

@lru(maxsize=1024)
def npart(n,m):
    return 0 if n<1 else 1 if m==1 else npart(n-1,m-1)+npart(n-m,m)

class Line:

  def __init__(s,clues,elements,n):
    s.n = n
    s.els = elements
    s.size = len(s.els)
    s.nones = s.size
    s.clues = tuple(c==[]and[0]or c for c in clues)
    s.c_num = len(clues)
    s.c_sum = sum(clues)
    s.solutions = set()

  def solve(s,limit):
    s.mask = tuple(e.status for e in s.els)
    whites = s.size-s.c_sum
    s.solutions = split_sum(whites-s.c_num+1,s.clues,s.c_num,s.mask,limit)

    if s.solutions==set(): return None
    if s.solutions=="too many": return "too many"

    # checking boxes with same status for all solutions
    for matches in s.solutions: break
    rg = range(s.size)
    indices = set(rg)
    for sol in s.solutions:
      garbage = set()
      for i in rg:
        if sol[i]!=matches[i]:
          garbage |= {i}
      indices -= garbage
    sol = []
    for i in indices:
      if s.els[i].status==None:
        sol += [s.els[i]]
        s.els[i].status = matches[i]

    return sol

class Nono:

  def __init__(s,gram):
    s.x,s.y = gram
    s.width = len(s.x)
    s.height = len(s.y)
    s.rows = [Line(s.y[i],[Box(i,j) for j in range(s.width)],f"row {i}")for i in range(s.height)]
    s.cols = [Line(s.x[i],[s.rows[j].els[i] for j in range(s.height)],f"col {i}")for i in range(s.width)]
    s.lines = s.rows+s.cols
    s.solved,s.tot = 0,s.width*s.height

  def solve(s):

    limit = 300
    side = 0
    modified = []
    changes = 0

    while s.solved!=s.tot:

      # alternating sides
      side = 1-side
      lines = modified or [s.rows,s.cols][side]
      modified = []

      for line in lines:

        if line.nones==0: continue

        sol = line.solve(limit)
        if sol=="too many" or sol==[]: continue

        # Applying solution
        ls = len(sol)
        s.solved += ls
        if ls: changes = 0
        for box in sol:
          s.cols[box.y].nones -= 1
          s.rows[box.x].nones -= 1
          # the perpendicular lines will be checked first next round:
          modified += [[s.cols,s.rows][side][[box.y,box.x][side]]]

    return tuple(tuple(e.status for e in r.els) for r in s.rows)

def solve(clues):
  return Nono(clues).solve()
