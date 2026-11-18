def sum_of_intervals(intervals):
    
	result = 0
	si = sorted(intervals)
	l,h = si[0]
	for a,b in si:
		if a>h: 
			result += h-l
			l,h = a,b
		elif b<=h: continue
		else: h = b

	return result+h-l