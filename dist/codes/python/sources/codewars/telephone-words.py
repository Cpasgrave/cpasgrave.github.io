def telephone_words(ds):
	ks = {str(d):d in{0,1}and[str(d)]or[chr(59+d*3+(d>7)+j)for j in range(3+(d in{7,9}))]for d in range(10)}
	ws = ['']
	for d in ds:
		ws = [w+c for w in ws for c in ks[d]]
	return ws