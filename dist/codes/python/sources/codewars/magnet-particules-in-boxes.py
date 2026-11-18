cache = {}

def doubles(maxk, maxn):
    S = 0
    for k in range(1,maxk+1):
        for n in range(1,maxn+1):
        	if (k,n) in cache: 
        		S += cache[(k,n)]
        	else:
        		kn = 1/(k*(n+1)**(2*k))
        		cache[(k,n)] = kn
        		S += kn
    return S