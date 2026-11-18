# Nonogram solver

from functools import lru_cache as lru
from itertools import groupby

class Box:

	def __init__(s,x,y):
		s.x,s.y = x,y
		s.status = None
	def __repr__(s):
		return f"{s.status}"

@lru(maxsize=1024)
def split_sum(n,clues,c_num,mask):
	# this function returns all 
	# the possible ways to distribute 
	# the whites in a line, considering
	# the clues
	sols = [[n]]
	limit = 100 # should be dynamised ...

	for i,clue in enumerate(clues):
		new = []
		for s in sols:
			*s,last = s
			for k in range(last+1):
				sk = s+[0]*(k+(i>0))+[1]*clue+[last-k]
				if any(mask[j]!=None and mask[j]!=sk[j] for j in range(len(sk)-1))\
					or (i==c_num-1 and any(mask[i]==1 for i in range(-sk[-1],0))):
					# print('mask',sk,mask)
					continue
				else:
					# print('ok',sk,mask)
					new.append(sk)	
		sols = new[:]
		if len(sols)>limit: return []
	sols = [tuple(s[:-1]+s[-1]*[0])for s in sols]
	return sols

class Line:

	def __init__(s,clues,elements):
		s.els = elements
		s.size = len(s.els)
		s.clues = tuple(clues)
		s.c_num = len(clues)
		s.c_sum = sum(clues)
		s.solutions = []
		s.n_sols = 0
		s.tried = set()

	def __repr__(s):
		return f"{s.els}"

	def solve(s):
		s.mask = tuple(e.status for e in s.els)
		whites = s.size-s.c_sum
		sols = split_sum(whites-s.c_num+1,s.clues,s.c_num,s.mask)
		s.solutions = []
		if sols==[]:
			return s.solutions,0
		matches = [*sols[0]]
		indices = set(range(s.size))
		# checking for common box for all solutions
		# and removing already tried solutions
		for sol in sols:
			if sol in s.tried: continue
			s.solutions += [sol]
			garbage = set()
			for i in indices:
				if sol[i]!=matches[i]:
					matches[i] = None
					garbage |= {i}
			indices -= garbage
		mod = 0
		for i in indices:
			if s.els[i].status==None: mod += 1
			s.els[i].status = matches[i]
			
		return s.solutions,mod

	def fill(s):
		attempt = s.solutions.pop()
		s.tried |= {attempt}
		mod = 0
		for i,e in enumerate(attempt):
			if e!=None: mod += 1
			if s.els[i].status!=None: mod -= 1
			s.els[i].status = e
		return mod

	def back(s):
		pass



class Nonogram:

	def __init__(s,gram):
		s.x,s.y = gram
		s.width = len(s.x)
		s.height = len(s.y)
		s.rows = [Line(s.y[i],[Box(i,j) for j in range(s.width)])for i in range(s.height)]
		s.cols = [Line(s.x[i],[s.rows[j].els[i] for j in range(s.height)])for i in range(s.width)]
		s.lines = s.rows+s.cols
		s.solved,s.tot = 0,s.width*s.height

	def check_sol(s):
		for line in s.lines:
			clues = line.clues
			gb = groupby([e.status for e in line.els])
			if clues!=tuple(len([*v]) for k,v in gb if k):
				print("\nWRONG SOLUTION !\n")
				return 
		print('\nCHECKED OK !\n')
		return

	def solve(s):

		while s.solved<s.tot:

			for line in s.lines:
				sols,mod = line.solve()
				s.solved += mod
				line.solutions = sols
				ls = len(sols)
				line.n_sols = ls>0 and ls or float('inf')

			best = min(s.lines,key=lambda x:x.n_sols)

			if best.solutions==[]:
				# backtracking
				print("backtracking under construction ...")
				return

			else:
				mod = best.fill()
				s.solved += mod

		return tuple(tuple(1 if e.status else 0 for e in r.els)for r in s.rows)
