from functools import lru_cache as cache

@cache(maxsize=2048)
def sum_of_digits(a,b):
	s = sum_of_digits
	if a>1: return s(1,b)-s(1,a-1)
	if b<10: return sum(range(b+1))
	p = 10**(len(str(b))-1)
	d = b//p
	c = b-d*p
	return p*s(1,d-1)+d*(s(1,p-1)+c+1)+s(1,c)