def recoverSecret(triplets):
	lt = len(triplets)
	chars = [*set.union(*map(set,triplets))]
	while True:
		mem = chars[:]
		for tri in triplets:
			i1,i2,i3 = sorted([chars.index(t) for t in tri])
			chars[i1],chars[i2],chars[i3] = tri
		if chars==mem: break
	return ''.join(chars)