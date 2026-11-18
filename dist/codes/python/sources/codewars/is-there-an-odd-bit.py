def any_odd(n):
	b = f"{n:b}"
	return any(b[i]=='1'for i in range(len(b)-2,-1,-2))