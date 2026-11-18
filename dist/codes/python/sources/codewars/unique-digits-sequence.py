from itertools import count

def find_num(n):
  res,last,aside,gen = [],set(),[],(str(n) for n in count())
  for i in range(n+1):
  	skip=0
  	for s in aside:
  		if not set(s)&last:
  			aside.remove(s)
  			last,skip,res = set(s),1,res+[int(s)]
  			break
  	if skip: continue
  	while True:
  		g = next(gen)
  		if not set(g)&last:
  			res.append(int(g))
  			last = set(g)
  			break
  		else:	aside.append(g)
  return res[-1]