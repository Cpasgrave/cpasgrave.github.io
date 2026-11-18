def summationOfPrimes(n):
	sieve,s=[0]*(n+1),0
	for m in range(2,n+1):
		if sieve[m]==0:
			s+=m
			for j in range(2*m,n+1,m):
				sieve[j]=1
	return s