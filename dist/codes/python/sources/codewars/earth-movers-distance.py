def earth_movers_distance(x, px, y, py):
	dx = {e:p for e,p in zip(x,px)}
	dy = {e:p for e,p in zip(y,py)}
	work = diff = 0
	for i in sorted(set(x)|set(y)):
		if diff: work += abs(diff*(i-prev))
		pxi,pyi = dx.get(i,0),dy.get(i,0)
		diff,prev = pxi+diff-pyi,i
	return work
