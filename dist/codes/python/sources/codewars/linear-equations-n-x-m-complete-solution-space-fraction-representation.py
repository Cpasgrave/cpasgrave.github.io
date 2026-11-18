from fractions import Fraction as F
import numpy as np

class System:
	def __init__(s,S):
		s.S = S
		s.m,s.n = S.shape

	def __str__(s):
		w = max(max(len(str(f.numerator)),len(str(f.denominator)))for line in s.S for f in line)
		p = '\n'.join(''.join(f"{n:>{w+1}}/{d:<{w+1}}"if d!=1 else f"{n:^{2*w+3}}"for f in line for n,d in[(f.numerator,f.denominator)])for line in s.S)
		return p

	def solve(s):
		# Gauss (or whoever claims it first) method 
		step = col = 0
		while step<s.m and col<s.n:
			allzero = 1
			for _ in range(step,s.m):
				# send row with a leading zero to last
				if s.S[step,col]==0: s.S[step:] = s.S[[*range(step+1,s.m)]+[step]]
				else: allzero = 0
			if allzero: col += 1; continue
			s.S[step] /= s.S[step,col]
			for row in range(step+1,s.m): s.S[row] -= s.S[row,col]*s.S[step]
			col += 1
			step += 1
		for row in range(s.m-1,-1,-1):
			col = next((i for i in range(s.n)if s.S[row,i]==1),None)
			if col:
				for i in range(row): s.S[i] -= s.S[i,col]*s.S[row]
		# Producing solution
		pivots = [None]*(s.n)
		seen = set()
		for j in range(s.n):
			if not set(s.S[:,j])-{0,1}:
				ones = np.where(s.S[:,j]==1)[0]
				if len(ones)==1:
					w = int(ones)
					if w not in seen:
						seen |= {w}
						pivots[j] = w
		if pivots[-1] != None: return "SOL=NONE"
		sol = [f"SOL=({'; '.join([str(s.S[p,-1])if p!=None else '0' for j in range(s.n-1)for p in[pivots[j]]])})"]
		q = 1
		for i in range(s.n-1):
			if pivots[i]==None:
				sol += [f"q{q} * ({'; '.join(['1'if j==i else'0'if pivots[j]==None else str(-s.S[pivots[j],i])for j in range(s.n-1)])})"]
				q += 1
		sol = ' + '.join(sol)
		return sol

def solve(system: str) -> str:
    print(system)
    S = np.array([[*map(F,line.split(' '))]for line in system.split('\n')])
    return System(S).solve()
