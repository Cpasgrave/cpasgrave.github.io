def solve(m):
	sol = 0
	for p in range(1,15):
		lo,hi = 0,10
		while hi-lo>1:
			mid = (hi+lo)//2
			n = sol+mid*10**-p
			if m>n/(n-1)**2: lo = mid
			else: hi = mid
		sol += lo*10**-p
	return sol