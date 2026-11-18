def determinant(m):
	n = len(m)
	if n==1: return m[0][0]
	elif n==2: return m[0][0]*m[1][1]-m[0][1]*m[1][0]
	else: return sum((-1)**i*m[0][i]*determinant([m[r][:i]+m[r][i+1:] for r in range(1,n)])for i in range(n))
