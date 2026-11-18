def solve(n):
	for d in range(int((n-1)**.5),0,-1):
		if n%d==0:
			b=(n//d-d)/2
			if b%1==0: return b**2
	return -1