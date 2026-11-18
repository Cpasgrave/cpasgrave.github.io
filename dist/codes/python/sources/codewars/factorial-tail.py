primz = [2]+[pz.append(n) or n for pz in[[2]]for n in range(3,256)if all(n%p for p in pz)]

def primecomp(b):
	pc = {}
	for p in primz:
		if p>b: break
		while b%p==0:
			pc[p] = pc.get(p,0)+1
			b //= p
	return pc

def zeroes(b,n):
	b_pc = primecomp(b)
	fac_n_pc = {}
	for p in b_pc:
		k = 1
		pk = p**k
		while pk<=n:
			fac_n_pc[p] = fac_n_pc.get(p,0)+n//pk
			k += 1
			pk = p**k
	return min([fac_n_pc[p]//b_pc[p]for p in fac_n_pc],default=0)