from functools import lru_cache as cache

def adj(citizen):
	i,j = citizen//10, citizen%10
	return [*[(i-1)*10+j,10*i+j-1][i==0:2-(j==0)],*[10*(i+1)+j,10*i+j+1][i==4:2-(j==4)]]

@cache(maxsize=50000)
def district(start,rest):
	global connections
	s = [{start,}]
	rest = set(rest)
	for _ in range(4):
		ts = []
		for f in s:
			adjs = {c2 for c1 in f for c2 in connections[c1]}
			for n in adjs&rest-set(f):
				fn = f|{n}
				if fn in ts: continue
				ts += [fn]
		s = ts
	return s

def maps():
	combs = [()]
	for _ in range(5):
		temp = []
		for comb in combs:
			rest = set(citizens)
			for c in comb: rest-=c
			for f in district(rest.pop(),tuple(rest)):
				temp += [comb+(f,)]
		combs = temp
	return combs

def gerrymander(region):
    M = maps()
    region = [[[0,1][r=='O'] for r in row]for row in region.split('\n')]
    for m in M:
    	score = sum([sum([region[d//10][d%10] for d in district])>2 for district in m])
    	if score>2:
    		res = [[' ']*5 for _ in range(5)]
    		for r,row in enumerate(m):
    			for d in row:
    				res[d//10][d%10] = str(r+1)
    		return '\n'.join([''.join(row) for row in res])
    else:
    	return None
        
citizens = set(int(str(i)+str(j))for i in range(5) for j in range(5))
connections = {c:adj(c) for c in citizens}