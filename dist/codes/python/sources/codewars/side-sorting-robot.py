class Node:

	def __init__(s,value,position):
		s.value = value
		s.position = position
		s.links = []

	def __gt__(s,b):
		return s.value>b.value

	def __repr__(s):
		return f"{s.value}"

class Group:

	def __init__(s,node):
		s.value = node.value
		s.start = node.position
		s.end = node.position
		s.elements = [node]

	def __add__(s,node):
		if node.position<s.start: s.start = node.position
		if node.position>s.end: s.end = node.position
		s.elements += [node]
		return s

	def __repr__(s):
		return f"{s.elements}"

def split(arr,n):

		r = 0
		mx = [0,0]
		for i,a in enumerate(arr[1:],1):
			r += [-1,1][a.value!=n]*[1,-1][a.value==arr[i-1].value]
			mx = max(mx,[r,i])
		idx = mx[1]
		res = [e for e in arr[:idx]if e.value==n]+[e for e in arr[idx:]if e.value!=n]
		return res

class SideSort:

	def __init__(s,arr):
		s.arr = arr
		s.nodes = []
		s.values = set()
		s.groups = {}
		for i,v in enumerate(arr):
			node = Node(v,i)
			s.nodes += [node]
			if node.value in s.values:
				s.groups[v] += node
				node.group = s.groups[v]
			else:
				s.values |= {v}
				s.groups[v] = Group(node)
				node.group = s.groups[v]

		for r,v in enumerate(sorted(s.values)[::-1]):
			s.groups[v].rank = r

		s.ranked_group = {g.rank:g for g in s.groups.values()}
		s.max_rk = len(s.groups)-1

	def longest_chain(s):

		long_chain = [0,[]]
		r = range(s.max_rk+1)

		for rank_l,rank_r in zip(r,r[1:]):
			left = s.ranked_group[rank_l]
			right = s.ranked_group[rank_r]
			elements = sorted(left.elements+right.elements,key=lambda x:x.position)
			if elements: 
				ch = split(elements,left.value)
				long_chain = max(long_chain,[len(ch),ch])

		r = sorted(s.groups.values(),key=lambda x:x.rank)
		open_chains = []
		for i in range(s.max_rk+1):

			skip = 0
			mid = r[i]
			left_out,right_out = [],[]
			if i:
				left = r[i-1]
				left_out = [e for e in left.elements if e.position<mid.start]
			else: skip = 1
			if i!=s.max_rk:
				right = r[i+1]
				right_out = [e for e in right.elements if e.position>mid.end]
			else: skip = 1

			ch = left_out+mid.elements+right_out
			long_chain = max(long_chain,[len(ch),ch])

			if skip: continue
			if mid.end<right.start:
				if open_chains:
					for chain in open_chains:
						ch = chain[:]+mid.elements+right_out
						long_chain = max(long_chain,[len(ch),ch])
						chain += mid.elements+right_out if i==s.max_rk else mid.elements
				else:
					ch = left_out+mid.elements+right_out
					long_chain = max(long_chain,[len(ch),ch])
					open_chains = [left_out+mid.elements]
			elif mid.start>left.end:
				if open_chains:
					for chain in open_chains:
						ch = chain[:]+mid.elements+right_out
						long_chain = max(long_chain,[len(ch),ch])
						open_chains = []
				else:
					ch = left_out+mid.elements+right_out
					long_chain = max(long_chain,[len(ch),ch])
			else:
				for chain in open_chains:
					ch = chain+[e for e in mid.elements if e.position>left.end]
					long_chain = max(long_chain,[len(ch),ch])
				open_chains = []

		return len(s.arr)-len(long_chain[1])

def side_sort(balls):
	return SideSort(balls).longest_chain()