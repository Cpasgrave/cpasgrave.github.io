def hamming(n,H=[0],h2=[1,1],h3=[1,1],h5=[1,1]):
	lH = len(H)
	if n<lH: return H[n]
	for _ in range(lH,n+1):
		n2,i2 = h2
		n3,i3 = h3
		n5,i5 = h5
		hi = min(i2,i3,i5)
		H += [hi]
		if i2==hi: 
			h2[1] = H[n2]*2
			h2[0] = n2+1
		if i3==hi: 
			h3[1] = H[n3]*3
			h3[0] = n3+1
		if i5==hi: 
			h5[1] = H[n5]*5
			h5[0] = n5+1
	return H[-1]