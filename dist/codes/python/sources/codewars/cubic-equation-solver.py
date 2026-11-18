def clean(eq):
	E,s,al =[0]*4, 1,{chr(n)for n in range(97,123)}
	for e in eq.replace('+',' ').split():
		if e=='=': s = -1; continue
		a,b,i,s2 = 0,len(e),0,1
		if e[0]=='-': a,s2 = 1,-1
		if set(e)&al: i,b = (int(e[-1]),-3) if '^' in e else (1,-1)
		E[i] += s*s2*int(e[a:b] or '1')
	return E[::-1]

def solve(eq):
	a,b,c,d = clean(eq)
	if a==0:
		if b==0: return d==0 and 0 or [] if c==0 else [-d/c]
		return [*{(-c+d)/2/b for d in[s*(c**2-4*b*d)**.5 for s in (-1,1)]}]
	d0,d1,j = b**2-3*a*c, 2*b**3-9*a*b*c+27*a**2*d,(-1+(3**.5)*1j)/2
	C = ((d1+[1,-1][d0==0 and d<0]*(d1**2-4*d0**3)**.5)/2)**(1/3)
	return {round(s.real,8)+round(s.imag,8)*1j for s in {-(b+j**k*C+d0/(j**k*C))/3/a for k in (0,1,2)}} if C else [-b/3/a]