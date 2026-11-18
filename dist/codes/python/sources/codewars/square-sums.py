from math import ceil

class Node:

	def __init__(s,val):
		s.val = val
		s.links = set()
		s.n_links = 0
		s.tried_links = set()

	def __repr__(s):
		return f"{s.val}"

	def __gt__(s,x):
		return s.val>x.val

class Square_Chain:

	def __init__(s,N):

		s.N = N
		s.rg = set(range(1,s.N+1))
		s.nodes = {i:Node(i) for i in s.rg}
		s.nodeset = set(s.nodes.values())
		s.squares = {i**2 for i in range(2,ceil((2*s.N)**.5))}
		for node in s.nodeset:
			node.links = {s.nodes[n] for n in links[node.val]&s.rg}
			node.n_links = len(node.links)
			node.tried_links = set()

	def solve(s):

		start = Node(0)
		start.links = s.nodeset
		start.tried_links = set()

		node = start
		chain = [start]
		chainset = set()

		while True:

			ways = sorted(node.links-chainset-node.tried_links,key=lambda x:[len(x.links-chainset),x.val])

			if ways==[]:
				off = chain.pop()
				off.tried_links = set()
				chainset -= {off}
				if chain==[]: break
				node = chain[-1]
			else:
				nxt = ways[0]
				chain += [nxt]
				chainset |= {nxt}
				node.tried_links |= {nxt}

				if len(chain)==s.N+1: return [c.val for c in chain][1:]
				node = nxt

		return False

limit = 1300

rg = set(range(1,limit+1))
squares = {i**2 for i in range(2,ceil((2*limit)**.5))}
links = {n:{m for sq in [s for s in squares if s>n] for m in [sq-n] if m in rg-{n}}for n in rg}

def square_sums(N):
	return Square_Chain(N).solve()