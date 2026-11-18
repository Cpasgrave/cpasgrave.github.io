from itertools import count

def find(n,cache = {0:0,1:1,2:2,3:2}):
	if n in cache: return cache[n]
	length = i = 2
	r = 1
	pg,qg = [(find(i) for i in count(2))for _ in range(2)]
	while True:
		p = next(pg)
		for _ in range(p):
			q = next(qg)
			r += 1
			qr = q*r
			temp = length+qr
			if temp>=n:
				s = i+(n-length)//r
				cache[n] = s
				return s
			length = temp
			i += q