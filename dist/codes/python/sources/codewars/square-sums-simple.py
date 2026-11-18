from math import ceil

class Node:
	def __init__(s,v):
		s.value = v
		s.used = 0
	def __repr__(s):
		return f"{s.value}"

def square_sums_row(n):

	rg = set(range(1,n+1))
	nodes = {i:Node(i) for i in range(1,n+1)}
	squares = {i**2 for i in range(2,ceil((2*n)**.5))}
	
	for node in nodes.values():
		node.links = [nodes[s-node.value] for s in squares if s-node.value in rg-{node.value}]
		node.lk_idx = 0
		lnl = len(node.links)
		if lnl==0: return 0
		node.lk_max = lnl

	prio = sorted(nodes.values(),key=lambda x:len(x.links))

	for node in prio:
		chain = [node]
		node.used = 1
		brk = 0
		while len(chain)<n:
			nxt = node.links[node.lk_idx]
			if nxt.used:
				node.lk_idx += 1
				while node.lk_idx==node.lk_max: # back
					node.lk_idx = 0
					chain.pop()
					node.used = 0
					if len(chain)==0: 
						brk = 1
						break
					node = chain[-1]
					node.lk_idx += 1
				if brk: break
				continue
			chain += [nxt]			
			if len(chain)==n: return [c.value for c in chain]
			node = nxt
			node.used = 1

	return 0
