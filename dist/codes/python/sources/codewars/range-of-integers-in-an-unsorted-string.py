from collections import Counter as Ct

def mystery_range(s,n):
	st,cts=[str(i)for i in range(100+n)],Ct(s)
	gen=([i,i+n-1]for i in range(1,100) if (Ct(''.join(st[i+j]for j in range(n)))==cts)*(st[i]in s))
	return next(gen)