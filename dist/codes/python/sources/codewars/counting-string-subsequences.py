def count_subsequences(a, b):
	indices = {}
	for i,c in enumerate(a):
		indices[c] = [i]+indices.get(c,[])
	ct = [0]*len(a)
	for c in b:
		for j in indices.get(c,[]):
			if j==0: ct[0] += 1
			elif ct[j-1]: ct[j] += ct[j-1]
	return ct[-1]